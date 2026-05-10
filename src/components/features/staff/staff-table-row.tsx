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
  getStaffStatus,
  type StaffMember,
  type StaffTab,
} from "./staff-management-utils";

type StaffTableRowProps = {
  member: StaffMember;
  activeTab: StaffTab;
  isSelected: boolean;
  onSelectStaff: (staff: StaffMember) => void;
  workspaceContext?: "owner" | "manager";
};

export function StaffTableRow({
  member,
  activeTab,
  isSelected,
  onSelectStaff,
  workspaceContext = "owner",
}: StaffTableRowProps) {
  const status = getStaffStatus(member);
  const meta = getStaffDisplayMeta(member);
  const displayName = status === "invited" ? "Invite link generated" : member.full_name;
  const position =
    status === "invited"
      ? "Pending invitation"
      : meta.tierLabel
        ? `${meta.roleLabel} · ${meta.tierLabel}`
        : meta.roleLabel;
  const subtitle = status === "invited" ? "Pending invitation" : meta.subtitle;
  const basePath = `/${workspaceContext}/staff`;

  return (
    <tr
      aria-selected={isSelected}
      className={[
        "border-b border-[var(--cs-border-soft)] last:border-b-0",
        isSelected ? "bg-[var(--cs-sand-tint)]" : "bg-[var(--cs-surface)]",
      ].join(" ")}
    >
      <td className="px-4 py-2.5 align-middle">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelectStaff(member)}
          aria-label={`Select ${displayName}`}
          className="size-4 rounded border-[var(--cs-border-strong)] accent-[var(--cs-sand)]"
        />
      </td>
      <td className="min-w-[230px] px-3 py-2.5 align-middle">
        <button
          type="button"
          onClick={() => onSelectStaff(member)}
          className="flex max-w-full items-center gap-3 text-left"
          aria-current={isSelected ? "true" : undefined}
        >
          <StaffAvatar member={member} label={displayName} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--cs-text)]">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[var(--cs-text-muted)]">
              {subtitle}
            </span>
          </span>
        </button>
      </td>
      <td className="max-w-[190px] px-3 py-2.5 align-middle text-sm text-[var(--cs-text-secondary)]">
        <span className="block truncate">{position}</span>
      </td>
      <td className="px-3 py-2.5 align-middle text-sm text-[var(--cs-text-secondary)]">
        <span className="block truncate">
          {member.phone && member.phone !== "0000000000" ? member.phone : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <StaffStatusBadge status={status} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <StaffRoleBadge staff={member} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <StaffRowActions
          member={member}
          activeTab={activeTab}
          onSelectStaff={onSelectStaff}
          basePath={basePath}
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
  basePath,
}: {
  member: StaffMember;
  activeTab: StaffTab;
  onSelectStaff: (staff: StaffMember) => void;
  basePath: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
            aria-label={`Open actions for ${member.full_name}`}
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
        <DropdownMenuItem>
          <Link href={`${basePath}/${member.id}`} className="flex w-full items-center gap-2">
            <Pencil className="size-4" aria-hidden="true" />
            {activeTab === "pending" ? "Review profile" : "Edit profile"}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
