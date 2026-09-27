"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { formatWeekRange } from "@/lib/staff-portal/week";
import type {
  StaffWeekDay,
  StaffWeekNavigation,
} from "@/lib/staff-portal/week";

type TherapistScheduleListProps = {
  nav: StaffWeekNavigation;
  days: StaffWeekDay[];
};

function appointmentStatusLabel(status: string): string | null {
  if (status === "completed") return "Done";
  if (status === "in_progress") return "Active";
  return null;
}

export function TherapistScheduleList({
  nav,
  days,
}: TherapistScheduleListProps) {
  const pathname = usePathname();

  const initialDate =
    days.find((day) => day.isToday)?.date ??
    days.find((day) => !day.isDayOff)?.date ??
    days[0]?.date ??
    "";

  const [selectedDate, setSelectedDate] = useState(initialDate);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? days[0] ?? null,
    [days, selectedDate]
  );

  const rangeLabel = formatWeekRange(nav.fromDate, nav.toDate);

  const basePath = pathname?.startsWith("/staff")
    ? "/staff/schedule"
    : "/staff-portal/schedule";

  const previousHref = `${basePath}?weekStart=${nav.previousWeekStart}`;
  const nextHref = `${basePath}?weekStart=${nav.nextWeekStart}`;

  const selectedDateLabel = selectedDay
    ? new Date(`${selectedDay.date}T00:00:00`).toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-dvh bg-[#F7F3EB]">
      <div className="sticky top-0 z-30 border-b border-[#EAE4DC] bg-[#FBFAF6]/95 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-bold tracking-[-0.035em] text-[#14283A]">
                Schedule
              </h1>
              <p className="mt-0.5 text-[12px] text-[#7A685F]">
                {rangeLabel}
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={previousHref}
                aria-label="Previous week"
                className="grid size-10 place-items-center rounded-full border border-[#E5DED5] bg-white text-[#2B3D50] shadow-sm active:scale-95"
              >
                <ChevronLeft size={18} />
              </Link>

              <Link
                href={nextHref}
                aria-label="Next week"
                className="grid size-10 place-items-center rounded-full border border-[#E5DED5] bg-white text-[#2B3D50] shadow-sm active:scale-95"
              >
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const selected = day.date === selectedDay?.date;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={
                    selected
                      ? "flex min-h-[58px] flex-col items-center justify-center rounded-[15px] bg-[#0D6548] text-white shadow-[0_7px_18px_rgba(13,101,72,0.18)]"
                      : "flex min-h-[58px] flex-col items-center justify-center rounded-[15px] text-[#35485B] active:bg-white"
                  }
                >
                  <span
                    className={
                      selected
                        ? "text-[10px] font-semibold text-white/80"
                        : day.isToday
                          ? "text-[10px] font-bold text-[#0D6548]"
                          : "text-[10px] font-medium text-[#7B8795]"
                    }
                  >
                    {day.dayNameShort}
                  </span>

                  <span className="mt-1 text-[17px] font-bold">
                    {day.dayOfMonth}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[480px] px-4 pb-5 pt-4">
        {selectedDay ? (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-[16px] font-bold text-[#1D3043]">
                  {selectedDateLabel}
                </div>
                <div className="mt-0.5 text-[11px] text-[#7B8795]">
                  {selectedDay.appointmentCount} service
                  {selectedDay.appointmentCount === 1 ? "" : "s"}
                </div>
              </div>

              {selectedDay.isDayOff ? (
                <span className="rounded-full bg-[#FBF0D8] px-3 py-1 text-[10px] font-bold text-[#8A622B]">
                  Day Off
                </span>
              ) : selectedDay.workHoursLabel ? (
                <span className="rounded-full bg-[#E4F5E8] px-3 py-1 text-[10px] font-bold text-[#156B49]">
                  On Duty
                </span>
              ) : null}
            </div>

            {selectedDay.isDayOff ? (
              <div className="rounded-[22px] border border-[#EAE5DD] bg-white px-5 py-6 text-center shadow-[0_5px_20px_rgba(30,41,59,0.04)]">
                <div className="text-[15px] font-bold text-[#26394B]">
                  Day off
                </div>
                <div className="mt-1 text-[12px] text-[#7B8795]">
                  No scheduled shift for this day.
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute bottom-5 left-[95px] top-5 w-px bg-[#C7DCD1]" />

                <div className="space-y-2">
                  {selectedDay.workHoursLabel ? (
                    <div className="relative grid grid-cols-[82px_1fr] gap-4">
                      <div className="pt-4 text-right text-[11px] font-bold text-[#42556A]">
                        Shift
                      </div>

                      <div className="relative rounded-[17px] bg-[#EDF7F0] px-4 py-3">
                        <span className="absolute -left-[23px] top-[18px] size-3 rounded-full border-[3px] border-[#F7F3EB] bg-[#22B36B]" />

                        <div className="flex items-center gap-2.5">
                          <div className="grid size-9 place-items-center rounded-full bg-white text-[#0D6548]">
                            <Clock3 size={17} />
                          </div>

                          <div>
                            <div className="text-[13px] font-bold text-[#183729]">
                              Regular Shift
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#587063]">
                              {selectedDay.workHoursLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedDay.appointments.map((appointment) => {
                    const homeService =
                      appointment.bookingType === "home_service";

                    const stateLabel = appointmentStatusLabel(
                      appointment.status
                    );

                    return (
                      <div
                        key={appointment.id}
                        className="relative grid grid-cols-[82px_1fr] gap-4"
                      >
                        <div className="pt-4 text-right text-[11px] font-bold text-[#42556A]">
                          {appointment.timeLabel}
                        </div>

                        <div
                          className={
                            homeService
                              ? "relative rounded-[17px] border border-[#F0DFC1] bg-[#FFF8EA] px-4 py-3"
                              : "relative rounded-[17px] border border-[#ECE7DF] bg-white px-4 py-3"
                          }
                        >
                          <span
                            className={
                              homeService
                                ? "absolute -left-[23px] top-[18px] size-3 rounded-full border-[3px] border-[#F7F3EB] bg-[#B07A22]"
                                : "absolute -left-[23px] top-[18px] size-3 rounded-full border-[3px] border-[#F7F3EB] bg-[#0D6548]"
                            }
                          />

                          <div className="flex items-start gap-3">
                            <div
                              className={
                                homeService
                                  ? "grid size-9 shrink-0 place-items-center rounded-full bg-[#F7E7C8] text-[#94621D]"
                                  : "grid size-9 shrink-0 place-items-center rounded-full bg-[#EDF5F0] text-[#0D6548]"
                              }
                            >
                              {homeService ? (
                                <Home size={17} />
                              ) : (
                                <Stethoscope size={17} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-[13px] font-bold text-[#1B3043]">
                                  {appointment.serviceName}
                                </div>

                                {stateLabel ? (
                                  <span className="shrink-0 rounded-full bg-[#E5F5E9] px-2 py-0.5 text-[9.5px] font-bold text-[#16734C]">
                                    {stateLabel}
                                  </span>
                                ) : null}
                              </div>

                              {homeService ? (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#80673D]">
                                  <Home size={12} />
                                  Home Service
                                </div>
                              ) : appointment.roomName ? (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#708092]">
                                  <MapPin size={12} />
                                  {appointment.roomName}
                                </div>
                              ) : null}
                            </div>

                            <ChevronRight
                              size={16}
                              className="mt-2 shrink-0 text-[#718096]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {selectedDay.appointments.length === 0 &&
                  !selectedDay.workHoursLabel ? (
                    <div className="rounded-[20px] border border-[#EAE5DD] bg-white px-4 py-5 text-center text-[12px] text-[#7B8795]">
                      Nothing scheduled for this day.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}