"use client";

import { CrmMotionSection } from "@/components/features/crm/premium/crm-motion-section";
import { CrmKpiCard } from "@/components/features/crm/premium/crm-kpi-card";
import type { CustomerTab } from "./customer-segment-tabs";
import {
  Users,
  Repeat,
  AlertTriangle,
  CalendarPlus,
  CalendarCheck,
  TrendingUp,
  Star,
  Clock,
  RefreshCcw,
  ListTodo,
  PhoneCall,
  Hash,
  ShieldAlert,
} from "lucide-react";

export interface KpiData {
  totalCustomers: number;
  repeatClients: number;
  lapsedClients: number;
  newThisMonth: number;
  totalVisits: number;
  avgVisits?: number;
  mostBookedService?: string | null;
  returningThisMonth?: number;
  avgSpend?: number | null;
  inactive30Plus?: number;
  inactive60Plus?: number;
  followUpsNeeded?: number;
  recoveryBookings?: number | null;
  onWaitlist?: number;
  followUpToday?: number;
  thisWeek?: number;
  convertedThisMonth?: number;
  highPriority?: number;
}

interface CustomerKpiRowProps {
  tab: CustomerTab;
  data: KpiData;
}

export function CustomerKpiRow({ tab, data }: CustomerKpiRowProps) {
  if (tab === "all") {
    return (
      <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CrmKpiCard label="Total Customers" value={data.totalCustomers} icon={Users} accent />
        <CrmKpiCard label="Repeat Clients" value={data.repeatClients} icon={Repeat} />
        <CrmKpiCard label="Lapsed Clients" value={data.lapsedClients} icon={AlertTriangle} />
        <CrmKpiCard label="New This Month" value={data.newThisMonth} icon={CalendarPlus} />
        <CrmKpiCard label="Upcoming" value={data.recoveryBookings ?? "—"} icon={CalendarCheck} />
      </CrmMotionSection>
    );
  }

  if (tab === "repeat") {
    return (
      <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CrmKpiCard label="Repeat Clients" value={data.repeatClients} icon={Repeat} accent />
        <CrmKpiCard label="Avg. Visits" value={data.avgVisits ?? "—"} icon={TrendingUp} />
        <CrmKpiCard label="Most Booked" value={data.mostBookedService ?? "—"} icon={Star} />
        <CrmKpiCard label="Returning This Month" value={data.returningThisMonth ?? "—"} icon={CalendarCheck} />
        <CrmKpiCard label="Avg. Spend" value={data.avgSpend ?? "—"} icon={Hash} />
      </CrmMotionSection>
    );
  }

  if (tab === "lapsed") {
    return (
      <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CrmKpiCard label="Lapsed Clients" value={data.lapsedClients} icon={AlertTriangle} accent />
        <CrmKpiCard label="30+ Days Inactive" value={data.inactive30Plus ?? "—"} icon={Clock} />
        <CrmKpiCard label="60+ Days Inactive" value={data.inactive60Plus ?? "—"} icon={Clock} />
        <CrmKpiCard label="Follow-ups Needed" value={data.followUpsNeeded ?? "—"} icon={PhoneCall} />
        <CrmKpiCard label="Recovery Bookings" value={data.recoveryBookings ?? "—"} icon={RefreshCcw} />
      </CrmMotionSection>
    );
  }

  // followup tab
  return (
    <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <CrmKpiCard label="On Waitlist" value={data.onWaitlist ?? 0} icon={ListTodo} accent />
      <CrmKpiCard label="Follow-up Today" value={data.followUpToday ?? 0} icon={PhoneCall} />
      <CrmKpiCard label="This Week" value={data.thisWeek ?? 0} icon={CalendarCheck} />
      <CrmKpiCard label="Converted This Month" value={data.convertedThisMonth ?? 0} icon={RefreshCcw} />
      <CrmKpiCard label="High Priority" value={data.highPriority ?? 0} icon={ShieldAlert} />
    </CrmMotionSection>
  );
}
