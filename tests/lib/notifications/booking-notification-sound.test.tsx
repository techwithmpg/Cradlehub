/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingNotificationSound } from "@/components/features/notifications/booking-notification-sound";
import { dispatchBookingNotificationSound } from "@/components/features/notifications/notification-sound-preference";

const oscillatorStart = vi.fn();

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

class AudioContextMock {
  currentTime = 0;
  destination = {};
  state: AudioContextState = "running";
  createOscillator() {
    return {
      connect: vi.fn(),
      frequency: { value: 0 },
      start: oscillatorStart,
      stop: vi.fn(),
      type: "sine",
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
      },
    };
  }
  resume() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  oscillatorStart.mockClear();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  vi.stubGlobal("AudioContext", AudioContextMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BookingNotificationSound", () => {
  it("plays the existing two-tone chime once after audio is unlocked", () => {
    render(<BookingNotificationSound />);
    fireEvent.click(document.body);
    act(() => dispatchBookingNotificationSound("notification-1"));
    act(() => dispatchBookingNotificationSound("notification-1"));
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
  });

  it("respects the existing local sound preference", () => {
    localStorage.setItem("cradlehub_notification_sound_enabled", "false");
    render(<BookingNotificationSound />);
    fireEvent.click(document.body);
    act(() => dispatchBookingNotificationSound("notification-2"));
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
});
