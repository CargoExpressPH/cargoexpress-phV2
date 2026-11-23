-- ============================================================================
-- CargoExpress PH — Database Reset Script (Keep Admin & Keep Recent Trip)
-- Target: Supabase SQL Editor / PostgreSQL
--
-- Layunin (Goal):
--   1. I-reset / burahin ang lahat ng BOOKINGS (orders, tracking events, payments).
--   2. I-reset ang mga lumang TRIPS PERO IWAN / WAG BURAHIN ANG PINAKABAGONG TRIP (Recent Trip).
--   3. Burahin ang lahat ng CUSTOMERS (Non-Admin users) sa auth.users at public.profiles.
--   4. MAIWAN ANG ADMIN account(s) at ang credentials nila.
--   5. MAIWAN ang system settings (company_information, legal_documents, photo_storage_settings).
-- ============================================================================

BEGIN;

-- ── 1. SAFETY CHECK: Siguraduhing may Admin bago mag-reset ───────────────────
DO $$
DECLARE
    v_admin_count INT;
    v_admin_list TEXT;
BEGIN
    SELECT COUNT(*), string_agg(name || ' (' || email || ')', ', ')
    INTO v_admin_count, v_admin_list
    FROM public.profiles
    WHERE role = 'admin';

    IF v_admin_count = 0 THEN
        RAISE EXCEPTION 'ABORTING RESET: Walang nahanap na ADMIN user sa public.profiles! Kinansela ang script para maiwasan ang lockout.';
    END IF;

    RAISE NOTICE '>>> SAFETY CHECK PASSED: % admin account(s) nahanap: %', v_admin_count, v_admin_list;
    RAISE NOTICE '>>> Ang mga admin account na ito ay MAIIWAN at HINDI buburahin.';
END $$;

-- ── 2. TRUNCATE BOOKINGS, PAYMENTS, LOGS & TRANSACTIONS ──────────────────────
-- Note: Hindi kasama rito ang `trips` para maiwan ang recent trip!
DO $$
DECLARE
    v_tables TEXT[] := ARRAY[
        -- Box verification and shortfalls
        'public.box_scan_events',
        'public.loading_shortfall_exceptions',
        'public.supervisor_code_attempts',
        
        -- Orders & tracking history
        'public.order_status_events',
        'public.customer_feedback',
        'public.cancellation_settlement_history',
        'public.cancellation_settlements',
        
        -- Payments & refunds
        'public.payment_refunds',
        'public.payment_transactions',
        'public.payment_attempts',
        'private.paymongo_refund_recovery_jobs',
        'private.manual_refund_reauth_attempts',
        
        -- Photos & cleanup queues
        'public.photo_storage_events',
        'public.photo_cleanup_queue',
        
        -- Notifications & communications
        'public.notification_delivery_jobs',
        'public.notification_delivery_attempts',
        'public.notifications',
        'public.chat_messages',
        'public.conversations',
        'public.contact_inquiries',
        'public.announcement_email_recipients',
        'public.announcement_email_broadcasts',
        
        -- Audit logs & analytics
        'public.activity_logs',
        'public.chatbot_analytics',
        'public.chatbot_unanswered_queries',
        'public.email_usage_logs',
        'public.email_activity_log',
        'public.trip_reassignments',
        
        -- Core bookings entity
        'public.orders'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY v_tables LOOP
        IF to_regclass(t) IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE ' || t || ' RESTART IDENTITY CASCADE';
            RAISE NOTICE '>>> Truncated / Cleared: %', t;
        END IF;
    END LOOP;
END $$;

-- ── 3. CLEAN TRIPS (DELETE OLD TRIPS, KEEP THE MOST RECENT TRIP) ─────────────
DO $$
DECLARE
    v_recent_trip RECORD;
    v_deleted_trips_cnt INT := 0;
BEGIN
    -- Kunin ang pinakabagong trip na ginawa (most recent created trip)
    SELECT * INTO v_recent_trip
    FROM public.trips
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_recent_trip.id IS NOT NULL THEN
        RAISE NOTICE '>>> PINAKABAGONG TRIP (ITITIRA / HINDI BUBURAHIN):';
        RAISE NOTICE '    -> Trip Number: %', v_recent_trip.trip_number;
        RAISE NOTICE '    -> Route:       % -> %', v_recent_trip.origin, v_recent_trip.destination;
        RAISE NOTICE '    -> Departure:   %', v_recent_trip.departure_date;
        RAISE NOTICE '    -> Created At:  %', v_recent_trip.created_at;

        -- Burahin ang lahat ng lumang trips maliban sa recent trip na ito
        WITH deleted AS (
            DELETE FROM public.trips
            WHERE id <> v_recent_trip.id
            RETURNING id
        )
        SELECT COUNT(*) INTO v_deleted_trips_cnt FROM deleted;

        RAISE NOTICE '>>> Lumang trips na nabura: % (Naiwan ang 1 recent trip)', v_deleted_trips_cnt;
    ELSE
        RAISE NOTICE '>>> Walang nakitang trip sa database.';
    END IF;
END $$;

-- ── 4. DELETE NON-ADMIN USERS (Customers) ───────────────────────────────────
DO $$
DECLARE
    v_deleted_auth_users INT := 0;
    v_deleted_profiles INT := 0;
BEGIN
    -- 4a. Linisin ang device tokens, consents, at subscriptions ng non-admins
    IF to_regclass('public.user_device_tokens') IS NOT NULL THEN
        DELETE FROM public.user_device_tokens
        WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin');
    END IF;

    IF to_regclass('public.legal_consents') IS NOT NULL THEN
        DELETE FROM public.legal_consents
        WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin');
    END IF;

    IF to_regclass('public.email_subscriptions') IS NOT NULL THEN
        DELETE FROM public.email_subscriptions
        WHERE email NOT IN (SELECT email FROM public.profiles WHERE role = 'admin');
    END IF;

    -- 4b. Burahin ang mga non-admin users sa auth.users
    -- (Magka-cascade ito sa public.profiles dahil sa ON DELETE CASCADE)
    WITH deleted_auth AS (
        DELETE FROM auth.users
        WHERE id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_auth_users FROM deleted_auth;

    -- 4c. Siguraduhing walang naiwang non-admin sa public.profiles
    WITH deleted_prof AS (
        DELETE FROM public.profiles
        WHERE role <> 'admin' OR role IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_profiles FROM deleted_prof;

    RAISE NOTICE '>>> USERS DELETED: % account(s) sa auth.users at % profile(s) sa public.profiles.', 
        v_deleted_auth_users, v_deleted_profiles;
END $$;

-- ── 5. SUMMARY & VERIFICATION ───────────────────────────────────────────────
DO $$
DECLARE
    v_admin RECORD;
    v_trip RECORD;
    v_orders_cnt BIGINT := 0;
    v_trips_cnt BIGINT := 0;
    v_customer_profiles_cnt BIGINT := 0;
    v_customer_auth_cnt BIGINT := 0;
BEGIN
    SELECT COUNT(*) INTO v_orders_cnt FROM public.orders;
    SELECT COUNT(*) INTO v_trips_cnt FROM public.trips;
    SELECT COUNT(*) INTO v_customer_profiles_cnt FROM public.profiles WHERE role <> 'admin';
    SELECT COUNT(*) INTO v_customer_auth_cnt FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin');

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'DATABASE RESET STATUS SUMMARY:';
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'Orders remaining:             %', v_orders_cnt;
    RAISE NOTICE 'Trips remaining:              % (Recent Trip Maiiwan)', v_trips_cnt;
    RAISE NOTICE 'Non-Admin Profiles remaining:  %', v_customer_profiles_cnt;
    RAISE NOTICE 'Non-Admin Auth remaining:      %', v_customer_auth_cnt;
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'RETAINED RECENT TRIP:';
    FOR v_trip IN SELECT trip_number, origin, destination, departure_date FROM public.trips LOOP
        RAISE NOTICE '-> Trip: % (% -> %) | Departure: %', v_trip.trip_number, v_trip.origin, v_trip.destination, v_trip.departure_date;
    END LOOP;
    RAISE NOTICE '-------------------------------------------------------';
    RAISE NOTICE 'RETAINED ADMIN ACCOUNT(S):';
    FOR v_admin IN SELECT id, email, name, role FROM public.profiles WHERE role = 'admin' LOOP
        RAISE NOTICE '-> Admin: % | Email: % | ID: %', v_admin.name, v_admin.email, v_admin.id;
    END LOOP;
    RAISE NOTICE '=======================================================';
END $$;

COMMIT;
