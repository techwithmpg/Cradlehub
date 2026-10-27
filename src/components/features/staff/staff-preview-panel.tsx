"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserRoundX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StaffRoleBadge, StaffStatusBadge } from "./staff-badges";
import { StaffAccountAccessPanel } from "./staff-account-access-panel";
import { getStaffNickname } from "@/lib/staff/display-name";
import {
  formatStaffDate,
  getStaffDisplayMeta,
  getInitials,
  getStaffInternalName,
  getStaffStatus,
  getStaffStatusLabel,
  readBranchName,
  type StaffMember,
} from "./staff-management-utils";

type StaffPreviewPanelProps = {
  staff: StaffMember | null;
  onClearSelection: () => void;
  workspaceContext?: "owner" | "manager" | "crm";
  /** Open the authorized inline staff editor when available. */
  onEditStaff?: (staff: StaffMember) => void;
  /** Open the authorized inline service capability editor when available. */
  onManageServices?: (staff: StaffMember) => void;
  onEditWorkSetup?: (staff: StaffMember) => void;
  /** CRM-only: toggle active/inactive status */
  onToggleActive?: (staff: StaffMember) => void;
};

export function StaffPreviewPanel({
  staff,
  onClearSelection,
  workspaceContext = "owner",
  onEditStaff,
  onManageServices,
  onEditWorkSetup,
  onToggleActive,
}: StaffPreviewPanelProps) {
  const [activePanel, setActivePanel] = useState<"overview" | "access" | "services" | "onboarding">("overview");
  const isOwner = workspaceContext === "owner";
  const isCrm = workspaceContext === "crm";
  const basePath = isCrm ? "#" : `/${workspaceContext}/staff`;
  const hasCrmActions = isCrm && (onEditStaff ?? onManageServices ?? onToggleActive);

  if (!staff) {
    return (
      <aside className="self-start rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] p-6 text-center text-sm text-[var(--cs-text-muted)] xl:sticky xl:top-20">
        Select a staff member to view details.
      </aside>
    );
  }

  const status = getStaffStatus(staff);
  const meta = getStaffDisplayMeta(staff);
  const nickname = getStaffNickname(staff);
  const branchName = readBranchName(staff.branches);
  const displayName = status === "invited" ? "Invite link generated" : getStaffInternalName(staff);
  const displayPosition = status === "invited" ? "Pending invitation" : meta.subtitle;
  const canApprove = status === "awaiting";
  const profileActionLabel = status === "active" ? "Edit Profile" : "Review Profile";

  return (
    <aside className="self-start rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)] xl:sticky xl:top-20">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3">
        <StaffStatusBadge status={status} />
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Open profile actions for ${displayName}`}
                  className="flex size-8 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              {!isCrm && (!onEditStaff || status !== "active") && (
                <DropdownMenuItem>
                  <Link href={`${basePath}/${staff.id}`} className="flex w-full items-center gap-2">
                    <UserCog className="size-4" aria-hidden="true" />
                    Edit profile
                  </Link>
                </DropdownMenuItem>
              )}
              {onEditStaff && (isCrm || status === "active") && (
                <DropdownMenuItem onSelect={() => onEditStaff(staff)}>
                  <UserCog className="size-4" aria-hidden="true" />
                  Edit profile
                </DropdownMenuItem>
              )}
              {onManageServices && (
                <DropdownMenuItem onSelect={() => onManageServices(staff)}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Manage services
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-label="Close staff preview"
            onClick={onClearSelection}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start gap-3 text-left">
          <ProfileAvatar staff={staff} label={displayName} />
          <h2 className="mt-3 mb-0 text-lg font-semibold text-[var(--cs-text)]">{displayName}</h2>
          <p className="mt-1 mb-0 text-sm text-[var(--cs-text-secondary)]">{displayPosition}</p>
          <div className="mt-3">
            <StaffRoleBadge staff={staff} />
          </div>
        </div>

        <div
          className="mt-4 flex gap-1 overflow-x-auto border-b border-[var(--cs-border-soft)]"
          role="group"
          aria-label="Staff profile sections"
        >
          {([
            ["overview", "Overview"],
            ["access", "Access & Permissions"],
            ["services", "Services"],
            ["onboarding", "Onboarding"]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={activePanel === key}
              onClick={() => setActivePanel(key)}
              className={[
                "shrink-0 border-b-2 px-3 py-2 text-xs font-semibold",
                "focus-visible:outline-none focus-visible:ring-2",
                activePanel === key
                  ? "border-[var(--cs-sand-dark)] text-[var(--cs-text)]"
                  : "border-transparent text-[var(--cs-text-muted)]"
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {activePanel === "overview" && (
          <dl className="mt-3 space-y-2.5 rounded-xl border border-[var(--cs-border)] p-3">
          <DetailRow Icon={Building2} label="Branch" value={branchName} />
          <DetailRow Icon={UserCheck} label="Known As" value={nickname ?? "—"} />
          <DetailRow Icon={ShieldCheck} label="Workspace Access" value={meta.badgeLabel} />
          <DetailRow Icon={UserCog} label="Staff Function" value={meta.staffTypeLabel} />
          <DetailRow Icon={UserCheck} label="Head / Supervisor" value={staff.is_head ? "Yes" : "No"} />
          <DetailRow
            Icon={Phone}
            label="Phone"
            value={staff.phone && staff.phone !== "0000000000" ? staff.phone : "—"}
          />
          {staff.email && <DetailRow Icon={Mail} label="Email" value={staff.email} />}
          <DetailRow Icon={UserCheck} label="Status" value={getStaffStatusLabel(status)} />
          <DetailRow Icon={CalendarDays} label="Joined" value={formatStaffDate(staff.created_at)} />
          </dl>
        )}

        {activePanel === "access" && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-[var(--cs-border)] p-4">
              <h3 className="m-0 text-sm font-semibold">Workspace Access</h3>
              <dl className="mt-3 space-y-3">
                <DetailRow Icon={ShieldCheck} label="Role" value={meta.badgeLabel} />
                <DetailRow Icon={Building2} label="Branch" value={branchName} />
                <DetailRow Icon={UserCog} label="Function" value={meta.staffTypeLabel} />
                <DetailRow Icon={UserCheck} label="Status" value={getStaffStatusLabel(status)} />
              </dl>
            </div>
            {isOwner && (
              <StaffAccountAccessPanel key={staff.id} staffId={staff.id} />
            )}
          </div>
        )}

        {activePanel === "services" && (
          <div className="mt-3 rounded-xl border border-[var(--cs-border)] p-4">
            <h3 className="m-0 text-sm font-semibold">Service Capabilities</h3>
            <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
              Manage the services assigned to this staff member.
            </p>
            {onManageServices ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => onManageServices(staff)}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Manage Services
              </Button>
            ) : (
              <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
                Use the existing authorized staff profile to manage services.
              </p>
            )}
          </div>
        )}

        {activePanel === "onboarding" && (
          <div className="mt-3 rounded-xl border border-[var(--cs-border)] p-4">
            <h3 className="m-0 text-sm font-semibold">
              Onboarding & Account Status
            </h3>
            <p className="mt-2 text-sm text-[var(--cs-text-secondary)]">
              Current account state: {getStaffStatusLabel(status)}
            </p>
            <Link
              href={isCrm ? "/crm/staff?tab=applications" : "/owner/staff/onboarding"}
              className="mt-3 inline-flex text-sm font-semibold text-[var(--cs-sand-dark)] underline"
            >
              Review applications
            </Link>
          </div>
        )}

        {!isCrm && (
          <div className="mt-5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
            <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Quick Actions</h3>
            <div className="mt-3 grid gap-2">
              {canApprove && (
                <Button
                  asChild
                  size="lg"
                  className="justify-start bg-[var(--cs-sand-dark)] text-white hover:bg-[var(--cs-sand)]"
                >
                  <Link href={`${basePath}/${staff.id}`}>
                    <UserCheck className="size-4" aria-hidden="true" />
                    Approve Staff
                  </Link>
                </Button>
              )}
              {onEditStaff && status === "active" ? (
                <Button type="button" variant="outline" size="lg" className="justify-start" onClick={() => onEditStaff(staff)}>
                  <UserCog className="size-4" aria-hidden="true" />
                  Edit Profile
                </Button>
              ) : (
                <QuickAction href={`${basePath}/${staff.id}`} label={profileActionLabel} Icon={UserCog} />
              )}
              {isOwner && onEditWorkSetup && status === "active" && (
                <Button type="button" variant="outline" size="lg" className="justify-start" onClick={() => onEditWorkSetup(staff)}>
                  <Building2 className="size-4" aria-hidden="true" />
                  Edit Work Setup
                </Button>
              )}
              {isOwner && (
                <QuickAction href={`${basePath}/${staff.id}`} label="Assign Branch" Icon={MapPin} />
              )}
              <QuickAction href={`${basePath}/${staff.id}`} label="Change Role" Icon={ShieldCheck} />
              {status === "active" && (
                <QuickAction href={`${basePath}/${staff.id}`} label="Deactivate Staff" Icon={UserRoundX} danger />
              )}
            </div>
          </div>
        )}

        {hasCrmActions && (
          <div className="mt-5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
            <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Quick Actions</h3>
            <div className="mt-3 grid gap-2">
              {onEditStaff && (
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-tint)]"
                  onClick={() => onEditStaff(staff)}
                >
                  <UserCog className="size-4" aria-hidden="true" />
                  Edit Profile
                </Button>
              )}
              {onManageServices && (
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-tint)]"
                  onClick={() => onManageServices(staff)}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  Manage Services
                </Button>
              )}
              {onToggleActive && status !== "archived" && (
                <Button
                  variant="outline"
                  size="lg"
                  className={[
                    "justify-start border-[var(--cs-border)] bg-[var(--cs-surface)]",
                    staff.is_active
                      ? "text-[var(--cs-error-text)] hover:bg-[var(--cs-error-bg)]"
                      : "text-[var(--cs-success-text)] hover:bg-[var(--cs-success-bg)]",
                  ].join(" ")}
                  onClick={() => onToggleActive(staff)}
                >
                  {staff.is_active ? (
                    <>
                      <UserRoundX className="size-4" aria-hidden="true" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <UserCheck className="size-4" aria-hidden="true" />
                      Activate
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ProfileAvatar({ staff, label }: { staff: StaffMember; label: string }) {
  if (staff.avatar_url) {
    return (
      <Image
        src={staff.avatar_url}
        alt=""
        width={80}
        height={80}
        unoptimized
        className="size-20 rounded-full border border-[var(--cs-border)] object-cover shadow-[var(--cs-shadow-xs)]"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-20 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-sand-mist)] text-xl font-semibold text-[var(--cs-sand-dark)] shadow-[var(--cs-shadow-xs)]"
    >
      {getInitials(label)}
    </span>
  );
}

function DetailRow({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[24px_96px_minmax(0,1fr)] items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 text-[var(--cs-text-muted)]" aria-hidden={true} />
      <dt className="text-[var(--cs-text-muted)]">{label}</dt>
      <dd className="m-0 min-w-0 break-words font-medium text-[var(--cs-text)]">{value}</dd>
    </div>
  );
}

function QuickAction({
  href,
  label,
  Icon,
  danger = false,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  danger?: boolean;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="lg"
      className={[
        "justify-start border-[var(--cs-border)] bg-[var(--cs-surface)]",
        danger
          ? "text-[var(--cs-error-text)] hover:bg-[var(--cs-error-bg)]"
          : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-tint)]",
      ].join(" ")}
    >
      <Link href={href}>
        <Icon className="size-4" aria-hidden={true} />
        {label}
      </Link>
    </Button>
  );
}
