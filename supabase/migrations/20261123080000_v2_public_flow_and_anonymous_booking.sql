-- Migration: V2 Public Flow & Anonymous Booking Support
-- 1. Orders: Allow user_id to be NULL and allow anon inserts
-- 2. Feedback: Allow customer_id to be NULL and allow anon delivered-order feedback
-- 3. Contact Inquiries: Allow anon inserts
-- 4. Tracking: Return order id and has_feedback in track_order_public
-- 5. Customer Directory: Include public/anonymous senders in Admin Customers directory

BEGIN;

-- 1. Allow orders without an authenticated user (user_id IS NULL)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS for orders insertion to allow anonymous inserts
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    ((user_id = auth.uid()) OR (user_id IS NULL))
    AND ((status)::text = ANY ((ARRAY['Pending'::character varying, 'Pending Review'::character varying, 'Assigned'::character varying])::text[]))
    AND (actual_weight IS NULL)
    AND (payment_method IS NULL)
    AND ((payment_status)::text = 'unpaid'::text)
    AND (amount_paid = (0)::numeric)
    AND (pickup_photos = '[]'::jsonb)
    AND (delivery_photos = '[]'::jsonb)
  );

-- Update prepare_order_insert trigger function to accommodate NULL user_id
CREATE OR REPLACE FUNCTION public.prepare_order_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  trip_row public.trips%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot create orders for another user';
  END IF;

  IF NEW.tracking_number IS NULL OR btrim(NEW.tracking_number) = '' THEN
    NEW.tracking_number := public.generate_order_tracking_number();
  END IF;
  
  NEW.actual_weight := NULL;
  NEW.payment_method := NULL;
  NEW.payment_status := 'unpaid';
  NEW.amount_paid := 0;
  NEW.promised_payment_date := NULL;
  NEW.payment_reference := NULL;
  NEW.pickup_photos := '[]'::jsonb;
  NEW.delivery_photos := '[]'::jsonb;
  NEW.cancellation_details := NULL;

  IF NEW.trip_id IS NOT NULL THEN
    SELECT * INTO trip_row FROM public.trips WHERE id = NEW.trip_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected trip does not exist';
    END IF;
    NEW.status := 'Assigned';
    NEW.origin := trip_row.origin;
    NEW.destination := trip_row.destination;
  ELSE
    NEW.status := 'Pending';
  END IF;

  NEW.shipping_cost := 0;
  NEW.remaining_balance := 0;

  RETURN NEW;
END;
$function$;

-- 2. Allow customer_feedback without an authenticated user (customer_id IS NULL)
ALTER TABLE public.customer_feedback ALTER COLUMN customer_id DROP NOT NULL;

DROP POLICY IF EXISTS "Customers can insert own delivered-order feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "Public can insert delivered order feedback" ON public.customer_feedback;
CREATE POLICY "Public can insert delivered order feedback" ON public.customer_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    ((customer_id = auth.uid()) OR (customer_id IS NULL))
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = customer_feedback.order_id
        AND (o.status)::text = 'Delivered'::text
    )
  );

DROP POLICY IF EXISTS "Public can read feedback" ON public.customer_feedback;
CREATE POLICY "Public can read feedback" ON public.customer_feedback
  FOR SELECT
  TO anon, authenticated
  USING (is_hidden = false OR (customer_id = auth.uid()) OR is_admin());

-- RPC for submitting order feedback easily and securely from public tracking
CREATE OR REPLACE FUNCTION public.submit_order_feedback(
  p_order_id uuid,
  p_rating integer,
  p_message text,
  p_customer_id uuid DEFAULT NULL
)
RETURNS public.customer_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_feedback public.customer_feedback%ROWTYPE;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  
  IF p_message IS NULL OR btrim(p_message) = '' THEN
    RAISE EXCEPTION 'Feedback message cannot be empty';
  END IF;

  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status <> 'Delivered' THEN
    RAISE EXCEPTION 'Feedback can only be submitted for delivered orders';
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_feedback WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Feedback has already been submitted for this order';
  END IF;

  INSERT INTO public.customer_feedback (
    order_id,
    customer_id,
    rating,
    message,
    is_hidden
  ) VALUES (
    p_order_id,
    COALESCE(p_customer_id, auth.uid()),
    p_rating,
    btrim(p_message),
    false
  )
  RETURNING * INTO v_feedback;

  RETURN v_feedback;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order_feedback(uuid, integer, text, uuid) TO anon, authenticated, service_role;

-- 3. Public contact inquiries RLS insert policy
DROP POLICY IF EXISTS "Anyone can submit contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Anyone can submit contact inquiries" ON public.contact_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Update track_order_public to return id and has_feedback
DROP FUNCTION IF EXISTS public.track_order_public(text);
CREATE OR REPLACE FUNCTION public.track_order_public(p_tracking_number text)
 RETURNS TABLE(
   id uuid,
   tracking_number character varying,
   status character varying,
   sender_name text,
   receiver_name text,
   origin character varying,
   destination character varying,
   package_description text,
   actual_weight numeric,
   package_quantity integer,
   estimated_delivery timestamp with time zone,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   has_feedback boolean
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.tracking_number,
    o.status,
    public.mask_name(o.sender_name)   AS sender_name,
    public.mask_name(o.receiver_name) AS receiver_name,
    o.origin,
    o.destination,
    CASE
      WHEN length(o.package_description) > 40
        THEN left(o.package_description, 40) || '…'
      ELSE o.package_description
    END                               AS package_description,
    o.actual_weight,
    o.package_quantity,
    t.arrival_date                    AS estimated_delivery,
    o.created_at,
    o.updated_at,
    EXISTS(SELECT 1 FROM public.customer_feedback cf WHERE cf.order_id = o.id) AS has_feedback
  FROM public.orders o
  LEFT JOIN public.trips t ON t.id = o.trip_id
  WHERE o.tracking_number = UPPER(TRIM(p_tracking_number))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.track_order_public(text) TO anon, authenticated, service_role;

-- 5. Update get_public_feedback to fallback to o.sender_name when p.name is NULL
CREATE OR REPLACE FUNCTION public.get_public_feedback()
 RETURNS TABLE(id uuid, rating integer, message text, created_at timestamp with time zone, 
customer_name text, receiver_city text, receiver_province text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    f.id,
    f.rating,
    f.message,
    f.created_at,
    COALESCE(public.mask_name(p.name), public.mask_name(o.sender_name), 'Customer') AS customer_name,
    o.receiver_city,
    o.receiver_province
  FROM public.customer_feedback f
  LEFT JOIN public.profiles p ON p.id = f.customer_id
  LEFT JOIN public.orders   o ON o.id = f.order_id
  WHERE f.is_hidden = false
  ORDER BY f.rating DESC, f.created_at DESC;
$function$;

-- 6. Update get_admin_customers and get_admin_customer_provinces to include senders from anonymous bookings
CREATE OR REPLACE FUNCTION public.get_admin_customers(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 15,
  p_search TEXT DEFAULT '',
  p_status_filter TEXT DEFAULT 'all',
  p_province TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'newest'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  address_city TEXT,
  address_province TEXT,
  created_at TIMESTAMPTZ,
  total_bookings BIGINT,
  outstanding_balance NUMERIC,
  last_booking_at TIMESTAMPTZ,
  pending_bookings BIGINT,
  active_bookings BIGINT,
  directory_status TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_per_page INTEGER := LEAST(GREATEST(COALESCE(p_per_page, 15), 1), 100);
  v_search TEXT := btrim(COALESCE(p_search, ''));
  v_filter TEXT := lower(btrim(COALESCE(p_status_filter, 'all')));
  v_province TEXT := NULLIF(btrim(COALESCE(p_province, '')), '');
  v_sort TEXT := lower(btrim(COALESCE(p_sort, 'newest')));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_search) > 100 THEN
    RAISE EXCEPTION 'Search must be 100 characters or less' USING ERRCODE = '22023';
  END IF;

  IF v_province IS NOT NULL AND char_length(v_province) > 255 THEN
    RAISE EXCEPTION 'Province filter is too long' USING ERRCODE = '22023';
  END IF;

  IF v_filter NOT IN ('all', 'with_balance', 'pending', 'active', 'no_bookings') THEN
    RAISE EXCEPTION 'Unsupported customer filter' USING ERRCODE = '22023';
  END IF;

  IF v_sort NOT IN ('name_asc', 'newest', 'oldest', 'most_bookings', 'highest_balance', 'recent_booking') THEN
    RAISE EXCEPTION 'Unsupported customer sort' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH combined_customers AS (
    -- Registered customers
    SELECT
      p.id,
      p.name::TEXT AS name,
      p.email::TEXT AS email,
      p.phone::TEXT AS phone,
      p.address_city::TEXT AS address_city,
      p.address_province::TEXT AS address_province,
      p.created_at,
      count(o.id)::BIGINT AS total_bookings,
      round(COALESCE(sum(
        CASE
          WHEN o.id IS NULL OR o.status = 'Cancelled' THEN 0::NUMERIC
          ELSE greatest(
            COALESCE(o.shipping_cost, 0)
              - COALESCE(o.discount_amount, 0)
              - COALESCE(o.amount_paid, 0),
            0::NUMERIC
          )
        END
      ), 0::NUMERIC), 2) AS outstanding_balance,
      max(o.created_at) AS last_booking_at,
      count(o.id) FILTER (
        WHERE o.status IN ('Pending Review', 'Pending', 'Pending Cancellation')
      )::BIGINT AS pending_bookings,
      count(o.id) FILTER (
        WHERE o.status IN ('Assigned', 'Picked Up', 'In Transit', 'Arrived at Hub', 'Out for Delivery')
      )::BIGINT AS active_bookings
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.user_id = p.id
    WHERE p.role = 'customer'
    GROUP BY p.id, p.name, p.email, p.phone, p.address_city, p.address_province, p.created_at

    UNION ALL

    -- Anonymous / Public booking customers (user_id IS NULL)
    SELECT
      min(o.id) AS id,
      o.sender_name::TEXT AS name,
      NULL::TEXT AS email,
      o.sender_phone::TEXT AS phone,
      o.sender_city::TEXT AS address_city,
      o.sender_province::TEXT AS address_province,
      min(o.created_at) AS created_at,
      count(o.id)::BIGINT AS total_bookings,
      round(COALESCE(sum(
        CASE
          WHEN o.status = 'Cancelled' THEN 0::NUMERIC
          ELSE greatest(
            COALESCE(o.shipping_cost, 0)
              - COALESCE(o.discount_amount, 0)
              - COALESCE(o.amount_paid, 0),
            0::NUMERIC
          )
        END
      ), 0::NUMERIC), 2) AS outstanding_balance,
      max(o.created_at) AS last_booking_at,
      count(o.id) FILTER (
        WHERE o.status IN ('Pending Review', 'Pending', 'Pending Cancellation')
      )::BIGINT AS pending_bookings,
      count(o.id) FILTER (
        WHERE o.status IN ('Assigned', 'Picked Up', 'In Transit', 'Arrived at Hub', 'Out for Delivery')
      )::BIGINT AS active_bookings
    FROM public.orders o
    WHERE o.user_id IS NULL
    GROUP BY o.sender_name, o.sender_phone, o.sender_city, o.sender_province
  ), filtered AS (
    SELECT
      r.*,
      CASE
        WHEN r.outstanding_balance > 0 THEN 'with_balance'
        WHEN r.pending_bookings > 0 THEN 'pending'
        WHEN r.active_bookings > 0 THEN 'active'
        ELSE 'inactive'
      END AS directory_status
    FROM combined_customers r
    WHERE (
      v_search = ''
      OR r.name ILIKE '%' || v_search || '%'
      OR COALESCE(r.email, '') ILIKE '%' || v_search || '%'
      OR COALESCE(r.phone, '') ILIKE '%' || v_search || '%'
      OR COALESCE(r.address_city, '') ILIKE '%' || v_search || '%'
      OR COALESCE(r.address_province, '') ILIKE '%' || v_search || '%'
    )
    AND (v_province IS NULL OR lower(btrim(COALESCE(r.address_province, ''))) = lower(v_province))
    AND CASE v_filter
      WHEN 'with_balance' THEN r.outstanding_balance > 0
      WHEN 'pending' THEN r.pending_bookings > 0
      WHEN 'active' THEN r.active_bookings > 0
      WHEN 'no_bookings' THEN r.total_bookings = 0
      ELSE true
    END
  )
  SELECT
    f.id,
    f.name,
    f.email,
    f.phone,
    f.address_city,
    f.address_province,
    f.created_at,
    f.total_bookings,
    f.outstanding_balance,
    f.last_booking_at,
    f.pending_bookings,
    f.active_bookings,
    f.directory_status,
    count(*) OVER()::BIGINT AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN v_sort = 'name_asc' THEN lower(f.name) END ASC NULLS LAST,
    CASE WHEN v_sort = 'newest' THEN f.created_at END DESC NULLS LAST,
    CASE WHEN v_sort = 'oldest' THEN f.created_at END ASC NULLS LAST,
    CASE WHEN v_sort = 'most_bookings' THEN f.total_bookings END DESC NULLS LAST,
    CASE WHEN v_sort = 'highest_balance' THEN f.outstanding_balance END DESC NULLS LAST,
    CASE WHEN v_sort = 'recent_booking' THEN f.last_booking_at END DESC NULLS LAST,
    lower(f.name) ASC,
    f.id ASC
  LIMIT v_per_page
  OFFSET (v_page - 1) * v_per_page;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_customer_provinces()
RETURNS TABLE (province TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT btrim(p.address_province)::TEXT
  FROM public.profiles p
  WHERE p.role = 'customer'
    AND NULLIF(btrim(p.address_province), '') IS NOT NULL
  UNION
  SELECT DISTINCT btrim(o.sender_province)::TEXT
  FROM public.orders o
  WHERE o.user_id IS NULL
    AND NULLIF(btrim(o.sender_province), '') IS NOT NULL
  ORDER BY 1;
END;
$$;

COMMIT;
