/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import {
  BOOKINGS_CHANGED_EVENT,
  notifyBookingsChanged,
} from "@/lib/bookings/bookings-client-events";

describe("booking client events", () => {
  it("notifies mounted booking and dispatch caches after a canonical mutation", () => {
    const listener = vi.fn();
    window.addEventListener(BOOKINGS_CHANGED_EVENT, listener);

    notifyBookingsChanged();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(BOOKINGS_CHANGED_EVENT, listener);
  });
});
