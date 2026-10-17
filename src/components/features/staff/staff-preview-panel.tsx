"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
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
  /** CRM-only: open the inline staff edit sheet */
  onEditStaff?: (staff: StaffMember) => void;
  /** CRM-only: open the inline service capability editor */
  onManageServices?: (staff: StaffMember) => void;
  onEditWorkSetup?: (staff: StaffMember) => void;
  /** CRM-only: toggle active/inactive status */
  onToggleActive?: (staff: StaffMember) => void;
  /** Verified service names; undefined when assignments were not loaded. */
  serviceNames?: string[];
};

export function StaffPreviewPanel({
  staff,
  onClearSelection,
  workspaceContext = "owner",
  onEditStaff,
  onManageServices,
  onEditWorkSetup,
  onToggleActive,
  serviceNames,
}: StaffPreviewPanelProps) {
  const [profileSection, setProfileSection] = useState<"overview" | "services" | "access">("overview");
  const isOwner = workspaceContext === "owner";
  const isCrm = workspaceContext === "crm";
  const basePath = isCrm ? "#" : `/${workspaceContext}/staff`;
  const hasCrmActions = isCrm && (onEditStaff ?? onManageServices ?? onToggleActive);

  if (!staff) {
    return (
      <aside className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface)] p-8 text-center text-sm text-[var(--cs-text-muted)]">
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
    <aside className="self-start overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-5 py-3">
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
              {!isCrm && !(isOwner && onEditStaff) && (
                <DropdownMenuItem>
                  <Link href={`${basePath}/${staff.id}`} className="flex w-full items-center gap-2">
                    <UserCog className="size-4" aria-hidden="true" />
                    Edit profile
                  </Link>
                </DropdownMenuItem>
              )}
              {onEditStaff && (
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
              {isOwner && onEditStaff && (
                <DropdownMenuItem>
                  <Link href={basePath + "/" + staff.id} className="flex w-full items-center gap-2">
                    <UserCog className="size-4" aria-hidden="true" />
                    Open full profile
                  </Link>
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

      <div className="p-4 sm:p-5">
        <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-success-bg)]/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-4">
            <ProfileAvatar staff={staff} label={displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-xl font-bold tracking-tight text-[var(--cs-text)]">{displayName}</h2>
                <StaffStatusBadge status={status} />
              </div>
              <p className="mt-1 mb-0 text-sm text-[var(--cs-text-secondary)]">{displayPosition}</p>
              <div className="mt-3"><StaffRoleBadge staff={staff} /></div>
              <p className="mb-0 mt-3 text-xs text-[var(--cs-text-muted)]">
                Staff profile · {branchName}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[var(--cs-border-soft)]" role="tablist" aria-label="Staff profile sections">
          {(["overview", "services", "access"] as const).map((section) => (
            <button
              key={section}
              type="button"
              role="tab"
              aria-selected={profileSection === section}
              onClick={() => setProfileSection(section)}
              className={[
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
                profileSection === section
                  ? "border-[var(--cs-success)] text-[var(--cs-text)]"
                  : "border-transparent text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]",
              ].join(" ")}
            >
              {section}
            </button>
          ))}
        </div>

        {profileSection === "overview" && <>
        <div className="mt-5">
          <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Staff information</h3>
          <p className="mb-0 mt-1 text-xs text-[var(--cs-text-muted)]">Work details and contact information</p>
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-3 rounded-xl border border-[var(--cs-border-soft)] p-4 sm:grid-cols-2">
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

        {!isCrm && (
          <div className="mt-5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
            <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Quick Actions</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              {isOwner && onEditStaff ? (
                <Button variant="outline" size="lg" onClick={() => onEditStaff(staff)} className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)]">
                  <UserCog className="size-4" aria-hidden="true" /> {profileActionLabel}
                </Button>
              ) : (
                <QuickAction href={basePath + "/" + staff.id} label={profileActionLabel} Icon={UserCog} />
              )}
              {isOwner && onManageServices && (
                <Button variant="outline" size="lg" onClick={() => onManageServices(staff)} className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)]">
                  <Sparkles className="size-4" aria-hidden="true" /> Manage Services
                </Button>
              )}
              {isOwner && onEditWorkSetup ? (
                <Button variant="outline" size="lg" onClick={() => onEditWorkSetup(staff)} className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)]">
                  <MapPin className="size-4" aria-hidden="true" /> Assign Branch / Role
                </Button>
              ) : (
                <>
                  {isOwner && <QuickAction href={basePath + "/" + staff.id} label="Assign Branch" Icon={MapPin} />}
                  <QuickAction href={basePath + "/" + staff.id} label="Change Role" Icon={ShieldCheck} />
                </>
              )}
              {status === "active" && (
                isOwner && onEditStaff ? (
                  <Button variant="outline" size="lg" onClick={() => onEditStaff(staff)} className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-error-text)]">
                    <UserRoundX className="size-4" aria-hidden="true" /> Deactivate Staff
                  </Button>
                ) : <QuickAction href={basePath + "/" + staff.id} label="Deactivate Staff" Icon={UserRoundX} danger />
              )}
            </div>
          </div>
        )}

        {hasCrmActions && (
          <div className="mt-5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
            <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Quick Actions</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              {onToggleActive && (
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

        </>}

        {profileSection === "services" && (
          <section className="mt-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4" aria-label="Selected staff service capabilities">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Service Capabilities</h3>
                <p className="m-0 mt-1 text-xs text-[var(--cs-text-muted)]">
                  {serviceNames === undefined
                    ? "Open the authorized editor to review assigned services."
                    : `${serviceNames.length} service${serviceNames.length === 1 ? "" : "s"} assigned`}
                </p>
              </div>
              {onManageServices && (
                <Button type="button" size="sm" variant="outline" onClick={() => onManageServices(staff)} className="border-[var(--cs-border)] bg-[var(--cs-surface)]">
                  <Sparkles className="size-4" aria-hidden="true" /> Edit services
                </Button>
              )}
            </div>
            {serviceNames && serviceNames.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {serviceNames.map((name) => (
                  <li key={name} className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-medium text-[var(--cs-text)]">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 mt-3 rounded-lg border border-dashed border-[var(--cs-border)] px-3 py-4 text-xs text-[var(--cs-text-muted)]">
                {serviceNames ? "No services currently assigned." : "Assignments are not available in this view."}
              </p>
            )}
          </section>
        )}

        {profileSection === "access" && (
          <section className="mt-4" aria-label="Selected staff account access">
            <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
              <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Workspace Access</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailRow Icon={ShieldCheck} label="Assigned role" value={meta.badgeLabel} />
                <DetailRow Icon={Building2} label="Assigned branch" value={branchName} />
                <DetailRow Icon={UserCheck} label="Account status" value={getStaffStatusLabel(status)} />
                <DetailRow Icon={UserCog} label="Staff function" value={meta.staffTypeLabel} />
              </dl>
              {onEditWorkSetup && (
                <Button type="button" size="sm" variant="outline" className="mt-3 border-[var(--cs-border)] bg-[var(--cs-surface)]" onClick={() => onEditWorkSetup(staff)}>
                  <UserCog className="size-4" aria-hidden="true" /> Edit work setup
                </Button>
              )}
            </div>
            {isOwner && <StaffAccountAccessPanel key={staff.id} staffId={staff.id} />}
            {!isOwner && (
              <p className="m-0 mt-3 text-xs text-[var(--cs-text-muted)]">
                Additional account diagnostics and recovery controls are restricted to the Owner.
              </p>
            )}
          </section>
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
        className="size-20 rounded-xl border border-[var(--cs-border)] object-cover shadow-[var(--cs-shadow-xs)]"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-20 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[var(--cs-sand-mist)] text-xl font-semibold text-[var(--cs-sand-dark)] shadow-[var(--cs-shadow-xs)]"
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
    <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-x-2 text-sm">
      <Icon className="mt-0.5 size-4 text-[var(--cs-text-muted)]" aria-hidden={true} />
      <div className="min-w-0">
        <dt className="text-xs text-[var(--cs-text-muted)]">{label}</dt>
        <dd className="m-0 mt-0.5 min-w-0 break-words font-medium text-[var(--cs-text)]">{value}</dd>
      </div>
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
