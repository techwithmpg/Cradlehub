-- ISOLATED TEST ONLY. Minimal parent fixture; NOT production schema.
-- No production data or existing migrations are used by this fixture.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY,
  phone text NOT NULL
);
CREATE TABLE public.booking_orders (
  id uuid PRIMARY KEY
);
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  order_id uuid REFERENCES public.booking_orders(id)
);
CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  to_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
