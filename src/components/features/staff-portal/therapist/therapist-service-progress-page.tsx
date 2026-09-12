"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Home,
  Stethoscope,
} from "lucide-react";
import { TherapistServiceProgressCard } from "./therapist-service-progress-card";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

type Tab = "active" | "completed";

type TherapistServiceProgressPageProps = {
  active: StaffPortalBooking[];
  completed: StaffPortalBooking[];
};

export function TherapistServiceProgressPage({
  active,
  completed,
}: TherapistServiceProgressPageProps) {
  const [tab, setTab] = useState<Tab>("active");

  const homeServiceCount = [...active, ...completed].filter(
    (booking) => booking.delivery_type === "home_service"
  ).length;

  const dateLabel = new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-dvh bg-[#F7F3EB]">
      <div className="sticky top-0 z-30 border-b border-[#EAE4DC] bg-[#FBFAF6]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[480px] px-4 pb-0 pt-4">
          <h1 className="text-[26px] font-bold tracking-[-0.035em] text-[#14283A]">
            Service Progress
          </h1>

          <p className="mt-1 max-w-[280px] text-[12px] leading-5 text-[#6F7D8D]">
            Track active work and review completed services.
          </p>

          <div className="mt-4 grid grid-cols-2">
            {(["active", "completed"] as const).map((item) => {
              const selected = item === tab;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={
                    selected
                      ? "relative min-h-11 border-b-2 border-[#0D6548] text-[13px] font-bold text-[#0D6548]"
                      : "relative min-h-11 border-b-2 border-transparent text-[13px] font-medium text-[#756D69]"
                  }
                >
                  {item === "active"
                    ? `Active${active.length ? ` (${active.length})` : ""}`
                    : `Completed${completed.length ? ` (${completed.length})` : ""}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[480px] space-y-3 px-4 pb-5 pt-4">
        <section className="rounded-[20px] border border-[#EAE5DD] bg-white p-3.5 shadow-[0_4px_18px_rgba(30,41,59,0.04)]">
          <div className="mb-3">
            <div className="text-[14px] font-bold text-[#203446]">
              Today&apos;s Summary
            </div>
            <div className="text-[10.5px] text-[#7B8795]">{dateLabel}</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[14px] bg-[#ECF8EF] px-2.5 py-3">
              <CheckCircle2 size={17} className="text-[#1CA862]" />
              <div className="mt-2 text-[18px] font-bold text-[#173D2F]">
                {completed.length}
              </div>
              <div className="text-[9.5px] text-[#577064]">Completed</div>
            </div>

            <div className="rounded-[14px] bg-[#EDF3F8] px-2.5 py-3">
              <Stethoscope size={17} className="text-[#376E93]" />
              <div className="mt-2 text-[18px] font-bold text-[#24445B]">
                {active.length}
              </div>
              <div className="text-[9.5px] text-[#5F7585]">Active</div>
            </div>

            <div className="rounded-[14px] bg-[#FBF5E9] px-2.5 py-3">
              <Home size={17} className="text-[#9A6A24]" />
              <div className="mt-2 text-[18px] font-bold text-[#5A4527]">
                {homeServiceCount}
              </div>
              <div className="text-[9.5px] text-[#78664E]">
                Home Service
              </div>
            </div>
          </div>
        </section>

        {tab === "active" ? (
          active.length > 0 ? (
            <div className="space-y-3">
              {active.map((booking) => (
                <TherapistServiceProgressCard
                  key={booking.id}
                  booking={booking}
                  showControls
                />
              ))}
            </div>
          ) : (
            <section className="flex items-center gap-3 rounded-[20px] border border-[#EAE5DD] bg-white px-4 py-5 shadow-[0_4px_18px_rgba(30,41,59,0.04)]">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F0F4F0] text-[#688074]">
                <Stethoscope size={20} />
              </div>

              <div>
                <div className="text-[14px] font-bold text-[#26394B]">
                  No active service
                </div>
                <div className="mt-1 text-[11.5px] leading-5 text-[#7B8795]">
                  Your active assignment will appear here when it starts.
                </div>
              </div>
            </section>
          )
        ) : completed.length > 0 ? (
          <div className="space-y-3">
            {completed.map((booking) => (
              <TherapistServiceProgressCard
                key={booking.id}
                booking={booking}
                showControls={false}
              />
            ))}
          </div>
        ) : (
          <section className="rounded-[20px] border border-[#EAE5DD] bg-white px-4 py-5 text-center text-[12px] text-[#7B8795] shadow-[0_4px_18px_rgba(30,41,59,0.04)]">
            No completed services yet today.
          </section>
        )}
      </main>
    </div>
  );
}