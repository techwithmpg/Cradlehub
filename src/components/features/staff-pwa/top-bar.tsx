"use client";

import Link from "next/link";
import { ArrowLeft, Bell, User as UserIcon } from "lucide-react";
import type { StaffTopBarProps } from "./types";
import { cn } from "@/lib/utils";

export function StaffTopBar({
  title,
  brandTitle = "CradleHub",
  isToday = false,
  onBack,
  backHref,
  backLabel = "Go back",
  unreadNoticeCount = 0,
  onNoticeClick,
  noticeHref = "/staff-portal/notices",
  userAvatarUrl,
  userName,
  roleChipLabel,
  branchName,
  businessDateLabel,
  rightAction,
}: StaffTopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-[#EAE4DC] bg-[#F7F3EB]/95 backdrop-blur-md transition-colors"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        {isToday ? (
          // Today View: Brand wordmark on the left
          <div className="flex items-center gap-2">
            <span
              className="font-serif text-xl font-bold tracking-tight text-[#163A2B]"
              aria-label={brandTitle}
            >
              {brandTitle}
            </span>
            <span className="rounded-full bg-[#163A2B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#163A2B]">
              Staff
            </span>
          </div>
        ) : (
          // Inner View: Back navigation button
          <div className="flex items-center">
            {backHref ? (
              <Link
                href={backHref}
                aria-label={backLabel}
                className="flex h-12 w-12 items-center justify-center rounded-lg text-[#1E293B] transition hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </Link>
            ) : onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="flex h-12 w-12 items-center justify-center rounded-lg text-[#1E293B] transition hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}

        {/* Center: Inner Page Title */}
        {!isToday && title ? (
          <h1 className="max-w-[200px] truncate text-center text-base font-semibold text-[#1E293B]">
            {title}
          </h1>
        ) : null}

        {/* Right Area */}
        <div className="flex items-center gap-1">
          {rightAction ? (
            rightAction
          ) : isToday ? (
            <>
              {/* Notices Bell */}
              {noticeHref ? (
                <Link
                  href={noticeHref}
                  aria-label={
                    unreadNoticeCount > 0
                      ? `${unreadNoticeCount} unread notices`
                      : "Notices"
                  }
                  className="relative flex h-12 w-12 items-center justify-center rounded-lg text-[#1E293B] transition hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
                >
                  <Bell size={20} aria-hidden="true" />
                  {unreadNoticeCount > 0 ? (
                    <span className="absolute right-2 top-2 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#9B1C20] px-1 text-[10px] font-bold leading-none text-white">
                      {unreadNoticeCount > 99 ? "99+" : unreadNoticeCount}
                    </span>
                  ) : null}
                </Link>
              ) : onNoticeClick ? (
                <button
                  type="button"
                  onClick={onNoticeClick}
                  aria-label={
                    unreadNoticeCount > 0
                      ? `${unreadNoticeCount} unread notices`
                      : "Notices"
                  }
                  className="relative flex h-12 w-12 items-center justify-center rounded-lg text-[#1E293B] transition hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
                >
                  <Bell size={20} aria-hidden="true" />
                  {unreadNoticeCount > 0 ? (
                    <span className="absolute right-2 top-2 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#9B1C20] px-1 text-[10px] font-bold leading-none text-white">
                      {unreadNoticeCount > 99 ? "99+" : unreadNoticeCount}
                    </span>
                  ) : null}
                </button>
              ) : null}

              {/* User Avatar */}
              <div
                className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#EAE4DC] bg-[#FFFFFF] text-[#1E293B] shadow-xs"
                title={userName ?? "Staff User"}
                aria-label={userName ? `Profile of ${userName}` : "Staff Profile"}
              >
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userAvatarUrl}
                    alt={userName ? `${userName}'s avatar` : "Staff Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon size={18} className="text-[#64748B]" aria-hidden="true" />
                )}
              </div>
            </>
          ) : (
            // Placeholder right area to maintain symmetric center alignment
            <div className="w-12" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Today Greeting & Context Ribbon */}
      {isToday && (userName || roleChipLabel || branchName || businessDateLabel) ? (
        <div className="mx-auto flex max-w-md flex-col gap-1 border-t border-[#EAE4DC]/60 px-4 py-2 text-xs text-[#475569]">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#1E293B]">
              {userName ? `Good day, ${userName}` : "Welcome"}
            </span>
            {roleChipLabel ? (
              <span className="rounded-md bg-[#163A2B]/10 px-2 py-0.5 font-semibold text-[#163A2B]">
                {roleChipLabel}
              </span>
            ) : null}
          </div>
          {(branchName || businessDateLabel) && (
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span>{branchName ?? ""}</span>
              <span>{businessDateLabel ?? ""}</span>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
