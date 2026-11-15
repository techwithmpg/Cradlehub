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
        <CrmKpiCard label="Total Customers" value={data.totalCustomers} icon={Users} tone="success" />
        <CrmKpiCard label="Repeat Clients" value={data.repeatClients} icon={Repeat} tone="info" />
        <CrmKpiCard label="Lapsed Clients" value={data.lapsedClients} icon={AlertTriangle} tone="warning" />
        <CrmKpiCard label="New This Month" value={data.newThisMonth} icon={CalendarPlus} tone="info" />
        <CrmKpiCard label="Upcoming" value={data.recoveryBookings ?? "—"} icon={CalendarCheck} tone="neutral" />
      </CrmMotionSection>
    );
  }

  if (tab === "repeat") {
    return (
      <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CrmKpiCard label="Repeat Clients" value={data.repeatClients} icon={Repeat} tone="success" />
        <CrmKpiCard label="Avg. Visits" value={data.avgVisits ?? "—"} icon={TrendingUp} tone="info" />
        <CrmKpiCard label="Most Booked" value={data.mostBookedService ?? "—"} icon={Star} tone="neutral" />
        <CrmKpiCard label="Returning This Month" value={data.returningThisMonth ?? "—"} icon={CalendarCheck} tone="success" />
        <CrmKpiCard label="Avg. Spend" value={data.avgSpend ?? "—"} icon={Hash} tone="neutral" />
      </CrmMotionSection>
    );
  }

  if (tab === "lapsed") {
    return (
      <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CrmKpiCard label="Lapsed Clients" value={data.lapsedClients} icon={AlertTriangle} tone="warning" />
        <CrmKpiCard label="30+ Days Inactive" value={data.inactive30Plus ?? "—"} icon={Clock} tone="warning" />
        <CrmKpiCard label="60+ Days Inactive" value={data.inactive60Plus ?? "—"} icon={Clock} tone="danger" />
        <CrmKpiCard label="Follow-ups Needed" value={data.followUpsNeeded ?? "—"} icon={PhoneCall} tone="warning" />
        <CrmKpiCard label="Recovery Bookings" value={data.recoveryBookings ?? "—"} icon={RefreshCcw} tone="success" />
      </CrmMotionSection>
    );
  }

  // followup tab
  return (
    <CrmMotionSection className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <CrmKpiCard label="On Waitlist" value={data.onWaitlist ?? 0} icon={ListTodo} tone="warning" />
      <CrmKpiCard label="Follow-up Today" value={data.followUpToday ?? 0} icon={PhoneCall} tone="warning" />
      <CrmKpiCard label="This Week" value={data.thisWeek ?? 0} icon={CalendarCheck} tone="info" />
      <CrmKpiCard label="Converted This Month" value={data.convertedThisMonth ?? 0} icon={RefreshCcw} tone="success" />
      <CrmKpiCard label="High Priority" value={data.highPriority ?? 0} icon={ShieldAlert} tone="danger" />
    </CrmMotionSection>
  );
}
