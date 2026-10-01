--
-- PostgreSQL database dump
--

\restrict dZ7H9nfN0KU4w2PLVivk3J4CzjXMIZ6P6aWM414GzTmfkJiQ1jAAgW0pRSuwQbK

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select nullif(current_setting('request.jwt.claim.email', true), '')::text;
$$;


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
      $$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
    revoke trigger on cron.job_run_details from postgres cascade;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
begin
    if not exists (
        select 1
        from pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: derive_order_payment_state(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.derive_order_payment_state(p_total_payable numeric, p_net_allocated numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_total_payable < 0 THEN
    RETURN 'invalid_negative_payable';
  END IF;

  IF p_net_allocated > p_total_payable THEN
    RETURN 'overpaid';
  ELSIF p_net_allocated = p_total_payable THEN
    RETURN 'paid';
  ELSIF p_net_allocated > 0 AND p_net_allocated < p_total_payable THEN
    RETURN 'partial';
  ELSE
    RETURN 'unpaid';
  END IF;
END;
$$;


--
-- Name: FUNCTION derive_order_payment_state(p_total_payable numeric, p_net_allocated numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.derive_order_payment_state(p_total_payable numeric, p_net_allocated numeric) IS 'CF1-D07 derived order payment state: unpaid, partial, paid, overpaid, invalid_negative_payable.';


--
-- Name: enforce_financial_allocation_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_financial_allocation_immutability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_setting('cradlehub.allow_financial_mutation', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'FINANCIAL_ALLOCATION_IMMUTABILITY_VIOLATION: Committed financial order allocations are append-only. Destructive % is prohibited.', TG_OP
    USING ERRCODE = '55000';
END;
$$;


--
-- Name: enforce_financial_ledger_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_financial_ledger_immutability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Allow bypass only if explicitly authorized via a session-local config (e.g. for emergency maintenance by superusers)
  IF current_setting('cradlehub.allow_financial_mutation', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'FINANCIAL_IMMUTABILITY_VIOLATION: Committed financial transactions and movements are append-only. Destructive % is prohibited.', TG_OP
    USING ERRCODE = '55000';
END;
$$;


--
-- Name: fn_validate_financial_order_allocation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validate_financial_order_allocation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_movement_amount     NUMERIC(12,2);
  v_movement_branch_id  UUID;
  v_total_allocated     NUMERIC(12,2);
  v_order_branch_id     UUID;
  v_item_order_id       UUID;
BEGIN
  -- 1. Validate movement exists and has positive amount (customer payment inflow)
  SELECT fam.amount, fa.branch_id
  INTO v_movement_amount, v_movement_branch_id
  FROM public.financial_account_movements fam
  JOIN public.financial_accounts fa ON fa.id = fam.financial_account_id
  WHERE fam.id = NEW.financial_account_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_MOVEMENT: movement % not found', NEW.financial_account_movement_id
      USING ERRCODE = '23503';
  END IF;

  IF v_movement_amount <= 0 THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_MOVEMENT_AMOUNT: cannot allocate non-positive movement (amount: %)', v_movement_amount
      USING ERRCODE = '22023';
  END IF;

  -- 2. Validate order exists
  SELECT bo.branch_id
  INTO v_order_branch_id
  FROM public.booking_orders bo
  WHERE bo.id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_ORDER: order % not found', NEW.order_id
      USING ERRCODE = '23503';
  END IF;

  -- 3. If movement account is branch-scoped, ensure branch matches order branch
  IF v_movement_branch_id IS NOT NULL AND v_movement_branch_id <> v_order_branch_id THEN
    RAISE EXCEPTION 'ALLOCATION_BRANCH_MISMATCH: movement branch % does not match order branch %',
      v_movement_branch_id, v_order_branch_id
      USING ERRCODE = '22023';
  END IF;

  -- 4. If payable_item_id is specified, ensure it belongs to the same order_id
  IF NEW.payable_item_id IS NOT NULL THEN
    SELECT opi.order_id
    INTO v_item_order_id
    FROM public.order_payable_items opi
    WHERE opi.id = NEW.payable_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ALLOCATION_INVALID_PAYABLE_ITEM: payable item % not found', NEW.payable_item_id
        USING ERRCODE = '23503';
    END IF;

    IF v_item_order_id <> NEW.order_id THEN
      RAISE EXCEPTION 'CROSS_ORDER_ITEM_MISMATCH: payable item % belongs to order %, not %',
        NEW.payable_item_id, v_item_order_id, NEW.order_id
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5. Validate that total allocations for this movement do not exceed movement.amount
  SELECT coalesce(SUM(amount), 0)
  INTO v_total_allocated
  FROM public.financial_order_allocations
  WHERE financial_account_movement_id = NEW.financial_account_movement_id
    AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_total_allocated + NEW.amount) > v_movement_amount THEN
    RAISE EXCEPTION 'ALLOCATION_EXCEEDS_MOVEMENT: total allocation % exceeds movement amount %',
      (v_total_allocated + NEW.amount), v_movement_amount
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_validate_order_payable_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validate_order_payable_item() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_booking_order_id UUID;
BEGIN
  -- Service charge type requires booking_id
  IF NEW.charge_type = 'service' AND NEW.booking_id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_PAYABLE_REQUIRES_BOOKING: charge_type service requires booking_id'
      USING ERRCODE = '22023';
  END IF;

  -- If booking_id is provided, verify it belongs to the same order_id
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.order_id
    INTO v_booking_order_id
    FROM public.bookings b
    WHERE b.id = NEW.booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYABLE_BOOKING_NOT_FOUND: booking % not found', NEW.booking_id
        USING ERRCODE = '23503';
    END IF;

    IF v_booking_order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'CROSS_ORDER_BOOKING_MISMATCH: booking % belongs to order %, not %',
        NEW.booking_id, v_booking_order_id, NEW.order_id
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: get_auth_branch_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_branch_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    DECLARE
      v_branch_id UUID;
    BEGIN
      SELECT s.branch_id INTO v_branch_id
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND s.is_active = true
      LIMIT 1;
      RETURN v_branch_id;
    END;
    $$;


--
-- Name: get_auth_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_role() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    DECLARE
      v_role TEXT;
    BEGIN
      SELECT s.role INTO v_role
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND s.is_active = true
      LIMIT 1;
      RETURN coalesce(v_role, 'anon');
    END;
    $$;


--
-- Name: post_cash_adjustment_atomic(uuid, uuid, text, numeric, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_cash_adjustment_atomic(p_branch_id uuid, p_financial_account_id uuid, p_adjustment_type text, p_amount numeric, p_reason text, p_business_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_amount          NUMERIC(12,2);
  v_signed_amount   NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Adjustment amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_adjustment_type NOT IN ('addition', 'removal') THEN
    RAISE EXCEPTION 'INVALID_ADJUSTMENT_TYPE: Type must be addition or removal';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Reason for cash adjustment is required';
  END IF;

  -- Signed amount: addition is positive, removal is negative
  IF p_adjustment_type = 'addition' THEN
    v_signed_amount := v_amount;
  ELSE
    v_signed_amount := -v_amount;
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    SELECT * INTO v_staff FROM public.staff WHERE is_active = true ORDER BY created_at LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to adjust cash';
    END IF;
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_signed_amount
      );
    END IF;
  END IF;

  -- Account check: must be cash_drawer
  SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.account_type <> 'cash_drawer' THEN
    RAISE EXCEPTION 'CASH_DRAWER_REQUIRED: Cash adjustments can only be performed on cash_drawer accounts';
  END IF;
  IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: cash_adjustment
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    TRIM(p_reason) || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN ' — ' || TRIM(p_notes) ELSE '' END
  ) RETURNING id INTO v_transaction_id;

  -- Signed Movement
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    v_signed_amount,
    'cash',
    v_now
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'amount', v_signed_amount,
    'adjustmentType', p_adjustment_type,
    'idempotentReplay', false
  );
END;
$$;


--
-- Name: post_expense_atomic(uuid, text, numeric, uuid, uuid, text, text, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_expense_atomic(p_branch_id uuid, p_idempotency_key text, p_amount numeric, p_category_id uuid, p_financial_account_id uuid, p_payee text, p_description text, p_receipt_reference text DEFAULT NULL::text, p_business_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_category        RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_expense_id      UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  -- 1. Input sanity
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Expense amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_REQUIRED: Expense category is required';
  END IF;

  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial payment account is required';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED: Expense description is required';
  END IF;

  -- 2. Actor authentication & authorization
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    SELECT * INTO v_staff FROM public.staff WHERE is_active = true ORDER BY created_at LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to post expense';
    END IF;
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  -- Determine effective branch
  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED: Branch ID is required';
  END IF;

  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  -- 4. Validate category
  SELECT * INTO v_category FROM public.financial_expense_categories
  WHERE id = p_category_id AND is_active = true;
  IF v_category.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CATEGORY: Expense category does not exist or is inactive';
  END IF;

  -- 5. Validate financial account
  SELECT * INTO v_account FROM public.financial_accounts
  WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account does not belong to branch %', p_branch_id;
  END IF;

  -- 6. Business date
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 7. Insert Canonical Financial Transaction Header
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    source_type,
    source_id,
    external_reference,
    notes
  ) VALUES (
    p_branch_id,
    'operational_expense',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    'payroll_run', -- generic internal source
    NULL,
    p_receipt_reference,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 8. Insert Negative Account Movement (Outflow = -amount per CF1-D08)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    external_reference,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    -v_amount, -- NEGATIVE SIGNED OUTFLOW
    CASE v_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_account.account_type
    END,
    p_receipt_reference,
    v_now
  ) RETURNING id INTO v_movement_id;

  -- 9. Insert Expense Detail
  INSERT INTO public.financial_expense_details (
    transaction_id,
    category_id,
    payee,
    description,
    receipt_reference,
    approval_status,
    approved_by,
    notes,
    created_at
  ) VALUES (
    v_transaction_id,
    v_category.id,
    COALESCE(TRIM(p_payee), 'Direct Vendor'),
    TRIM(p_description),
    p_receipt_reference,
    'approved_instant',
    v_staff.id,
    p_notes,
    v_now
  ) RETURNING id INTO v_expense_id;

  -- 10. Return canonical result
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'expenseDetailId', v_expense_id,
    'amount', v_amount,
    'category', v_category.name,
    'account', v_account.name,
    'businessDate', v_business_date,
    'idempotentReplay', false
  );
END;
$$;


--
-- Name: post_misc_income_atomic(uuid, uuid, numeric, text, text, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_misc_income_atomic(p_branch_id uuid, p_financial_account_id uuid, p_amount numeric, p_description text, p_payee_source text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_business_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_commercial_id   UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Income amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial receiving account is required';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED: Income description is required';
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    SELECT * INTO v_staff FROM public.staff WHERE is_active = true ORDER BY created_at LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to record misc income';
    END IF;
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: other_income
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'other_income',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- Positive Inflow Movement
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    v_amount, -- POSITIVE INFLOW
    CASE 
      WHEN p_payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN p_payment_method
      WHEN v_account.account_type = 'cash_drawer' THEN 'cash'
      WHEN v_account.account_type = 'card_terminal' THEN 'card'
      ELSE v_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_movement_id;

  -- Commercial Detail: misc_income (CF1-D15, no fake booking)
  INSERT INTO public.financial_commercial_details (
    transaction_id,
    commercial_type,
    description,
    payee_source,
    notes,
    created_at
  ) VALUES (
    v_transaction_id,
    'misc_income',
    TRIM(p_description),
    p_payee_source,
    p_notes,
    v_now
  ) RETURNING id INTO v_commercial_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'amount', v_amount,
    'account', v_account.name,
    'idempotentReplay', false
  );
END;
$$;


--
-- Name: post_order_payment_atomic(uuid, text, jsonb, jsonb, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_order_payment_atomic(p_order_id uuid, p_idempotency_key text, p_payments jsonb, p_allocations jsonb DEFAULT NULL::jsonb, p_business_date date DEFAULT NULL::date, p_external_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid            UUID;
  v_staff               RECORD;
  v_order               RECORD;
  v_existing_tx         RECORD;
  v_existing_total      NUMERIC(12,2);
  v_total_payable       NUMERIC(12,2);
  v_net_allocated       NUMERIC(12,2);
  v_remaining_balance   NUMERIC(12,2);
  v_total_payment       NUMERIC(12,2) := 0.00;
  v_business_date       DATE;
  v_now                 TIMESTAMPTZ := clock_timestamp();
  v_transaction_id      UUID;
  
  -- Iteration variables
  v_part                JSONB;
  v_part_amount         NUMERIC(12,2);
  v_part_method         TEXT;
  v_part_account_id     UUID;
  v_part_ext_ref        TEXT;
  v_account             RECORD;
  v_movement_id         UUID;
  v_alloc_item          JSONB;
  v_alloc_amount        NUMERIC(12,2);
  v_alloc_item_id       UUID;
  v_alloc_sum           NUMERIC(12,2) := 0.00;
  v_payable_item        RECORD;
  
  -- Tracking arrays for movements and allocations
  v_movements_json      JSONB := '[]'::jsonb;
  v_allocations_json    JSONB := '[]'::jsonb;
  v_movement_ids        UUID[] := ARRAY[]::UUID[];
  v_movement_amounts    NUMERIC(12,2)[] := ARRAY[]::NUMERIC(12,2)[];
  v_movement_rem        NUMERIC(12,2)[] := ARRAY[]::NUMERIC(12,2)[];
  v_mov_idx             INT;
  v_alloc_take          NUMERIC(12,2);
  v_new_net_allocated   NUMERIC(12,2);
  v_new_remaining       NUMERIC(12,2);
  v_new_state           TEXT;
BEGIN
  -- 1. Input sanity validation
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ID_REQUIRED: Booking order ID is required';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required';
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'PAYMENTS_REQUIRED: At least one payment part is required';
  END IF;

  -- 2. Concurrency serialization: Acquire advisory transaction lock for idempotency key
  PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || p_idempotency_key));

  -- 3. Row lock on booking order
  SELECT id, branch_id, organizer_customer_id, booking_date
  INTO v_order
  FROM public.booking_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Booking order % does not exist', p_order_id;
  END IF;

  -- 4. Authenticated identity & staff resolution
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Unauthenticated caller cannot post payments';
  END IF;

  SELECT s.id, s.branch_id, s.role, s.is_active
  INTO v_staff
  FROM public.staff s
  WHERE s.auth_user_id = v_auth_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user %', v_auth_uid;
  END IF;

  IF NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_INACTIVE: Staff member % is inactive', v_staff.id;
  END IF;

  -- 5. Branch permission verification
  IF v_staff.role <> 'owner' AND v_staff.branch_id <> v_order.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Staff % (branch %) unauthorized for order in branch %',
      v_staff.id, v_staff.branch_id, v_order.branch_id;
  END IF;

  -- 6. Validate payment parts & rails
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_part->>'amount') IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment part missing amount';
    END IF;

    v_part_amount := (v_part->>'amount')::numeric;
    IF v_part_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment amount must be positive, got %', v_part_amount;
    END IF;

    v_part_method := (v_part->>'payment_method');
    IF v_part_method IS NULL OR v_part_method NOT IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Unsupported payment method %', v_part_method;
    END IF;

    IF (v_part->>'financial_account_id') IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED: Financial account ID required for payment method %', v_part_method;
    END IF;

    v_part_account_id := (v_part->>'financial_account_id')::uuid;

    SELECT id, branch_id, account_type, is_active, currency
    INTO v_account
    FROM public.financial_accounts
    WHERE id = v_part_account_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account % does not exist', v_part_account_id;
    END IF;

    IF NOT v_account.is_active THEN
      RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account % is inactive', v_part_account_id;
    END IF;

    IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> v_order.branch_id THEN
      RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account % belongs to branch %, not order branch %',
        v_part_account_id, v_account.branch_id, v_order.branch_id;
    END IF;

    -- Strict rail/account_type compatibility
    IF (v_part_method = 'cash' AND v_account.account_type <> 'cash_drawer') OR
       (v_part_method = 'gcash' AND v_account.account_type <> 'gcash') OR
       (v_part_method = 'maya' AND v_account.account_type <> 'maya') OR
       (v_part_method = 'bank_transfer' AND v_account.account_type <> 'bank_transfer') OR
       (v_part_method = 'card' AND v_account.account_type <> 'card_terminal') THEN
      RAISE EXCEPTION 'ACCOUNT_TYPE_MISMATCH: Payment method % is incompatible with account type %',
        v_part_method, v_account.account_type;
    END IF;

    IF v_account.currency <> 'PHP' THEN
      RAISE EXCEPTION 'INVALID_CURRENCY: Financial account currency must be PHP, got %', v_account.currency;
    END IF;

    v_total_payment := v_total_payment + v_part_amount;
  END LOOP;

  -- 7. Idempotency Check (Retry-safe replay suppression)
  SELECT id, branch_id, transaction_type, status, business_date, source_type, source_id
  INTO v_existing_tx
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Check for conflicting payload under same key
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_existing_total
    FROM public.financial_account_movements
    WHERE transaction_id = v_existing_tx.id;

    IF v_existing_tx.source_id <> p_order_id::text OR
       v_existing_tx.source_type <> 'booking_order' OR
       v_existing_total <> v_total_payment THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key % already used for conflicting transaction %',
        p_idempotency_key, v_existing_tx.id;
    END IF;

    -- Return existing transaction details and summary
    SELECT
      jsonb_agg(jsonb_build_object(
        'id', fam.id,
        'financial_account_id', fam.financial_account_id,
        'amount', fam.amount,
        'payment_method', fam.payment_method,
        'external_reference', fam.external_reference
      ))
    INTO v_movements_json
    FROM public.financial_account_movements fam
    WHERE fam.transaction_id = v_existing_tx.id;

    SELECT
      jsonb_agg(jsonb_build_object(
        'id', foa.id,
        'payable_item_id', foa.payable_item_id,
        'amount', foa.amount
      ))
    INTO v_allocations_json
    FROM public.financial_order_allocations foa
    WHERE foa.order_id = p_order_id
      AND foa.financial_account_movement_id IN (
        SELECT id FROM public.financial_account_movements WHERE transaction_id = v_existing_tx.id
      );

    -- Current financial summary
    SELECT
      COALESCE(SUM(amount), 0.00) INTO v_total_payable
    FROM public.order_payable_items
    WHERE order_id = p_order_id;

    SELECT
      COALESCE(SUM(amount), 0.00) INTO v_net_allocated
    FROM public.financial_order_allocations
    WHERE order_id = p_order_id;

    v_remaining_balance := v_total_payable - v_net_allocated;
    v_new_state := public.derive_order_payment_state(v_total_payable, v_net_allocated);

    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent_replay', true,
      'transaction_id', v_existing_tx.id,
      'order_id', p_order_id,
      'branch_id', v_existing_tx.branch_id,
      'business_date', v_existing_tx.business_date,
      'total_paid', v_existing_total,
      'total_payable', v_total_payable,
      'net_allocated', v_net_allocated,
      'remaining_balance', v_remaining_balance,
      'payment_state', v_new_state,
      'movements', COALESCE(v_movements_json, '[]'::jsonb),
      'allocations', COALESCE(v_allocations_json, '[]'::jsonb)
    );
  END IF;

  -- 8. Order Payable and Balance Validation
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_total_payable
  FROM public.order_payable_items
  WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_net_allocated
  FROM public.financial_order_allocations
  WHERE order_id = p_order_id;

  IF v_total_payable < 0 THEN
    RAISE EXCEPTION 'INVALID_NEGATIVE_PAYABLE: Total payable is negative (%)', v_total_payable;
  END IF;

  IF v_total_payable = 0 THEN
    RAISE EXCEPTION 'ZERO_PAYABLE_ORDER: Order has zero payable, no payment required';
  END IF;

  v_remaining_balance := v_total_payable - v_net_allocated;

  IF v_remaining_balance <= 0 THEN
    RAISE EXCEPTION 'ORDER_ALREADY_PAID: Order remaining balance is zero';
  END IF;

  -- Overpayment policy: Reject payments exceeding remaining balance in CF4
  IF v_total_payment > v_remaining_balance THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_REMAINING_BALANCE: Total payment % exceeds remaining balance %',
      v_total_payment, v_remaining_balance;
  END IF;

  -- 9. Explicit Allocations Validation (if provided)
  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array' AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      IF (v_alloc_item->>'amount') IS NULL THEN
        RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT: Allocation missing amount';
      END IF;

      v_alloc_amount := (v_alloc_item->>'amount')::numeric;
      IF v_alloc_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT: Allocation amount must be positive, got %', v_alloc_amount;
      END IF;

      IF (v_alloc_item->>'payable_item_id') IS NULL THEN
        RAISE EXCEPTION 'PAYABLE_ITEM_REQUIRED: Explicit allocation requires payable_item_id';
      END IF;

      v_alloc_item_id := (v_alloc_item->>'payable_item_id')::uuid;

      SELECT id, order_id
      INTO v_payable_item
      FROM public.order_payable_items
      WHERE id = v_alloc_item_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYABLE_ITEM_NOT_FOUND: Payable item % does not exist', v_alloc_item_id;
      END IF;

      IF v_payable_item.order_id <> p_order_id THEN
        RAISE EXCEPTION 'CROSS_ORDER_ITEM_MISMATCH: Payable item % belongs to order %, not order %',
          v_alloc_item_id, v_payable_item.order_id, p_order_id;
      END IF;

      v_alloc_sum := v_alloc_sum + v_alloc_amount;
    END LOOP;

    IF v_alloc_sum <> v_total_payment THEN
      RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH: Sum of allocations % does not equal total payment %',
        v_alloc_sum, v_total_payment;
    END IF;
  END IF;

  -- 10. Atomic Execution: Insert Transaction Header
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  INSERT INTO public.financial_transactions (
    id,
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    source_type,
    source_id,
    external_reference,
    notes
  ) VALUES (
    gen_random_uuid(),
    v_order.branch_id,
    'customer_payment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    'booking_order',
    p_order_id::text,
    p_external_reference,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 11. Atomic Execution: Insert Movements
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_part_amount := (v_part->>'amount')::numeric;
    v_part_method := (v_part->>'payment_method');
    v_part_account_id := (v_part->>'financial_account_id')::uuid;
    v_part_ext_ref := (v_part->>'external_reference');

    INSERT INTO public.financial_account_movements (
      id,
      transaction_id,
      financial_account_id,
      amount,
      payment_method,
      external_reference
    ) VALUES (
      gen_random_uuid(),
      v_transaction_id,
      v_part_account_id,
      v_part_amount,
      v_part_method,
      v_part_ext_ref
    ) RETURNING id INTO v_movement_id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);
    v_movement_amounts := array_append(v_movement_amounts, v_part_amount);
    v_movement_rem := array_append(v_movement_rem, v_part_amount);

    v_movements_json := v_movements_json || jsonb_build_object(
      'id', v_movement_id,
      'financial_account_id', v_part_account_id,
      'amount', v_part_amount,
      'payment_method', v_part_method,
      'external_reference', v_part_ext_ref
    );
  END LOOP;

  -- 12. Atomic Execution: Insert Allocations
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    -- A. Default Order-Level Allocations: 1 allocation per movement for full movement amount
    FOR i IN 1..array_length(v_movement_ids, 1)
    LOOP
      DECLARE
        v_alloc_id UUID;
      BEGIN
        INSERT INTO public.financial_order_allocations (
          id,
          financial_account_movement_id,
          order_id,
          payable_item_id,
          amount,
          created_by
        ) VALUES (
          gen_random_uuid(),
          v_movement_ids[i],
          p_order_id,
          NULL,
          v_movement_amounts[i],
          v_staff.id
        ) RETURNING id INTO v_alloc_id;

        v_allocations_json := v_allocations_json || jsonb_build_object(
          'id', v_alloc_id,
          'financial_account_movement_id', v_movement_ids[i],
          'payable_item_id', NULL,
          'amount', v_movement_amounts[i]
        );
      END;
    END LOOP;
  ELSE
    -- B. Explicit Item-Level Allocations
    -- Distribute items against movements deterministically without exceeding any movement
    v_mov_idx := 1;
    FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_alloc_amount := (v_alloc_item->>'amount')::numeric;
      v_alloc_item_id := (v_alloc_item->>'payable_item_id')::uuid;

      WHILE v_alloc_amount > 0 AND v_mov_idx <= array_length(v_movement_ids, 1)
      LOOP
        IF v_movement_rem[v_mov_idx] <= 0 THEN
          v_mov_idx := v_mov_idx + 1;
          CONTINUE;
        END IF;

        v_alloc_take := LEAST(v_alloc_amount, v_movement_rem[v_mov_idx]);

        DECLARE
          v_alloc_id UUID;
        BEGIN
          INSERT INTO public.financial_order_allocations (
            id,
            financial_account_movement_id,
            order_id,
            payable_item_id,
            amount,
            created_by
          ) VALUES (
            gen_random_uuid(),
            v_movement_ids[v_mov_idx],
            p_order_id,
            v_alloc_item_id,
            v_alloc_take,
            v_staff.id
          ) RETURNING id INTO v_alloc_id;

          v_allocations_json := v_allocations_json || jsonb_build_object(
            'id', v_alloc_id,
            'financial_account_movement_id', v_movement_ids[v_mov_idx],
            'payable_item_id', v_alloc_item_id,
            'amount', v_alloc_take
          );
        END;

        v_movement_rem[v_mov_idx] := v_movement_rem[v_mov_idx] - v_alloc_take;
        v_alloc_amount := v_alloc_amount - v_alloc_take;

        IF v_movement_rem[v_mov_idx] <= 0 THEN
          v_mov_idx := v_mov_idx + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- 13. Derive Final State
  v_new_net_allocated := v_net_allocated + v_total_payment;
  v_new_remaining := v_total_payable - v_new_net_allocated;
  v_new_state := public.derive_order_payment_state(v_total_payable, v_new_net_allocated);

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent_replay', false,
    'transaction_id', v_transaction_id,
    'order_id', p_order_id,
    'branch_id', v_order.branch_id,
    'business_date', v_business_date,
    'total_paid', v_total_payment,
    'total_payable', v_total_payable,
    'net_allocated', v_new_net_allocated,
    'remaining_balance', v_new_remaining,
    'payment_state', v_new_state,
    'movements', v_movements_json,
    'allocations', v_allocations_json
  );
END;
$$;


--
-- Name: FUNCTION post_order_payment_atomic(p_order_id uuid, p_idempotency_key text, p_payments jsonb, p_allocations jsonb, p_business_date date, p_external_reference text, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.post_order_payment_atomic(p_order_id uuid, p_idempotency_key text, p_payments jsonb, p_allocations jsonb, p_business_date date, p_external_reference text, p_notes text) IS 'Canonical atomic payment writer for booking orders. Secures transaction header, movements, allocations, idempotency replay, and derived payment balance state.';


--
-- Name: post_tip_atomic(uuid, uuid, text, numeric, uuid, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_tip_atomic(p_branch_id uuid, p_beneficiary_staff_id uuid, p_custody_type text, p_amount numeric, p_financial_account_id uuid DEFAULT NULL::uuid, p_payment_method text DEFAULT 'cash'::text, p_business_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_beneficiary     RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID := NULL;
  v_tip_id          UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  -- 1. Input sanity
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Tip amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_beneficiary_staff_id IS NULL THEN
    RAISE EXCEPTION 'BENEFICIARY_REQUIRED: Beneficiary staff member is required';
  END IF;

  IF p_custody_type NOT IN ('direct_cash', 'company_custodied') THEN
    RAISE EXCEPTION 'INVALID_CUSTODY: Custody type must be direct_cash or company_custodied';
  END IF;

  -- 2. Actor authentication & authorization
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    SELECT * INTO v_staff FROM public.staff WHERE is_active = true ORDER BY created_at LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to record tip';
    END IF;
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  -- Effective branch
  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Validate beneficiary staff
  SELECT * INTO v_beneficiary FROM public.staff WHERE id = p_beneficiary_staff_id AND is_active = true;
  IF v_beneficiary.id IS NULL THEN
    RAISE EXCEPTION 'BENEFICIARY_NOT_FOUND: Active staff member not found for ID %', p_beneficiary_staff_id;
  END IF;

  IF v_beneficiary.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_beneficiary.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BENEFICIARY_BRANCH_MISMATCH: Beneficiary staff belongs to branch %, not %', v_beneficiary.branch_id, p_branch_id;
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 4. Insert Canonical Financial Transaction Header
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'tip_collection',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 5. Custody-dependent Money Movement (CF1-D09)
  IF p_custody_type = 'company_custodied' THEN
    IF p_financial_account_id IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial account is required for company-custodied tips';
    END IF;

    SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
    IF v_account.id IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
    END IF;
    IF NOT v_account.is_active THEN
      RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
    END IF;
    IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
    END IF;

    -- Positive inflow: company drawer/wallet holds the tip liability
    INSERT INTO public.financial_account_movements (
      transaction_id,
      financial_account_id,
      amount,
      payment_method,
      created_at
    ) VALUES (
      v_transaction_id,
      v_account.id,
      v_amount, -- POSITIVE INFLOW
      CASE 
        WHEN p_payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN p_payment_method
        WHEN v_account.account_type = 'cash_drawer' THEN 'cash'
        WHEN v_account.account_type = 'card_terminal' THEN 'card'
        ELSE v_account.account_type
      END,
      v_now
    ) RETURNING id INTO v_movement_id;

    -- Tip detail: pending disbursement to staff
    INSERT INTO public.financial_tip_details (
      transaction_id,
      beneficiary_staff_id,
      tip_amount,
      custody_type,
      payout_status,
      notes,
      created_at
    ) VALUES (
      v_transaction_id,
      v_beneficiary.id,
      v_amount,
      'company_custodied',
      'pending_disbursement',
      p_notes,
      v_now
    ) RETURNING id INTO v_tip_id;
  ELSE
    -- Direct Cash Tip: zero company custody, zero account movement (CF1-D09)
    INSERT INTO public.financial_tip_details (
      transaction_id,
      beneficiary_staff_id,
      tip_amount,
      custody_type,
      payout_status,
      notes,
      created_at
    ) VALUES (
      v_transaction_id,
      v_beneficiary.id,
      v_amount,
      'direct_cash',
      'not_applicable',
      p_notes,
      v_now
    ) RETURNING id INTO v_tip_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'tipDetailId', v_tip_id,
    'amount', v_amount,
    'beneficiary', v_beneficiary.full_name,
    'custodyType', p_custody_type,
    'idempotentReplay', false
  );
END;
$$;


--
-- Name: post_transfer_atomic(uuid, uuid, uuid, numeric, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_transfer_atomic(p_branch_id uuid, p_source_account_id uuid, p_destination_account_id uuid, p_amount numeric, p_business_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_src_account     RECORD;
  v_dst_account     RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_outflow_id      UUID;
  v_inflow_id       UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Transfer amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTS_REQUIRED: Both source and destination accounts are required';
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'IDENTICAL_ACCOUNTS: Source and destination accounts cannot be identical';
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    SELECT * INTO v_staff FROM public.staff WHERE is_active = true ORDER BY created_at LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to perform transfer';
    END IF;
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_src_account FROM public.financial_accounts WHERE id = p_source_account_id;
  IF v_src_account.id IS NULL OR NOT v_src_account.is_active THEN
    RAISE EXCEPTION 'SOURCE_ACCOUNT_INVALID: Source account is invalid or inactive';
  END IF;
  IF v_src_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_src_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Source account belongs to branch %, not %', v_src_account.branch_id, p_branch_id;
  END IF;

  SELECT * INTO v_dst_account FROM public.financial_accounts WHERE id = p_destination_account_id;
  IF v_dst_account.id IS NULL OR NOT v_dst_account.is_active THEN
    RAISE EXCEPTION 'DESTINATION_ACCOUNT_INVALID: Destination account is invalid or inactive';
  END IF;
  IF v_dst_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_dst_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Destination account belongs to branch %, not %', v_dst_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: cash_adjustment (transfer context)
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    'Transfer: ' || v_src_account.name || ' -> ' || v_dst_account.name || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN ' — ' || TRIM(p_notes) ELSE '' END
  ) RETURNING id INTO v_transaction_id;

  -- Outflow Movement (-amount)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_src_account.id,
    -v_amount,
    CASE v_src_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_src_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_outflow_id;

  -- Inflow Movement (+amount)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_dst_account.id,
    v_amount,
    CASE v_dst_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_dst_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_inflow_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'outflowMovementId', v_outflow_id,
    'inflowMovementId', v_inflow_id,
    'amount', v_amount,
    'sourceAccount', v_src_account.name,
    'destinationAccount', v_dst_account.name,
    'netEffect', 0.00,
    'idempotentReplay', false
  );
END;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    DECLARE
      _filename text;
      _parts text[];
    BEGIN
      _filename := storage.filename(name);
      _parts := string_to_array(_filename, '.');
      IF array_length(_parts, 1) > 1 THEN
        RETURN _parts[array_length(_parts, 1)];
      ELSE
        RETURN '';
      END IF;
    END;
    $$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    DECLARE
      _parts text[];
    BEGIN
      _parts := string_to_array(name, '/');
      RETURN _parts[array_length(_parts, 1)];
    END;
    $$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    DECLARE
      _parts text[];
    BEGIN
      _parts := string_to_array(name, '/');
      RETURN _parts[1:array_length(_parts, 1) - 1];
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: booking_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    order_number text NOT NULL,
    organizer_customer_id uuid,
    delivery_type text DEFAULT 'in_spa'::text NOT NULL,
    booking_date date DEFAULT CURRENT_DATE NOT NULL,
    currency text DEFAULT 'PHP'::text NOT NULL,
    payment_preference text DEFAULT 'pay_at_spa'::text NOT NULL,
    idempotency_key text,
    payload_hash text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    type text DEFAULT 'standard'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: booking_payment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_payment_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    changed_by uuid,
    old_payment_method text,
    old_payment_status text,
    old_amount_paid numeric(12,2),
    old_payment_reference text,
    new_payment_method text,
    new_payment_status text,
    new_amount_paid numeric(12,2),
    new_payment_reference text,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    service_id uuid,
    staff_id uuid,
    customer_id uuid,
    order_id uuid,
    attendee_id uuid,
    booking_date date DEFAULT CURRENT_DATE NOT NULL,
    start_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    end_time time without time zone DEFAULT '10:00:00'::time without time zone NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: financial_account_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_account_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    financial_account_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method text NOT NULL,
    external_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_financial_account_movement_non_zero CHECK ((amount <> (0)::numeric)),
    CONSTRAINT financial_account_movements_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'gcash'::text, 'maya'::text, 'bank_transfer'::text, 'card'::text])))
);


--
-- Name: TABLE financial_account_movements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_account_movements IS 'Authoritative signed monetary movements on financial accounts (+ = enters account, - = leaves account).';


--
-- Name: COLUMN financial_account_movements.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_account_movements.amount IS 'Signed monetary value (+ = inflow, - = outflow). Zero is strictly prohibited.';


--
-- Name: financial_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid,
    name text NOT NULL,
    account_type text NOT NULL,
    identifier_mask text NOT NULL,
    currency text DEFAULT 'PHP'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['cash_drawer'::text, 'gcash'::text, 'maya'::text, 'bank_transfer'::text, 'card_terminal'::text]))),
    CONSTRAINT financial_accounts_currency_check CHECK ((currency = 'PHP'::text))
);


--
-- Name: TABLE financial_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_accounts IS 'Catalog of physical and digital accounts (cash drawers, GCash, Maya, Bank, Card terminals).';


--
-- Name: COLUMN financial_accounts.branch_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_accounts.branch_id IS 'Branch ownership; NULL denotes corporate/HQ level financial account.';


--
-- Name: COLUMN financial_accounts.identifier_mask; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_accounts.identifier_mask IS 'Safe display identifier for front-desk staff (e.g. *1234 or 0917-***-5678).';


--
-- Name: financial_commercial_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_commercial_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    commercial_type text NOT NULL,
    description text NOT NULL,
    payee_source text,
    reference text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT financial_commercial_details_commercial_type_check CHECK ((commercial_type = ANY (ARRAY['misc_income'::text, 'retail_sale'::text])))
);


--
-- Name: financial_expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: financial_expense_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_expense_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    category_id uuid NOT NULL,
    payee text NOT NULL,
    description text NOT NULL,
    receipt_reference text,
    receipt_image_url text,
    approval_status text DEFAULT 'approved_instant'::text NOT NULL,
    approved_by uuid,
    related_booking_order_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT financial_expense_details_approval_status_check CHECK ((approval_status = ANY (ARRAY['approved_instant'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: financial_order_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_order_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    financial_account_movement_id uuid NOT NULL,
    order_id uuid NOT NULL,
    payable_item_id uuid,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT financial_order_allocations_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: TABLE financial_order_allocations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_order_allocations IS 'Two-tier allocations connecting financial movement value to customer orders (order-level default or item-level split).';


--
-- Name: COLUMN financial_order_allocations.financial_account_movement_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_order_allocations.financial_account_movement_id IS 'Source monetary movement from CF2 ledger.';


--
-- Name: COLUMN financial_order_allocations.payable_item_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_order_allocations.payable_item_id IS 'Target payable item for Tier 2 split payments. NULL for Tier 1 default order-level allocation.';


--
-- Name: COLUMN financial_order_allocations.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_order_allocations.amount IS 'Satisfied payable value in PHP. Must be strictly positive (> 0).';


--
-- Name: financial_tip_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_tip_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    beneficiary_staff_id uuid NOT NULL,
    tip_amount numeric(12,2) NOT NULL,
    custody_type text NOT NULL,
    payout_status text DEFAULT 'pending_disbursement'::text NOT NULL,
    payout_transaction_id uuid,
    related_booking_order_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT financial_tip_details_custody_type_check CHECK ((custody_type = ANY (ARRAY['direct_cash'::text, 'company_custodied'::text]))),
    CONSTRAINT financial_tip_details_payout_status_check CHECK ((payout_status = ANY (ARRAY['not_applicable'::text, 'pending_disbursement'::text, 'disbursed'::text]))),
    CONSTRAINT financial_tip_details_tip_amount_check CHECK ((tip_amount > (0)::numeric))
);


--
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    transaction_type text NOT NULL,
    business_date date NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    currency text DEFAULT 'PHP'::text NOT NULL,
    status text DEFAULT 'posted'::text NOT NULL,
    idempotency_key text NOT NULL,
    source_type text,
    source_id text,
    external_reference text,
    reversal_of_transaction_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_financial_transaction_no_self_reversal CHECK (((reversal_of_transaction_id IS NULL) OR (reversal_of_transaction_id <> id))),
    CONSTRAINT financial_transactions_currency_check CHECK ((currency = 'PHP'::text)),
    CONSTRAINT financial_transactions_source_type_check CHECK (((source_type IS NULL) OR (source_type = ANY (ARRAY['booking_order'::text, 'cash_session'::text, 'payroll_run'::text, 'retail_sale'::text, 'legacy_booking'::text])))),
    CONSTRAINT financial_transactions_status_check CHECK ((status = ANY (ARRAY['posted'::text, 'reversed'::text, 'voided'::text]))),
    CONSTRAINT financial_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['customer_payment'::text, 'customer_refund'::text, 'customer_deposit'::text, 'operational_expense'::text, 'cash_adjustment'::text, 'tip_collection'::text, 'tip_disbursement'::text, 'payroll_disbursement'::text, 'voucher_sale'::text, 'voucher_redemption'::text, 'retail_sale'::text, 'other_income'::text])))
);


--
-- Name: TABLE financial_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_transactions IS 'Single canonical financial transaction event identity header.';


--
-- Name: COLUMN financial_transactions.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_transactions.idempotency_key IS 'Unique idempotency key ensuring replay suppression and retry safety.';


--
-- Name: COLUMN financial_transactions.reversal_of_transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.financial_transactions.reversal_of_transaction_id IS 'Self-referencing link to the original transaction if this record is a corrective reversal or refund.';


--
-- Name: order_payable_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_payable_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    booking_id uuid,
    charge_type text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'PHP'::text NOT NULL,
    sequence integer DEFAULT 1 NOT NULL,
    source_type text,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT order_payable_items_amount_sign_check CHECK ((((charge_type = ANY (ARRAY['service'::text, 'home_service_fee'::text, 'retail_product'::text, 'surcharge'::text, 'other_charge'::text])) AND (amount > (0)::numeric)) OR ((charge_type = 'discount'::text) AND (amount < (0)::numeric)) OR ((charge_type = 'manual_adjustment'::text) AND (amount <> (0)::numeric)))),
    CONSTRAINT order_payable_items_charge_type_check CHECK ((charge_type = ANY (ARRAY['service'::text, 'home_service_fee'::text, 'retail_product'::text, 'surcharge'::text, 'discount'::text, 'manual_adjustment'::text, 'other_charge'::text]))),
    CONSTRAINT order_payable_items_currency_check CHECK ((currency = 'PHP'::text)),
    CONSTRAINT order_payable_items_sequence_check CHECK ((sequence >= 1)),
    CONSTRAINT order_payable_items_service_booking_check CHECK (((charge_type <> 'service'::text) OR (booking_id IS NOT NULL)))
);


--
-- Name: TABLE order_payable_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_payable_items IS 'Canonical line-item components comprising the total payable amount of a customer booking order.';


--
-- Name: COLUMN order_payable_items.order_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_payable_items.order_id IS 'Parent booking order aggregate.';


--
-- Name: COLUMN order_payable_items.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_payable_items.booking_id IS 'Referenced appointment service line if charge_type = service. Must belong to the same booking order.';


--
-- Name: COLUMN order_payable_items.charge_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_payable_items.charge_type IS 'Approved charge taxonomy: service, home_service_fee, retail_product, surcharge, discount, manual_adjustment, other_charge.';


--
-- Name: COLUMN order_payable_items.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_payable_items.amount IS 'Signed nominal amount in PHP. Positive for charges, negative for discounts. Zero is strictly prohibited.';


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price numeric(12,2) NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    branch_id uuid,
    full_name text NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: v_booking_order_financial_summaries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_booking_order_financial_summaries WITH (security_invoker='true') AS
 WITH payables AS (
         SELECT order_payable_items.order_id,
            (COALESCE(sum(order_payable_items.amount), (0)::numeric))::numeric(12,2) AS total_payable,
            (count(*))::integer AS payable_item_count
           FROM public.order_payable_items
          GROUP BY order_payable_items.order_id
        ), allocations AS (
         SELECT financial_order_allocations.order_id,
            (COALESCE(sum(financial_order_allocations.amount), (0)::numeric))::numeric(12,2) AS net_allocated,
            (count(*))::integer AS allocation_count
           FROM public.financial_order_allocations
          GROUP BY financial_order_allocations.order_id
        )
 SELECT bo.id AS order_id,
    bo.branch_id,
    bo.currency,
    (COALESCE(p.total_payable, 0.00))::numeric(12,2) AS total_payable,
    (COALESCE(a.net_allocated, 0.00))::numeric(12,2) AS net_allocated,
    ((COALESCE(p.total_payable, 0.00) - COALESCE(a.net_allocated, 0.00)))::numeric(12,2) AS remaining_balance,
    public.derive_order_payment_state(COALESCE(p.total_payable, 0.00), COALESCE(a.net_allocated, 0.00)) AS payment_state,
    COALESCE(p.payable_item_count, 0) AS payable_item_count,
    COALESCE(a.allocation_count, 0) AS allocation_count
   FROM ((public.booking_orders bo
     LEFT JOIN payables p ON ((p.order_id = bo.id)))
     LEFT JOIN allocations a ON ((a.order_id = bo.id)));


--
-- Name: VIEW v_booking_order_financial_summaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_booking_order_financial_summaries IS 'Security-invoker derived financial view computing order payable, allocated, remaining balance, and payment state.';


--
-- Name: v_financial_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_financial_accounts WITH (security_invoker='true') AS
 SELECT id,
    branch_id,
    name,
    account_type,
    identifier_mask,
    currency,
    is_active,
    created_at
   FROM public.financial_accounts fa;


--
-- Name: VIEW v_financial_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_financial_accounts IS 'Safe view of financial accounts exposing masked identifiers with caller security (security_invoker = true).';


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: booking_orders booking_orders_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_orders
    ADD CONSTRAINT booking_orders_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: booking_orders booking_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_orders
    ADD CONSTRAINT booking_orders_order_number_key UNIQUE (order_number);


--
-- Name: booking_orders booking_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_orders
    ADD CONSTRAINT booking_orders_pkey PRIMARY KEY (id);


--
-- Name: booking_payment_logs booking_payment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payment_logs
    ADD CONSTRAINT booking_payment_logs_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: financial_account_movements financial_account_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_account_movements
    ADD CONSTRAINT financial_account_movements_pkey PRIMARY KEY (id);


--
-- Name: financial_accounts financial_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_pkey PRIMARY KEY (id);


--
-- Name: financial_commercial_details financial_commercial_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_commercial_details
    ADD CONSTRAINT financial_commercial_details_pkey PRIMARY KEY (id);


--
-- Name: financial_expense_categories financial_expense_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_categories
    ADD CONSTRAINT financial_expense_categories_code_key UNIQUE (code);


--
-- Name: financial_expense_categories financial_expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_categories
    ADD CONSTRAINT financial_expense_categories_pkey PRIMARY KEY (id);


--
-- Name: financial_expense_details financial_expense_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_details
    ADD CONSTRAINT financial_expense_details_pkey PRIMARY KEY (id);


--
-- Name: financial_order_allocations financial_order_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_order_allocations
    ADD CONSTRAINT financial_order_allocations_pkey PRIMARY KEY (id);


--
-- Name: financial_tip_details financial_tip_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_tip_details
    ADD CONSTRAINT financial_tip_details_pkey PRIMARY KEY (id);


--
-- Name: financial_transactions financial_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


--
-- Name: order_payable_items order_payable_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payable_items
    ADD CONSTRAINT order_payable_items_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: staff staff_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_name_key UNIQUE (name);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_token_idx ON auth.refresh_tokens USING btree (token);


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, email);


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: idx_cf_commercial_details_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_commercial_details_tx ON public.financial_commercial_details USING btree (transaction_id);


--
-- Name: idx_cf_expense_details_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_expense_details_category ON public.financial_expense_details USING btree (category_id);


--
-- Name: idx_cf_expense_details_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_expense_details_created ON public.financial_expense_details USING btree (created_at);


--
-- Name: idx_cf_expense_details_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_expense_details_tx ON public.financial_expense_details USING btree (transaction_id);


--
-- Name: idx_cf_tip_details_custody; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_tip_details_custody ON public.financial_tip_details USING btree (custody_type);


--
-- Name: idx_cf_tip_details_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_tip_details_staff ON public.financial_tip_details USING btree (beneficiary_staff_id);


--
-- Name: idx_cf_tip_details_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cf_tip_details_tx ON public.financial_tip_details USING btree (transaction_id);


--
-- Name: idx_financial_accounts_branch_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_accounts_branch_active ON public.financial_accounts USING btree (branch_id, is_active);


--
-- Name: idx_financial_accounts_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_accounts_branch_id ON public.financial_accounts USING btree (branch_id);


--
-- Name: idx_financial_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_accounts_type ON public.financial_accounts USING btree (account_type);


--
-- Name: idx_financial_allocations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_allocations_created_at ON public.financial_order_allocations USING btree (created_at DESC);


--
-- Name: idx_financial_allocations_movement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_allocations_movement_id ON public.financial_order_allocations USING btree (financial_account_movement_id);


--
-- Name: idx_financial_allocations_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_allocations_order_id ON public.financial_order_allocations USING btree (order_id);


--
-- Name: idx_financial_allocations_payable_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_allocations_payable_item_id ON public.financial_order_allocations USING btree (payable_item_id) WHERE (payable_item_id IS NOT NULL);


--
-- Name: idx_financial_movements_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_movements_account_id ON public.financial_account_movements USING btree (financial_account_id);


--
-- Name: idx_financial_movements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_movements_created_at ON public.financial_account_movements USING btree (created_at DESC);


--
-- Name: idx_financial_movements_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_movements_payment_method ON public.financial_account_movements USING btree (payment_method);


--
-- Name: idx_financial_movements_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_movements_transaction_id ON public.financial_account_movements USING btree (transaction_id);


--
-- Name: idx_financial_transactions_branch_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_branch_business_date ON public.financial_transactions USING btree (branch_id, business_date);


--
-- Name: idx_financial_transactions_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_occurred_at ON public.financial_transactions USING btree (occurred_at DESC);


--
-- Name: idx_financial_transactions_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_recorded_at ON public.financial_transactions USING btree (recorded_at DESC);


--
-- Name: idx_financial_transactions_reversal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_reversal ON public.financial_transactions USING btree (reversal_of_transaction_id) WHERE (reversal_of_transaction_id IS NOT NULL);


--
-- Name: idx_financial_transactions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_source ON public.financial_transactions USING btree (source_type, source_id) WHERE (source_type IS NOT NULL);


--
-- Name: idx_financial_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_type ON public.financial_transactions USING btree (transaction_type);


--
-- Name: idx_order_payable_items_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payable_items_booking_id ON public.order_payable_items USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: idx_order_payable_items_charge_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payable_items_charge_type ON public.order_payable_items USING btree (charge_type);


--
-- Name: idx_order_payable_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payable_items_order_id ON public.order_payable_items USING btree (order_id);


--
-- Name: idx_order_payable_items_order_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payable_items_order_seq ON public.order_payable_items USING btree (order_id, sequence);


--
-- Name: financial_account_movements trg_protect_financial_account_movements_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_financial_account_movements_immutability BEFORE DELETE OR UPDATE ON public.financial_account_movements FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ledger_immutability();


--
-- Name: financial_order_allocations trg_protect_financial_order_allocations_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_financial_order_allocations_immutability BEFORE DELETE OR UPDATE ON public.financial_order_allocations FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_allocation_immutability();


--
-- Name: financial_transactions trg_protect_financial_transactions_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_financial_transactions_immutability BEFORE DELETE OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ledger_immutability();


--
-- Name: financial_order_allocations trg_validate_financial_order_allocation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_financial_order_allocation BEFORE INSERT OR UPDATE ON public.financial_order_allocations FOR EACH ROW EXECUTE FUNCTION public.fn_validate_financial_order_allocation();


--
-- Name: order_payable_items trg_validate_order_payable_item; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_order_payable_item BEFORE INSERT OR UPDATE ON public.order_payable_items FOR EACH ROW EXECUTE FUNCTION public.fn_validate_order_payable_item();


--
-- Name: booking_orders booking_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_orders
    ADD CONSTRAINT booking_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: booking_orders booking_orders_organizer_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_orders
    ADD CONSTRAINT booking_orders_organizer_customer_id_fkey FOREIGN KEY (organizer_customer_id) REFERENCES public.customers(id);


--
-- Name: booking_payment_logs booking_payment_logs_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payment_logs
    ADD CONSTRAINT booking_payment_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: booking_payment_logs booking_payment_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payment_logs
    ADD CONSTRAINT booking_payment_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.staff(id);


--
-- Name: bookings bookings_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: bookings bookings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.booking_orders(id);


--
-- Name: bookings bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: bookings bookings_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: financial_account_movements financial_account_movements_financial_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_account_movements
    ADD CONSTRAINT financial_account_movements_financial_account_id_fkey FOREIGN KEY (financial_account_id) REFERENCES public.financial_accounts(id) ON DELETE RESTRICT;


--
-- Name: financial_account_movements financial_account_movements_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_account_movements
    ADD CONSTRAINT financial_account_movements_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: financial_accounts financial_accounts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;


--
-- Name: financial_commercial_details financial_commercial_details_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_commercial_details
    ADD CONSTRAINT financial_commercial_details_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: financial_expense_details financial_expense_details_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_details
    ADD CONSTRAINT financial_expense_details_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: financial_expense_details financial_expense_details_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_details
    ADD CONSTRAINT financial_expense_details_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.financial_expense_categories(id) ON DELETE RESTRICT;


--
-- Name: financial_expense_details financial_expense_details_related_booking_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_details
    ADD CONSTRAINT financial_expense_details_related_booking_order_id_fkey FOREIGN KEY (related_booking_order_id) REFERENCES public.booking_orders(id) ON DELETE SET NULL;


--
-- Name: financial_expense_details financial_expense_details_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_expense_details
    ADD CONSTRAINT financial_expense_details_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: financial_order_allocations financial_order_allocations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_order_allocations
    ADD CONSTRAINT financial_order_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: financial_order_allocations financial_order_allocations_financial_account_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_order_allocations
    ADD CONSTRAINT financial_order_allocations_financial_account_movement_id_fkey FOREIGN KEY (financial_account_movement_id) REFERENCES public.financial_account_movements(id) ON DELETE RESTRICT;


--
-- Name: financial_order_allocations financial_order_allocations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_order_allocations
    ADD CONSTRAINT financial_order_allocations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.booking_orders(id) ON DELETE RESTRICT;


--
-- Name: financial_order_allocations financial_order_allocations_payable_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_order_allocations
    ADD CONSTRAINT financial_order_allocations_payable_item_id_fkey FOREIGN KEY (payable_item_id) REFERENCES public.order_payable_items(id) ON DELETE RESTRICT;


--
-- Name: financial_tip_details financial_tip_details_beneficiary_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_tip_details
    ADD CONSTRAINT financial_tip_details_beneficiary_staff_id_fkey FOREIGN KEY (beneficiary_staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: financial_tip_details financial_tip_details_payout_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_tip_details
    ADD CONSTRAINT financial_tip_details_payout_transaction_id_fkey FOREIGN KEY (payout_transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: financial_tip_details financial_tip_details_related_booking_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_tip_details
    ADD CONSTRAINT financial_tip_details_related_booking_order_id_fkey FOREIGN KEY (related_booking_order_id) REFERENCES public.booking_orders(id) ON DELETE SET NULL;


--
-- Name: financial_tip_details financial_tip_details_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_tip_details
    ADD CONSTRAINT financial_tip_details_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: financial_transactions financial_transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;


--
-- Name: financial_transactions financial_transactions_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: financial_transactions financial_transactions_reversal_of_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_reversal_of_transaction_id_fkey FOREIGN KEY (reversal_of_transaction_id) REFERENCES public.financial_transactions(id) ON DELETE RESTRICT;


--
-- Name: order_payable_items order_payable_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payable_items
    ADD CONSTRAINT order_payable_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;


--
-- Name: order_payable_items order_payable_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payable_items
    ADD CONSTRAINT order_payable_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: order_payable_items order_payable_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payable_items
    ADD CONSTRAINT order_payable_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.booking_orders(id) ON DELETE RESTRICT;


--
-- Name: staff staff_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: financial_commercial_details Allow authenticated staff to read commercial details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated staff to read commercial details" ON public.financial_commercial_details FOR SELECT TO authenticated USING (true);


--
-- Name: financial_expense_categories Allow authenticated staff to read expense categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated staff to read expense categories" ON public.financial_expense_categories FOR SELECT TO authenticated USING (true);


--
-- Name: financial_expense_details Allow authenticated staff to read expense details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated staff to read expense details" ON public.financial_expense_details FOR SELECT TO authenticated USING (true);


--
-- Name: financial_tip_details Allow authenticated staff to read tip details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated staff to read tip details" ON public.financial_tip_details FOR SELECT TO authenticated USING (true);


--
-- Name: financial_account_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_account_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_accounts financial_accounts_branch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_accounts_branch_read ON public.financial_accounts FOR SELECT TO authenticated USING (((public.get_auth_role() = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])) AND ((branch_id = public.get_auth_branch_id()) OR (branch_id IS NULL))));


--
-- Name: financial_accounts financial_accounts_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_accounts_owner_manage ON public.financial_accounts TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text]))) WITH CHECK ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: financial_accounts financial_accounts_owner_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_accounts_owner_read_all ON public.financial_accounts FOR SELECT TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: financial_accounts financial_accounts_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_accounts_service_role_all ON public.financial_accounts TO service_role USING (true) WITH CHECK (true);


--
-- Name: financial_order_allocations financial_allocations_branch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_allocations_branch_read ON public.financial_order_allocations FOR SELECT TO authenticated USING (((public.get_auth_role() = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])) AND (EXISTS ( SELECT 1
   FROM public.booking_orders bo
  WHERE ((bo.id = financial_order_allocations.order_id) AND (bo.branch_id = public.get_auth_branch_id()))))));


--
-- Name: financial_order_allocations financial_allocations_owner_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_allocations_owner_read_all ON public.financial_order_allocations FOR SELECT TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: financial_order_allocations financial_allocations_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_allocations_service_role_all ON public.financial_order_allocations TO service_role USING (true) WITH CHECK (true);


--
-- Name: financial_commercial_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_commercial_details ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_expense_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_expense_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_expense_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_expense_details ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_account_movements financial_movements_branch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_movements_branch_read ON public.financial_account_movements FOR SELECT TO authenticated USING (((public.get_auth_role() = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])) AND (EXISTS ( SELECT 1
   FROM public.financial_transactions ft
  WHERE ((ft.id = financial_account_movements.transaction_id) AND (ft.branch_id = public.get_auth_branch_id()))))));


--
-- Name: financial_account_movements financial_movements_owner_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_movements_owner_read_all ON public.financial_account_movements FOR SELECT TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: financial_account_movements financial_movements_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_movements_service_role_all ON public.financial_account_movements TO service_role USING (true) WITH CHECK (true);


--
-- Name: financial_order_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_order_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_tip_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_tip_details ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_transactions financial_transactions_branch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_transactions_branch_read ON public.financial_transactions FOR SELECT TO authenticated USING (((public.get_auth_role() = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])) AND (branch_id = public.get_auth_branch_id())));


--
-- Name: financial_transactions financial_transactions_owner_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_transactions_owner_read_all ON public.financial_transactions FOR SELECT TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: financial_transactions financial_transactions_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_transactions_service_role_all ON public.financial_transactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: order_payable_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_payable_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_payable_items order_payable_items_branch_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payable_items_branch_read ON public.order_payable_items FOR SELECT TO authenticated USING (((public.get_auth_role() = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])) AND (EXISTS ( SELECT 1
   FROM public.booking_orders bo
  WHERE ((bo.id = order_payable_items.order_id) AND (bo.branch_id = public.get_auth_branch_id()))))));


--
-- Name: order_payable_items order_payable_items_owner_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payable_items_owner_read_all ON public.order_payable_items FOR SELECT TO authenticated USING ((public.get_auth_role() = ANY (ARRAY['owner'::text, 'finance'::text])));


--
-- Name: order_payable_items order_payable_items_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payable_items_service_role_all ON public.order_payable_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: objects expense_receipts_service_role_all; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY expense_receipts_service_role_all ON storage.objects TO service_role USING ((bucket_id = 'expense-receipts'::text)) WITH CHECK ((bucket_id = 'expense-receipts'::text));


--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict dZ7H9nfN0KU4w2PLVivk3J4CzjXMIZ6P6aWM414GzTmfkJiQ1jAAgW0pRSuwQbK

