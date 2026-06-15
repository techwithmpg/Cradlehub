-- CradleHub — Owner Payroll Settings
-- Stores the fixed-monthly payroll schedule and reminder preferences used by
-- the restored Owner Payroll workspace. Payment snapshots remain in
-- payroll_periods/payroll_items.

CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id TEXT PRIMARY KEY DEFAULT 'default'
    CHECK (id = 'default'),
  payday_rule TEXT NOT NULL DEFAULT 'fixed_day'
    CHECK (payday_rule IN ('fixed_day', 'last_day_of_month')),
  fixed_day INTEGER NOT NULL DEFAULT 30
    CHECK (fixed_day BETWEEN 1 AND 31),
  weekend_adjustment TEXT NOT NULL DEFAULT 'prior_business_day'
    CHECK (weekend_adjustment IN ('none', 'prior_business_day')),
  reminder_preset TEXT NOT NULL DEFAULT '2'
    CHECK (reminder_preset IN ('none', '1', '2', '3', '5', '7', 'custom')),
  custom_reminder_days INTEGER NOT NULL DEFAULT 2
    CHECK (custom_reminder_days BETWEEN 0 AND 31),
  include_inactive_employees BOOLEAN NOT NULL DEFAULT FALSE,
  default_payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (default_payment_status IN ('unpaid')),
  allow_status_editing BOOLEAN NOT NULL DEFAULT TRUE,
  show_total_payroll BOOLEAN NOT NULL DEFAULT TRUE,
  tracking_start_month INTEGER NOT NULL DEFAULT 1
    CHECK (tracking_start_month BETWEEN 1 AND 12),
  tracking_start_year INTEGER NOT NULL DEFAULT 2026
    CHECK (tracking_start_year BETWEEN 2020 AND 2100),
  continue_reminders_while_unpaid BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_payment_methods TEXT[] NOT NULL DEFAULT ARRAY['cash', 'gcash', 'bank_transfer', 'other']::TEXT[],
  show_owner_dashboard_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  show_payroll_page_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payroll_due BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payroll_fully_paid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

INSERT INTO public.payroll_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER trg_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_settings_owner_all" ON public.payroll_settings;
CREATE POLICY "payroll_settings_owner_all"
  ON public.payroll_settings FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'owner')
  WITH CHECK (public.get_auth_role() = 'owner');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_settings TO authenticated;

COMMENT ON TABLE public.payroll_settings IS
  'Singleton Owner Payroll settings for fixed monthly payroll schedule, reminders, and display preferences.';
