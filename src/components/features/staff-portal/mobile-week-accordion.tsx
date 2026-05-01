"use client";

import { useMemo, useState } from "react";
import type { StaffWeekDay } from "@/lib/staff-portal/week";
import { pickDefaultExpandedDay } from "@/lib/staff-portal/week-summary";
import styles from "./my-week-page.module.css";
import { MobileWeekDayRow } from "./mobile-week-day-row";

type MobileWeekAccordionProps = {
  days: StaffWeekDay[];
};

export function MobileWeekAccordion({ days }: MobileWeekAccordionProps) {
  const defaultOpenDay = useMemo(() => pickDefaultExpandedDay(days), [days]);
  const [openDay, setOpenDay] = useState<string | null>(defaultOpenDay);

  return (
    <section className={styles.mobileAccordion}>
      {days.map((day) => (
        <MobileWeekDayRow
          key={day.date}
          day={day}
          isOpen={openDay === day.date}
          onToggle={(date) => {
            setOpenDay((current) => (current === date ? null : date));
          }}
        />
      ))}
    </section>
  );
}
