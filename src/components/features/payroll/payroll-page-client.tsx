"use client";

import { useMemo, useState } from "react";
import { CalendarClock, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PayrollDashboardData } from "@/lib/queries/payroll";
import { EmployeePayrollTable } from "./employee-payroll-table";
import { MonthlyPaySetupCard } from "./monthly-pay-setup-card";
import { PaymentProgressCard } from "./payment-progress-card";
import { PayrollHistoryDialog } from "./payroll-history-dialog";
import { PayrollPageHeader } from "./payroll-page-header";
import {
  PayrollSettingsDialog,
  type PayrollSettingsSection,
} from "./payroll-settings-dialog";
import { PayrollSummaryGrid } from "./payroll-summary-grid";
import { outlinePayrollButtonClass } from "./payroll-ui";

interface PayrollPageClientProps {
  dashboard: PayrollDashboardData;
}

export function PayrollPageClient({ dashboard }: PayrollPageClientProps) {
  const [staffRows, setStaffRows] = useState(dashboard.staffRows);
  const [settings, setSettings] = useState(dashboard.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<PayrollSettingsSection>("general");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paySetupOpen, setPaySetupOpen] = useState(false);
  const [paySetupStaffId, setPaySetupStaffId] = useState<string | null>(null);
  const summary = useMemo(() => {
    const included = staffRows.filter((staff) => staff.has_monthly_pay);
    const paidStaff = included.filter((staff) => staff.status === "paid").length;
    const totalIncludedStaff = included.length;
    return {
      ...dashboard.summary,
      totalMonthlyPayroll: included.reduce((sum, staff) => sum + staff.monthly_pay, 0),
      paidStaff,
      unpaidStaff: totalIncludedStaff - paidStaff,
      totalIncludedStaff,
      payrollProgress: totalIncludedStaff > 0 ? Math.round((paidStaff / totalIncludedStaff) * 100) : 0,
    };
  }, [dashboard.summary, staffRows]);

  function handlePaySaved(result: { staffId: string; amount: number }) {
    setStaffRows((current) => current.map((staff) =>
      staff.id === result.staffId
        ? { ...staff, monthly_pay: result.amount, has_monthly_pay: true, status: staff.status === "missing_salary" ? "unpaid" : staff.status }
        : staff
    ));
  }

  function handleStatusChanged(staffId: string, status: "paid" | "unpaid") {
    setStaffRows((current) => current.map((staff) =>
      staff.id === staffId ? { ...staff, status } : staff
    ));
  }

  function openSettings(section: PayrollSettingsSection) {
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  function openPaySetup(staffId?: string) {
    setPaySetupStaffId(staffId ?? null);
    setPaySetupOpen(true);
  }

  return (
    <div className="space-y-5">
      <PayrollPageHeader
        onOpenSettings={() => openSettings("general")}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <PayrollSummaryGrid
        summary={summary}
        onChangePayday={() => openSettings("payroll-schedule")}
      />

      {dashboard.summary.reminderMessage ? (
        <section
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-[var(--cs-warning)]/30 bg-[var(--cs-warning-bg)] p-4 text-[var(--cs-warning-text)] shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[var(--cs-warning-text)]">
              <CalendarClock className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Payroll reminder</p>
              <p className="mt-1 text-sm">{dashboard.summary.reminderMessage}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-[var(--cs-warning)]/30 bg-[var(--cs-surface)] text-[var(--cs-warning-text)] hover:bg-[var(--cs-surface)]/80"
            onClick={() => openSettings("payment-reminder")}
          >
            Reminder settings
          </Button>
        </section>
      ) : null}

      <div className="xl:hidden">
        <Button
          type="button"
          variant="outline"
          className={`w-full ${outlinePayrollButtonClass}`}
          onClick={() => openPaySetup()}
        >
          <WalletCards className="size-4" aria-hidden="true" />
          Monthly Pay Setup
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_clamp(300px,24vw,360px)] xl:items-start">
        <EmployeePayrollTable
          staffRows={staffRows}
          branches={dashboard.branches}
          allowStatusEditing={dashboard.settings.allowStatusEditing}
          onSetupPay={openPaySetup}
          onStatusChanged={handleStatusChanged}
        />

        <aside className="hidden space-y-4 xl:block" aria-label="Payroll setup and progress">
          <MonthlyPaySetupCard
            key={paySetupStaffId ?? "desktop-pay-setup"}
            staffRows={staffRows}
            initialStaffId={paySetupStaffId}
            onSaved={handlePaySaved}
          />
          <PaymentProgressCard summary={summary} />
        </aside>
      </div>

      {settingsOpen ? (
        <PayrollSettingsDialog
          open={settingsOpen}
          initialSection={settingsSection}
          settings={settings}
          onOpenChange={setSettingsOpen}
          onSaved={setSettings}
        />
      ) : null}

      <PayrollHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={dashboard.history}
      />

      <Sheet open={paySetupOpen} onOpenChange={setPaySetupOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90svh] rounded-t-xl border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-0"
        >
          <SheetHeader className="border-b border-[var(--cs-border-soft)]">
            <SheetTitle className="font-heading text-xl text-[var(--cs-text)]">
              Monthly Pay Setup
            </SheetTitle>
            <SheetDescription className="text-[var(--cs-text-muted)]">
              Set or update fixed monthly pay for a staff member.
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[70svh] overflow-y-auto p-4">
            <MonthlyPaySetupCard
              key={paySetupStaffId ?? "mobile-pay-setup"}
              staffRows={staffRows}
              initialStaffId={paySetupStaffId}
              onSaved={(result) => {
                handlePaySaved(result);
                setPaySetupOpen(false);
              }}
              framed={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
