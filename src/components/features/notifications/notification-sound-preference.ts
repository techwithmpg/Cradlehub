"use client";

export const NOTIFICATION_SOUND_ENABLED_KEY =
  "cradlehub_notification_sound_enabled";
export const BOOKING_NOTIFICATION_EVENT =
  "cradlehub:booking-notification";
export const NOTIFICATION_SOUND_PREFERENCE_EVENT =
  "cradlehub:notification-sound-preference";

export function isNotificationSoundEnabled(): boolean {
  try {
    const value = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY);
    return value === null || value === "true";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // Keep the current session functional when browser storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_SOUND_PREFERENCE_EVENT, { detail: { enabled } })
  );
}

export function dispatchBookingNotificationSound(notificationId: string) {
  window.dispatchEvent(
    new CustomEvent(BOOKING_NOTIFICATION_EVENT, {
      detail: { notificationId },
    })
  );
}
