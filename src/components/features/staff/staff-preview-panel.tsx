"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  ShieldCheck,
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
import {
  formatStaffDate,
  getStaffDisplayMeta,
  getInitials,
  getStaffStatus,
  getStaffStatusLabel,
  readBranchName,
  type StaffMember,
} from "./staff-management-utils";

type StaffPreviewPanelProps = {
  staff: StaffMember | null;
  onClearSelection: () => void;
  workspaceContext?: "owner" | "manager";
};

export function StaffPreviewPanel({ staff, onClearSelection, workspaceContext = "owner" }: StaffPreviewPanelProps) {
  const isOwner = workspaceContext === "owner";
  const basePath = `/${workspaceContext}/staff`;

  if (!staff) {
    return (
      <aside className="self-start rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] p-6 text-center text-sm text-[var(--cs-text-muted)] xl:sticky xl:top-20">
        Select a staff member to view details.
      </aside>
    );
  }

  const status = getStaffStatus(staff);
  const meta = getStaffDisplayMeta(staff);
  const branchName = readBranchName(staff.branches);
  const displayName = status === "invited" ? "Invite link generated" : staff.full_name;
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
              <DropdownMenuItem>
                <Link href={`${basePath}/${staff.id}`} className="flex w-full items-center gap-2">
                  <UserCog className="size-4" aria-hidden="true" />
                  Edit profile
                </Link>
              </DropdownMenuItem>
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
        <div className="flex flex-col items-center text-center">
          <ProfileAvatar staff={staff} label={displayName} />
          <h2 className="mt-3 mb-0 text-lg font-semibold text-[var(--cs-text)]">{displayName}</h2>
          <p className="mt-1 mb-0 text-sm text-[var(--cs-text-secondary)]">{displayPosition}</p>
          <div className="mt-3">
            <StaffRoleBadge staff={staff} />
          </div>
        </div>

        <dl className="mt-5 space-y-2.5">
          <DetailRow Icon={Building2} label="Branch" value={branchName} />
          <DetailRow Icon={ShieldCheck} label="System Role" value={meta.badgeLabel} />
          <DetailRow Icon={UserCog} label="Staff Type" value={meta.staffTypeLabel} />
          <DetailRow
            Icon={Phone}
            label="Phone"
            value={staff.phone && staff.phone !== "0000000000" ? staff.phone : "—"}
          />
          {staff.email && <DetailRow Icon={Mail} label="Email" value={staff.email} />}
          <DetailRow Icon={UserCheck} label="Status" value={getStaffStatusLabel(status)} />
          <DetailRow Icon={CalendarDays} label="Joined" value={formatStaffDate(staff.created_at)} />
        </dl>

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
            <QuickAction href={`${basePath}/${staff.id}`} label={profileActionLabel} Icon={UserCog} />
            {isOwner && (
              <>
                <QuickAction href={`${basePath}/${staff.id}`} label="Assign Branch" Icon={MapPin} />
                <QuickAction href={`${basePath}/${staff.id}`} label="Change Role" Icon={ShieldCheck} />
                {status === "active" && (
                  <QuickAction href={`${basePath}/${staff.id}`} label="Deactivate Staff" Icon={UserRoundX} danger />
                )}
              </>
            )}
          </div>
        </div>
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
