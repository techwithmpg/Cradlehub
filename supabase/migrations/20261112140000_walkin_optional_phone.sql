-- Migration: 20261112140000_walkin_optional_phone.sql
-- Description: Allow optional phone numbers for walk-in customers while preserving unique upserts for provided phone numbers.

BEGIN;

-- 1. Allow nullable phone on customers table
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- 2. Update upsert_customer to insert standalone customer record when phone is omitted or empty
CREATE OR REPLACE FUNCTION upsert_customer(
  p_phone     TEXT,
  p_full_name TEXT,
  p_email     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    INSERT INTO customers (full_name, phone, email)
    VALUES (p_full_name, NULL, p_email)
    RETURNING id INTO v_customer_id;
  ELSE
    INSERT INTO customers (full_name, phone, email)
    VALUES (p_full_name, trim(p_phone), p_email)
    ON CONFLICT (phone) DO UPDATE
      SET
        full_name  = EXCLUDED.full_name,
        email      = COALESCE(EXCLUDED.email, customers.email),
        updated_at = NOW()
    RETURNING id INTO v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

COMMENT ON FUNCTION upsert_customer IS
  'Canonical customer entry point. Upserts by phone when provided; inserts standalone customer when phone is omitted for walk-ins.';

COMMIT;

