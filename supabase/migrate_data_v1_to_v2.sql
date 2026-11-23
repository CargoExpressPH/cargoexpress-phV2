-- ============================================================================
-- CargoExpress PH v2: COMPLETE DATA MIGRATION FROM MAIN (duigaivxgxlnjmfienhg)
-- Project: okbwvwwwhaaxaezvbfsc
-- Migrates:
-- 1. Admin Auth Users & Profiles (Password: sarongBEA22)
-- 2. Company Information & Complete Service Area Municipalities
-- 3. Scheduled Trips
-- 4. Bookings (Orders)
-- 5. Order Status History Events
-- 6. Announcements
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ADMIN USERS (auth.users)
-- Note: GoTrue requires non-null empty strings ('') for all token fields,
-- otherwise it throws "Database error querying schema" (converting NULL to string is unsupported).

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_super_admin, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role
)
VALUES (
  'a9790e8d-cce5-4a86-b127-1a0f45a4952c', '00000000-0000-0000-0000-000000000000',
  'e2e.admin@cargoexpressph-e2e.test', extensions.crypt('sarongBEA22', extensions.gen_salt('bf')),
  now(), '', '', '', '', '', '', '', '', 0, false, false, false,
  '{"provider":"email","providers":["email"]}'::jsonb, '{"email":"e2e.admin@cargoexpressph-e2e.test","email_verified":false,"legal_privacy_accepted":true,"legal_privacy_version":"2026-08-22","legal_terms_accepted":true,"legal_terms_version":"2026-08-22","name":"Audit Test Admin","phone":"09170000001","phone_verified":false,"sub":"a9790e8d-cce5-4a86-b127-1a0f45a4952c","wants_announcements":false}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  confirmation_token = '',
  recovery_token = '',
  email_change = '',
  email_change_token_new = '',
  email_change_token_current = '',
  phone_change = '',
  phone_change_token = '',
  reauthentication_token = '',
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_super_admin, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role
)
VALUES (
  'dc668c1f-2948-4e38-a5f4-40b9c692dc73', '00000000-0000-0000-0000-000000000000',
  'marlon_sarong@yahoo.com', extensions.crypt('sarongBEA22', extensions.gen_salt('bf')),
  now(), '', '', '', '', '', '', '', '', 0, false, false, false,
  '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true,"full_name":"Marlon Sarong","name":"Marlon Sarong"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  confirmation_token = '',
  recovery_token = '',
  email_change = '',
  email_change_token_new = '',
  email_change_token_current = '',
  phone_change = '',
  phone_change_token = '',
  reauthentication_token = '',
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_super_admin, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role
)
VALUES (
  '2e11107a-0275-4dff-917c-7c71b13fa2d4', '00000000-0000-0000-0000-000000000000',
  'ship2doorofficial@gmail.com', extensions.crypt('sarongBEA22', extensions.gen_salt('bf')),
  now(), '', '', '', '', '', '', '', '', 0, false, false, false,
  '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true,"full_name":"Cristina Sarong","name":"Cristina Sarong"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  confirmation_token = '',
  recovery_token = '',
  email_change = '',
  email_change_token_new = '',
  email_change_token_current = '',
  phone_change = '',
  phone_change_token = '',
  reauthentication_token = '',
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- 1b. Fix any existing NULL token columns in auth.users
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  is_super_admin = COALESCE(is_super_admin, false),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  aud = COALESCE(aud, 'authenticated'),
  role = COALESCE(role, 'authenticated');

-- 1c. Insert corresponding rows into auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
ON CONFLICT DO NOTHING;

-- 2. PROFILES

INSERT INTO public.profiles (id, name, email, phone, role, created_at, updated_at, facebook_name)
VALUES (
  'a9790e8d-cce5-4a86-b127-1a0f45a4952c', 'Audit Test Admin', 'e2e.admin@cargoexpressph-e2e.test', '09170000001',
  'admin', '2026-10-01T07:45:08.383505+00:00', '2026-10-01T07:45:24.50769+00:00', NULL
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO public.profiles (id, name, email, phone, role, created_at, updated_at, facebook_name)
VALUES (
  '2e11107a-0275-4dff-917c-7c71b13fa2d4', 'Cristina Sarong', 'ship2doorofficial@gmail.com', '09212528208',
  'admin', '2026-05-01T01:15:53.981242+00:00', '2026-09-09T21:55:59.155921+00:00', 'Cristina Sarong'
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO public.profiles (id, name, email, phone, role, created_at, updated_at, facebook_name)
VALUES (
  'dc668c1f-2948-4e38-a5f4-40b9c692dc73', 'Marlon Sarong', 'marlon_sarong@yahoo.com', '09275050460',
  'admin', '2026-06-26T10:33:50.914074+00:00', '2026-09-09T21:56:11.24209+00:00', 'Marlon Sarong'
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- 3. COMPANY INFORMATION & SERVICE AREAS

INSERT INTO public.company_information (
  id, name, short_description, long_description,
  banner_image_url, banner_title, banner_description, banner_button_text, banner_button_link,
  email, facebook, smart_phone, globe_phone, manila_address, bohol_address,
  default_price_per_kg, default_capacity, features, service_areas
)
VALUES (
  '00000000-0000-0000-0000-000000000001', 'CargoExpress PH', 'Fast & Reliable Cargo Delivery connecting Bohol and Manila with safe, affordable cargo shipping.', 'Sa CargoExpress PH, alam namin na ang bawat padala ay may mahalagang kahulugan—mga gamit para sa pamilya, pangangailangan sa negosyo, o mga bagay na importante sa inyong pang-araw-araw na pamumuhay. Kaya mahalaga sa amin ang tiwalang ibinibigay ninyo sa bawat booking.

Nagbibigay kami ng serbisyo sa paghahatid ng mga kargamento sa pagitan ng Bohol at Manila. Layunin namin na mapadali ang inyong pagpapadala sa pamamagitan ng malinaw na komunikasyon, maingat na paghawak sa inyong mga gamit, at regular na updates tungkol sa inyong shipment.

Mula sa pickup hanggang delivery, nandito kami para tumulong at sumagot sa inyong mga katanungan. Maraming salamat sa pagtitiwala sa CargoExpress PH—ang inyong katuwang sa pagpapadala, gaano man kalayo ang destinasyon.',
  'https://duigaivxgxlnjmfienhg.supabase.co/storage/v1/object/public/company-assets/banner/banner-image.jpg?t=1789462320535', 'Cargo Delivery Services', 'Marlon Sarong Cargo Delivery Services at your service.',
  'Visit My Official Account', 'https://www.facebook.com/marlon.sarong.cargodeliveryservice',
  'ship2doorofficial@gmail.com', 'https://www.facebook.com/mscargodeliveryservice', '09212528208', '09275050460',
  'Dasma, Cavite', 'Batuan, Bohol',
  70, 1000,
  '[{"id":"9496ebcf-045a-4aae-ae0a-8036fccb6254","icon":"Package","title":"Door to Door Delivery","description":"We pick up and deliver the package door to door","display_order":0},{"id":"4ef1ff9b-c238-4640-90cc-eec46fb0971f","icon":"Truck","title":"Fast and Reliable","description":"We deliver immediately after we arrived in hub.","display_order":0},{"id":"21c88834-7bd0-4725-a13d-8dd83e068f24","icon":"Handshake","title":"Affordable Per Kilo Rates","description":"Get fair, transparent, and economical shipping rates calculated accurately based on the weight of your cargo.","display_order":0}]'::jsonb, NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  email = EXCLUDED.email,
  facebook = EXCLUDED.facebook,
  smart_phone = EXCLUDED.smart_phone,
  globe_phone = EXCLUDED.globe_phone,
  manila_address = EXCLUDED.manila_address,
  bohol_address = EXCLUDED.bohol_address,
  service_areas = EXCLUDED.service_areas,
  features = EXCLUDED.features;

-- 4. TRIPS

INSERT INTO public.trips (
  id, trip_number, origin, destination, departure_date, arrival_date,
  capacity, price_per_kg, status, notes, created_by, created_at, updated_at
)
VALUES (
  'c84e7fd1-3f3d-478a-962c-9b9eb5426458', 'TRIP-20261122-379', 'Manila', 'Bohol',
  '2026-11-27T16:00:00+00:00', '2026-11-29T16:00:00+00:00',
  2000, 70, 'scheduled',
  'Transferred from main', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73',
  '2026-11-22T23:30:19.196629+00:00', '2026-11-22T23:30:19.196629+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  trip_number = EXCLUDED.trip_number,
  status = EXCLUDED.status,
  origin = EXCLUDED.origin,
  destination = EXCLUDED.destination,
  departure_date = EXCLUDED.departure_date,
  arrival_date = EXCLUDED.arrival_date;

-- 5. ORDERS (BOOKINGS)

INSERT INTO public.orders (
  id, user_id, trip_id, origin, destination, tracking_number,
  sender_name, sender_phone, sender_address,
  receiver_name, receiver_phone, receiver_address,
  package_description, package_quantity, actual_weight, shipping_cost,
  payer_type, payment_method, payment_status, amount_paid, remaining_balance,
  status, sender_facebook, sender_city, sender_province,
  receiver_facebook, receiver_city, receiver_province,
  pickup_photos, delivery_photos, created_at, updated_at
)
VALUES (
  '2f21139d-0e4f-46df-b2b7-10f67af49286', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', 'c84e7fd1-3f3d-478a-962c-9b9eb5426458',
  'Manila', 'Bohol', 'CE-20261122-1934',
  'Marienel Liray', '09999999999', 'Laguna Ext. Gagalangin Tondo, Laguna Ext. Gagalangin Tondo, Barangay 730, Manila, Metro Manila',
  'Marcelo Lagumbay', '09999999999', 'Purok 4, NA, Yanaya, Bilar, Bohol',
  '2 boxes', 2, 38, 2660,
  'sender', 'cash', 'paid',
  2500, 0,
  'Picked Up',
  'Marienel Liray', 'Manila', 'Metro Manila',
  'Na', 'Bilar', 'Bohol',
  '[{"path":"pickup-proofs/CE-20261122-1934/pickup-1.jpg","type":"supabase_storage","bucket":"cargo-photos","created_at":"2026-11-23T00:02:25.406Z","size_bytes":132411,"content_type":"image/jpeg"}]'::jsonb, '[]'::jsonb,
  '2026-11-22T23:58:17.55713+00:00', '2026-11-23T00:02:38.321005+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  tracking_number = EXCLUDED.tracking_number,
  status = EXCLUDED.status,
  amount_paid = EXCLUDED.amount_paid,
  actual_weight = EXCLUDED.actual_weight;

INSERT INTO public.orders (
  id, user_id, trip_id, origin, destination, tracking_number,
  sender_name, sender_phone, sender_address,
  receiver_name, receiver_phone, receiver_address,
  package_description, package_quantity, actual_weight, shipping_cost,
  payer_type, payment_method, payment_status, amount_paid, remaining_balance,
  status, sender_facebook, sender_city, sender_province,
  receiver_facebook, receiver_city, receiver_province,
  pickup_photos, delivery_photos, created_at, updated_at
)
VALUES (
  '247d2620-18c7-438c-ad47-e986e95c7a66', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', 'c84e7fd1-3f3d-478a-962c-9b9eb5426458',
  'Manila', 'Bohol', 'CE-20261122-9087',
  'Edsel Sandigan', '09999999999', 'Blk 40, Martinez Public Market, Addition Hills, Mandaluyong, Metro Manila',
  'Edsel Sandigan', '09999999999', 'Purok 4, NA, Lundag, Pilar, Bohol',
  '1 bag blue', 1, 14, 980,
  'sender', 'cash', 'paid',
  980, 0,
  'Picked Up',
  'Edsel Sandigan', 'Mandaluyong', 'Metro Manila',
  'Edsel Sandigan', 'Pilar', 'Bohol',
  '[{"path":"pickup-proofs/CE-20261122-9087/pickup-1.jpg","type":"supabase_storage","bucket":"cargo-photos","created_at":"2026-11-23T00:03:26.440Z","size_bytes":114465,"content_type":"image/jpeg"}]'::jsonb, '[]'::jsonb,
  '2026-11-22T23:34:30.790581+00:00', '2026-11-23T00:03:39.383522+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  tracking_number = EXCLUDED.tracking_number,
  status = EXCLUDED.status,
  amount_paid = EXCLUDED.amount_paid,
  actual_weight = EXCLUDED.actual_weight;

-- 6. ORDER STATUS EVENTS

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  '91dbb1c9-b2e9-4592-b5b7-a4321fca98d2', '247d2620-18c7-438c-ad47-e986e95c7a66', 'Pending',
  '2026-11-22T23:34:30.790581+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  'bf81aed8-b7ea-4c5f-a6f9-c9b937648e4b', '2f21139d-0e4f-46df-b2b7-10f67af49286', 'Pending',
  '2026-11-22T23:58:17.55713+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  'a0904861-edb8-4d18-9b74-901c64e5e6a1', '2f21139d-0e4f-46df-b2b7-10f67af49286', 'Assigned',
  '2026-11-22T23:59:48.525356+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  '69405d51-75e8-4db2-8872-cff5994d0788', '247d2620-18c7-438c-ad47-e986e95c7a66', 'Assigned',
  '2026-11-22T23:59:55.693434+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  '68a6b6b8-e9b9-4caf-a543-9fb62324929a', '2f21139d-0e4f-46df-b2b7-10f67af49286', 'Picked Up',
  '2026-11-23T00:02:38.047824+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_status_events (id, order_id, status, changed_at, changed_by, note)
VALUES (
  'b275cb30-50ff-4848-bd2c-444e44a01d62', '247d2620-18c7-438c-ad47-e986e95c7a66', 'Picked Up',
  '2026-11-23T00:03:38.99567+00:00', 'dc668c1f-2948-4e38-a5f4-40b9c692dc73', NULL
)
ON CONFLICT (id) DO NOTHING;

-- 7. ANNOUNCEMENTS

INSERT INTO public.announcements (
  id, title, content, author_id, is_active, created_at, updated_at,
  comments, send_email, emailed_at, cta_label, cta_url, audience
)
VALUES (
  'ada83c22-375a-4c59-acbb-1f108bb00cfe', 'Bagong Biyahe: Bohol → Manila', 'Bagong Biyahe! Mayroon kaming bagong scheduled trip papuntang Manila sa Sep 26, 2026. I-secure na ang slot ng inyong cargo habang may space pa!', '2e11107a-0275-4dff-917c-7c71b13fa2d4',
  true, '2026-09-26T10:01:02.976442+00:00', '2026-09-26T10:01:04.547527+00:00',
  '[]'::jsonb, true, '2026-09-26T10:01:04.547527+00:00',
  NULL, NULL, 'email_only'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active;

INSERT INTO public.announcements (
  id, title, content, author_id, is_active, created_at, updated_at,
  comments, send_email, emailed_at, cta_label, cta_url, audience
)
VALUES (
  'c2ef7b7b-cc6e-4d92-9354-663ef20c5007', 'Bagong Biyahe: Bohol → Manila', 'Bagong Biyahe! Mayroon kaming bagong scheduled trip papuntang Manila sa Sep 26, 2026. I-secure na ang slot ng inyong cargo habang may space pa!', '2e11107a-0275-4dff-917c-7c71b13fa2d4',
  true, '2026-09-26T10:01:42.360662+00:00', '2026-09-26T10:01:43.387413+00:00',
  '[]'::jsonb, true, '2026-09-26T10:01:43.387413+00:00',
  NULL, NULL, 'email_only'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active;

INSERT INTO public.announcements (
  id, title, content, author_id, is_active, created_at, updated_at,
  comments, send_email, emailed_at, cta_label, cta_url, audience
)
VALUES (
  '7df1e68c-deee-41af-b0e6-e59731b88887', 'Test', 'Jxjxzjziazjznzns sznsjzzjzjzjzjz', '2e11107a-0275-4dff-917c-7c71b13fa2d4',
  false, '2026-09-26T03:33:44.195685+00:00', '2026-09-27T10:30:03.638493+00:00',
  '[{"id":"25469ca4-3032-4fca-a4f7-bd810502c83c","name":"Joven Tibuc","text":"Hhdeheh","user_id":"bbc09b18-7206-4c9d-b0ac-a56fb566236d","created_at":"2026-09-27T10:18:29.962Z"}]'::jsonb, false, NULL,
  NULL, NULL, 'public'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active;

INSERT INTO public.announcements (
  id, title, content, author_id, is_active, created_at, updated_at,
  comments, send_email, emailed_at, cta_label, cta_url, audience
)
VALUES (
  'e96725d2-370f-488e-98ef-a7cbe7c3c0a9', 'Bagong Biyahe: Bohol → Manila', 'Bagong Biyahe! Mayroon kaming bagong scheduled trip papuntang Manila sa Sep 30, 2026. I-secure na ang slot ng inyong cargo habang may space pa!', '2e11107a-0275-4dff-917c-7c71b13fa2d4',
  true, '2026-09-28T03:31:27.635622+00:00', '2026-09-28T03:31:31.387754+00:00',
  '[]'::jsonb, true, '2026-09-28T03:31:31.387754+00:00',
  NULL, NULL, 'email_only'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active;
