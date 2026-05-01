import type { StaffWeekDay, StaffWeekSummary } from "@/lib/staff-portal/week";

export function groupAppointmentsByDay(days: StaffWeekDay[]): Record<string, StaffWeekDay["appointments"]> {
  return days.reduce<Record<string, StaffWeekDay["appointments"]>>((acc, day) => {
    acc[day.date] = day.appointments;
    return acc;
  }, {});
}

export function calculateTotalMinutesPerDay(day: StaffWeekDay): number {
  return day.totalMinutes;
}

export function formatAppointmentCountText(count: number): string {
  const noun = count === 1 ? "appt" : "appts";
  return `${count} ${noun}`;
}

export function formatBookedHoursFromMinutes(totalMinutes: number): string {
  const hours = Math.round((totalMinutes / 60) * 10) / 10;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

export function detectCurrentDay(days: StaffWeekDay[]): StaffWeekDay | null {
  return days.find((day) => day.isToday) ?? null;
}

export function calculateWeeklyStats(days: StaffWeekDay[]): StaffWeekSummary {
  let totalAppointments = 0;
  let homeService = 0;
  let inSpa = 0;
  let walkIn = 0;
  let online = 0;
  let totalMinutes = 0;

  for (const day of days) {
    totalAppointments += day.appointmentCount;
    totalMinutes += day.totalMinutes;
    for (const appointment of day.appointments) {
      if (appointment.bookingType === "home_service") homeService += 1;
      if (appointment.bookingType === "walk_in") walkIn += 1;
      if (appointment.bookingType === "online") online += 1;
      if (appointment.bookingType !== "home_service") inSpa += 1;
    }
  }

  return {
    totalAppointments,
    homeService,
    inSpa,
    walkIn,
    online,
    hoursBooked: Math.round((totalMinutes / 60) * 100) / 100,
    upcoming: totalAppointments,
  };
}

export function pickDefaultExpandedDay(days: StaffWeekDay[]): string | null {
  if (days.length === 0) return null;

  const todayIndex = days.findIndex((day) => day.isToday);
  if (todayIndex === -1) {
    return days.find((day) => day.appointmentCount > 0)?.date ?? null;
  }

  const today = days[todayIndex];
  if (today && today.appointmentCount > 0) return today.date;

  const afterToday = days.slice(todayIndex + 1).find((day) => day.appointmentCount > 0);
  if (afterToday) return afterToday.date;

  const beforeToday = days.slice(0, todayIndex).find((day) => day.appointmentCount > 0);
  if (beforeToday) return beforeToday.date;

  return null;
}
