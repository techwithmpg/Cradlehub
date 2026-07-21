"use client";

import { useMemo, useState, useTransition } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CreditCard,
  HelpCircle,
  Mail,
  Save,
  Settings,
  Table2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { updatePayrollSettingsAction } from "@/lib/actions/payroll-dashboard-actions";
import {
  computeNextPayrollDate,
  formatPayrollPreviewDate,
  getOrdinalDay,
  type PayrollPaymentMethod,
  type PayrollSettings,
  type ReminderPreset,
} from "@/lib/payroll/fixed-monthly";
import {
  fieldLabelClass,
  inputClass,
  outlinePayrollButtonClass,
  primaryPayrollButtonClass,
  selectClass,
} from "./payroll-ui";

export type PayrollSettingsSection =
  | "general"
  | "payroll-schedule"
  | "pay-period"
  | "payment-reminder"
  | "payment-methods"
  | "notifications";

const SETTINGS_SECTIONS: Array<{
  id: PayrollSettingsSection;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "general", label: "General Settings", icon: Settings },
  { id: "payroll-schedule", label: "Payroll Schedule", icon: CalendarDays },
  { id: "pay-period", label: "Pay Period", icon: Table2 },
  { id: "payment-reminder", label: "Payment Reminder", icon: Bell },
  { id: "payment-methods", label: "Payment Methods", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Mail },
];

const REMINDER_OPTIONS: Array<{ value: ReminderPreset; label: string }> = [
  { value: "none", label: "No reminder" },
  { value: "1", label: "1 day before" },
  { value: "2", label: "2 days before" },
  { value: "3", label: "3 days before" },
  { value: "5", label: "5 days before" },
  { value: "7", label: "7 days before" },
  { value: "custom", label: "Custom" },
];

const PAYMENT_METHODS: Array<{ value: PayrollPaymentMethod; label: string; description: string }> = [
  { value: "cash", label: "Cash", description: "Manual cash disbursement" },
  { value: "gcash", label: "GCash", description: "Track mobile wallet payments" },
  { value: "bank_transfer", label: "Bank transfer", description: "Track bank deposits" },
  { value: "other", label: "Other", description: "Use a custom manual method" },
];

export function PayrollSettingsDialog({
  open,
  initialSection,
  settings,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  initialSection: PayrollSettingsSection;
  settings: PayrollSettings;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: PayrollSettings) => void;
}) {
  const [activeSection, setActiveSection] = useState<PayrollSettingsSection>(initialSection);
  const [draft, setDraft] = useState<PayrollSettings>(settings);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewDate = useMemo(() => computeNextPayrollDate(draft), [draft]);

  function updateDraft(patch: Partial<PayrollSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setError(null);
  }

  function requestClose() {
    if (dirty && !window.confirm("Discard unsaved payroll settings changes?")) return;
    onOpenChange(false);
  }

  function handleRootOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updatePayrollSettingsAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDirty(false);
      onSaved(result.data);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="grid max-h-[88svh] w-[calc(100%-1rem)] max-w-[58rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-0 shadow-xl sm:w-[calc(100%-2rem)] sm:max-w-[58rem]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cs-border-soft)] px-5 py-4">
          <div>
            <DialogTitle className="font-heading text-2xl font-semibold text-[var(--cs-text)]">
              Payroll Settings
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Configure how payroll works in your business.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close payroll settings"
            onClick={requestClose}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid min-h-0 md:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--cs-border-soft)] p-3 md:block">
            <SettingsNav activeSection={activeSection} onChange={setActiveSection} />
            <div className="mt-8 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-[var(--cs-text)]">
                <HelpCircle className="size-4 text-[var(--cs-success-text)]" aria-hidden="true" />
                Need help?
              </div>
              <p className="mt-2 text-[var(--cs-text-muted)]">
                Payroll settings apply to fixed monthly pay only.
              </p>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-[var(--cs-border-soft)] p-4 md:hidden">
              <label htmlFor="payroll-settings-section" className={fieldLabelClass}>
                Settings section
              </label>
              <select
                id="payroll-settings-section"
                className={selectClass}
                value={activeSection}
                onChange={(event) => setActiveSection(event.target.value as PayrollSettingsSection)}
              >
                {SETTINGS_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-5">
              {activeSection === "general" ? (
                <GeneralSettingsSection draft={draft} updateDraft={updateDraft} />
              ) : null}
              {activeSection === "payroll-schedule" ? (
                <PayrollScheduleSection
                  draft={draft}
                  previewDate={previewDate}
                  updateDraft={updateDraft}
                />
              ) : null}
              {activeSection === "pay-period" ? (
                <PayPeriodSection draft={draft} updateDraft={updateDraft} />
              ) : null}
              {activeSection === "payment-reminder" ? (
                <PaymentReminderSection draft={draft} updateDraft={updateDraft} />
              ) : null}
              {activeSection === "payment-methods" ? (
                <PaymentMethodsSection draft={draft} updateDraft={updateDraft} />
              ) : null}
              {activeSection === "notifications" ? (
                <NotificationsSection draft={draft} updateDraft={updateDraft} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-5 py-4">
          {error ? (
            <p role="alert" className="mb-3 rounded-lg bg-[var(--cs-error-bg)] px-3 py-2 text-sm text-[var(--cs-error-text)]">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className={outlinePayrollButtonClass}
              onClick={requestClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={primaryPayrollButtonClass}
              onClick={handleSave}
              disabled={pending}
            >
              <Save className="size-4" aria-hidden="true" />
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsNav({
  activeSection,
  onChange,
}: {
  activeSection: PayrollSettingsSection;
  onChange: (section: PayrollSettingsSection) => void;
}) {
  return (
    <nav aria-label="Payroll settings sections" className="space-y-1">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              isActive
                ? "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)] ring-1 ring-[var(--cs-success)]/20"
                : "text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
            }`}
            onClick={() => onChange(section.id)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

function GeneralSettingsSection({
  draft,
  updateDraft,
}: {
  draft: PayrollSettings;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <SettingsSection
      title="General Settings"
      description="Keep payroll focused on fixed monthly salary tracking."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="payroll-currency">
          <select id="payroll-currency" className={selectClass} value="PHP" disabled>
            <option value="PHP">PHP - Philippine Peso</option>
          </select>
        </Field>
        <Field label="Payroll type" htmlFor="payroll-type">
          <select id="payroll-type" className={selectClass} value="fixed_monthly" disabled>
            <option value="fixed_monthly">Monthly fixed salary</option>
          </select>
        </Field>
      </div>

      <ToggleRow
        label="Include inactive employees"
        description="Show inactive staff in the payroll table for legacy setup."
        checked={draft.includeInactiveEmployees}
        onCheckedChange={(checked) => updateDraft({ includeInactiveEmployees: checked })}
      />
      <ToggleRow
        label="Allow payment status editing"
        description="Let owners mark staff paid or unpaid for the current payroll month."
        checked={draft.allowStatusEditing}
        onCheckedChange={(checked) => updateDraft({ allowStatusEditing: checked })}
      />
      <ToggleRow
        label="Show total monthly payroll"
        description="Display the total fixed monthly salary amount in the summary row."
        checked={draft.showTotalPayroll}
        onCheckedChange={(checked) => updateDraft({ showTotalPayroll: checked })}
      />
    </SettingsSection>
  );
}

function PayrollScheduleSection({
  draft,
  previewDate,
  updateDraft,
}: {
  draft: PayrollSettings;
  previewDate: Date;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <SettingsSection
      title="Payroll Schedule"
      description="Set the date of your next payroll and how payday is determined."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payday rule" htmlFor="payday-rule" helpText="Choose how payday is determined each month.">
          <select
            id="payday-rule"
            className={selectClass}
            value={draft.paydayRule}
            onChange={(event) =>
              updateDraft({
                paydayRule: event.target.value === "last_day_of_month" ? "last_day_of_month" : "fixed_day",
              })
            }
          >
            <option value="fixed_day">Pay on fixed day</option>
            <option value="last_day_of_month">Pay on last day of month</option>
          </select>
        </Field>

        <Field label="Day of the month" htmlFor="fixed-day" helpText="For shorter months, the date moves to the last calendar day.">
          <select
            id="fixed-day"
            className={selectClass}
            value={draft.fixedDay}
            disabled={draft.paydayRule === "last_day_of_month"}
            onChange={(event) => updateDraft({ fixedDay: Number(event.target.value) })}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {getOrdinalDay(day)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Weekend handling" htmlFor="weekend-adjustment" helpText="When payday falls on a weekend, move payment to the prior Friday.">
        <select
          id="weekend-adjustment"
          className={selectClass}
          value={draft.weekendAdjustment}
          onChange={(event) =>
            updateDraft({
              weekendAdjustment: event.target.value === "none" ? "none" : "prior_business_day",
            })
          }
        >
          <option value="prior_business_day">Pay on prior business day</option>
          <option value="none">Keep weekend payday</option>
        </select>
      </Field>

      <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-[var(--cs-text-muted)]">Next payroll preview</p>
            <p className="font-heading text-lg font-semibold text-[var(--cs-success-text)]">
              {formatPayrollPreviewDate(previewDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReminderSelect
          reminderPreset={draft.reminderPreset}
          customReminderDays={draft.customReminderDays}
          onChange={updateDraft}
        />
      </div>
    </SettingsSection>
  );
}

function PayPeriodSection({
  draft,
  updateDraft,
}: {
  draft: PayrollSettings;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <SettingsSection
      title="Pay Period"
      description="Monthly periods are used for the fixed salary payroll model."
    >
      <Field label="Pay period type" htmlFor="pay-period-type">
        <select id="pay-period-type" className={selectClass} value="monthly" disabled>
          <option value="monthly">Monthly</option>
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start tracking month" htmlFor="tracking-start-month">
          <select
            id="tracking-start-month"
            className={selectClass}
            value={draft.trackingStartMonth}
            onChange={(event) => updateDraft({ trackingStartMonth: Number(event.target.value) })}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {new Date(2026, month - 1, 1).toLocaleDateString("en-PH", { month: "long" })}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start tracking year" htmlFor="tracking-start-year">
          <input
            id="tracking-start-year"
            className={inputClass}
            type="number"
            min={2020}
            max={2100}
            value={draft.trackingStartYear}
            onChange={(event) => updateDraft({ trackingStartYear: Number(event.target.value) })}
          />
        </Field>
      </div>
    </SettingsSection>
  );
}

function PaymentReminderSection({
  draft,
  updateDraft,
}: {
  draft: PayrollSettings;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <SettingsSection
      title="Payment Reminder"
      description="Control when reminders appear before payday."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ReminderSelect
          reminderPreset={draft.reminderPreset}
          customReminderDays={draft.customReminderDays}
          onChange={updateDraft}
        />
      </div>

      <ToggleRow
        label="Continue reminders while unpaid"
        description="Keep showing overdue reminders after payday if included staff are unpaid."
        checked={draft.continueRemindersWhileUnpaid}
        onCheckedChange={(checked) => updateDraft({ continueRemindersWhileUnpaid: checked })}
      />
      <ToggleRow
        label="Show reminder on owner dashboard"
        description="Allow payroll reminders outside this Payroll page."
        checked={draft.showOwnerDashboardReminder}
        onCheckedChange={(checked) => updateDraft({ showOwnerDashboardReminder: checked })}
      />
      <ToggleRow
        label="Show reminder on payroll page"
        description="Display the reminder banner above the staff payroll table."
        checked={draft.showPayrollPageReminder}
        onCheckedChange={(checked) => updateDraft({ showPayrollPageReminder: checked })}
      />
    </SettingsSection>
  );
}

function PaymentMethodsSection({
  draft,
  updateDraft,
}: {
  draft: PayrollSettings;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  function toggleMethod(method: PayrollPaymentMethod, checked: boolean) {
    const current = new Set(draft.enabledPaymentMethods);
    if (checked) {
      current.add(method);
    } else if (current.size > 1) {
      current.delete(method);
    }
    updateDraft({ enabledPaymentMethods: Array.from(current) });
  }

  return (
    <SettingsSection
      title="Payment Methods"
      description="Choose the manual payment methods owners can record for payroll."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.value}
            className="flex cursor-pointer gap-3 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4"
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--cs-success-text)]"
              checked={draft.enabledPaymentMethods.includes(method.value)}
              onChange={(event) => toggleMethod(method.value, event.target.checked)}
            />
            <span>
              <span className="block font-semibold text-[var(--cs-text)]">{method.label}</span>
              <span className="mt-1 block text-sm text-[var(--cs-text-muted)]">
                {method.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </SettingsSection>
  );
}

function NotificationsSection({
  draft,
  updateDraft,
}: {
  draft: PayrollSettings;
  updateDraft: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <SettingsSection
      title="Notifications"
      description="Choose which payroll events should trigger owner notifications."
    >
      <ToggleRow
        label="Payroll due reminders"
        description="Notify the owner when payroll is inside the configured reminder window."
        checked={draft.notifyPayrollDue}
        onCheckedChange={(checked) => updateDraft({ notifyPayrollDue: checked })}
      />
      <ToggleRow
        label="Fully paid notification"
        description="Notify the owner when all included staff are paid for the period."
        checked={draft.notifyPayrollFullyPaid}
        onCheckedChange={(checked) => updateDraft({ notifyPayrollFullyPaid: checked })}
      />
    </SettingsSection>
  );
}

function ReminderSelect({
  reminderPreset,
  customReminderDays,
  onChange,
}: {
  reminderPreset: ReminderPreset;
  customReminderDays: number;
  onChange: (patch: Partial<PayrollSettings>) => void;
}) {
  return (
    <>
      <Field label="Reminder to run payroll" htmlFor="reminder-preset" helpText="We'll remind you before payday.">
        <select
          id="reminder-preset"
          className={selectClass}
          value={reminderPreset}
          onChange={(event) => onChange({ reminderPreset: event.target.value as ReminderPreset })}
        >
          {REMINDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {reminderPreset === "custom" ? (
        <Field label="Custom days before" htmlFor="custom-reminder-days">
          <input
            id="custom-reminder-days"
            className={inputClass}
            type="number"
            min={0}
            max={31}
            value={customReminderDays}
            onChange={(event) => onChange({ customReminderDays: Number(event.target.value) })}
          />
        </Field>
      ) : null}
    </>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="border-b border-[var(--cs-border-soft)] pb-4">
        <h3 className="font-heading text-xl font-semibold text-[var(--cs-text)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  helpText,
  children,
}: {
  label: string;
  htmlFor: string;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={fieldLabelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {helpText ? <p className="mt-2 text-xs text-[var(--cs-text-muted)]">{helpText}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
      <div>
        <p className="font-semibold text-[var(--cs-text)]">{label}</p>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
