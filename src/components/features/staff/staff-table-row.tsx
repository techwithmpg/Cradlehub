"use client";

import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal, Pencil, UserCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StaffRoleBadge, StaffStatusBadge } from "./staff-badges";
import {
  getStaffDisplayMeta,
  getInitials,
  getStaffInternalName,
  getStaffStatus,
  type StaffMember,
  type StaffTab,
} from "./staff-management-utils";

type StaffTableRowProps = {
  member: StaffMember;
  activeTab: StaffTab;
  isSelected: boolean;
  onSelectStaff: (staff: StaffMember) => void;
  onEditStaff?: (staff: StaffMember) => void;
  workspaceContext?: "owner" | "manager" | "crm";
};

export function StaffTableRow({
  member,
  activeTab,
  isSelected,
  onSelectStaff,
  onEditStaff,
  workspaceContext = "owner",
}: StaffTableRowProps) {
  const status = getStaffStatus(member);
  const meta = getStaffDisplayMeta(member);
  const displayName = status === "invited" ? "Invite link generated" : getStaffInternalName(member);
  const position =
    status === "invited"
      ? "Pending invitation"
      : [meta.staffTypeLabel, member.is_head ? "Head / Supervisor" : null, meta.tierLabel]
        .filter(Boolean)
        .join(" · ");
  const subtitle = status === "invited" ? "Pending invitation" : meta.subtitle;
  const basePath = `/${workspaceContext}/staff`;

  return (
    <tr
      aria-selected={isSelected}
      className={[
        "group border-b border-[var(--cs-border-soft)] last:border-b-0 transition-colors",
        isSelected ? "bg-[var(--cs-success-bg)]" : "bg-[var(--cs-surface)] hover:bg-[var(--cs-surface-warm)]",
      ].join(" ")}
    >
      <td className="min-w-0 py-2 pl-3 pr-1 align-middle">
        <button
          type="button"
          onClick={() => onSelectStaff(member)}
          className="flex w-full min-w-0 items-center gap-3 rounded-lg px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]"
          aria-pressed={isSelected}
          aria-label={["Select", displayName].join(" ")}
        >
          <StaffAvatar member={member} label={displayName} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--cs-text)]">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[var(--cs-text-muted)]">
              {position || subtitle}
            </span>
          </span>
        </button>
      </td>
      <td className="w-24 px-1 py-2 text-right align-middle">
        <StaffStatusBadge status={status} />
        <span className="mt-1 hidden justify-end lg:flex">
          <StaffRoleBadge staff={member} />
        </span>
      </td>
      <td className="w-12 py-2 pl-1 pr-2 text-right align-middle">
        <StaffRowActions
          member={member}
          activeTab={activeTab}
          onSelectStaff={onSelectStaff}
          onEditStaff={onEditStaff}
          basePath={basePath}
          workspaceContext={workspaceContext}
        />
      </td>
    </tr>
  );
}

function StaffAvatar({ member, label }: { member: StaffMember; label: string }) {
  if (member.avatar_url) {
    return (
      <Image
        src={member.avatar_url}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="size-9 shrink-0 rounded-full border border-[var(--cs-border)] object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-sand-mist)] text-xs font-semibold text-[var(--cs-sand-dark)]"
      title={label}
    >
      {getInitials(label)}
    </span>
  );
}

function StaffRowActions({
  member,
  activeTab,
  onSelectStaff,
  onEditStaff,
  basePath,
  workspaceContext,
}: {
  member: StaffMember;
  activeTab: StaffTab;
  onSelectStaff: (staff: StaffMember) => void;
  onEditStaff?: (staff: StaffMember) => void;
  basePath: string;
  workspaceContext: "owner" | "manager" | "crm";
}) {
  const hasEditLink = workspaceContext !== "crm";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
            aria-label={`Open actions for ${getStaffInternalName(member)}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onSelectStaff(member)} className="cursor-pointer">
          <UserCheck className="mr-2 size-4" aria-hidden="true" />
          View in panel
        </DropdownMenuItem>
        {workspaceContext === "crm" && onEditStaff && (
          <DropdownMenuItem onSelect={() => onEditStaff(member)}>
            <Pencil className="mr-2 size-4" aria-hidden="true" />
            Edit profile
          </DropdownMenuItem>
        )}
        {hasEditLink && (
          <DropdownMenuItem>
            <Link href={`${basePath}/${member.id}`} className="flex w-full items-center gap-2">
              <Pencil className="size-4" aria-hidden="true" />
              {activeTab === "pending" ? "Review profile" : "Edit profile"}
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
