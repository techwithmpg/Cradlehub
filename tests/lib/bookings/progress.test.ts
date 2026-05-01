import { describe, it, expect } from "vitest";
import {
  canTransitionBookingProgress,
  getNextAllowedProgressActions,
  getBookingProgressLabel,
  isBookingProgressTerminal,
  getTimestampFieldForProgressStatus,
  getNextBookingProgressStatus,
  BOOKING_PROGRESS_STATUSES,
} from "../../../src/lib/bookings/progress";

describe("booking progress state machine", () => {
  describe("home_service flow", () => {
    it("allows not_started → travel_started", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "not_started",
          nextStatus: "travel_started",
        })
      ).toBe(true);
    });

    it("allows travel_started → arrived", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "travel_started",
          nextStatus: "arrived",
        })
      ).toBe(true);
    });

    it("allows arrived → session_started", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "arrived",
          nextStatus: "session_started",
        })
      ).toBe(true);
    });

    it("allows session_started → completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "session_started",
          nextStatus: "completed",
        })
      ).toBe(true);
    });

    it("blocks not_started → checked_in", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "not_started",
          nextStatus: "checked_in",
        })
      ).toBe(false);
    });

    it("blocks not_started → arrived", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "not_started",
          nextStatus: "arrived",
        })
      ).toBe(false);
    });

    it("blocks travel_started → completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "travel_started",
          nextStatus: "completed",
        })
      ).toBe(false);
    });

    it("blocks completed → anything", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "completed",
          nextStatus: "travel_started",
        })
      ).toBe(false);
    });
  });

  describe("walkin (in-spa) flow", () => {
    it("allows not_started → checked_in", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "not_started",
          nextStatus: "checked_in",
        })
      ).toBe(true);
    });

    it("allows checked_in → session_started", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "checked_in",
          nextStatus: "session_started",
        })
      ).toBe(true);
    });

    it("allows session_started → completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "session_started",
          nextStatus: "completed",
        })
      ).toBe(true);
    });

    it("allows not_started → no_show", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "not_started",
          nextStatus: "no_show",
        })
      ).toBe(true);
    });

    it("allows checked_in → no_show", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "checked_in",
          nextStatus: "no_show",
        })
      ).toBe(true);
    });

    it("blocks not_started → travel_started", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "not_started",
          nextStatus: "travel_started",
        })
      ).toBe(false);
    });

    it("blocks walkin checked_in → arrived", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "walkin",
          currentStatus: "checked_in",
          nextStatus: "arrived",
        })
      ).toBe(false);
    });
  });

  describe("online flow", () => {
    it("allows not_started → session_started", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "online",
          currentStatus: "not_started",
          nextStatus: "session_started",
        })
      ).toBe(true);
    });

    it("allows session_started → completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "online",
          currentStatus: "session_started",
          nextStatus: "completed",
        })
      ).toBe(true);
    });

    it("blocks online not_started → checked_in", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "online",
          currentStatus: "not_started",
          nextStatus: "checked_in",
        })
      ).toBe(false);
    });
  });

  describe("getNextAllowedProgressActions", () => {
    it("returns correct actions for home_service not_started", () => {
      expect(
        getNextAllowedProgressActions({
          bookingType: "home_service",
          currentStatus: "not_started",
        })
      ).toEqual(["travel_started"]);
    });

    it("returns correct actions for walkin not_started", () => {
      expect(
        getNextAllowedProgressActions({
          bookingType: "walkin",
          currentStatus: "not_started",
        })
      ).toEqual(["checked_in", "no_show"]);
    });

    it("returns empty for completed", () => {
      expect(
        getNextAllowedProgressActions({
          bookingType: "home_service",
          currentStatus: "completed",
        })
      ).toEqual([]);
    });
  });

  describe("getNextBookingProgressStatus", () => {
    it("returns travel_started for home_service not_started", () => {
      expect(
        getNextBookingProgressStatus({
          bookingType: "home_service",
          currentStatus: "not_started",
        })
      ).toBe("travel_started");
    });

    it("returns checked_in for walkin not_started", () => {
      expect(
        getNextBookingProgressStatus({
          bookingType: "walkin",
          currentStatus: "not_started",
        })
      ).toBe("checked_in");
    });

    it("returns null for completed", () => {
      expect(
        getNextBookingProgressStatus({
          bookingType: "home_service",
          currentStatus: "completed",
        })
      ).toBeNull();
    });
  });

  describe("getBookingProgressLabel", () => {
    it("returns correct labels", () => {
      expect(getBookingProgressLabel("not_started")).toBe("Not started");
      expect(getBookingProgressLabel("checked_in")).toBe("Checked in");
      expect(getBookingProgressLabel("travel_started")).toBe("Travel started");
      expect(getBookingProgressLabel("arrived")).toBe("Arrived");
      expect(getBookingProgressLabel("session_started")).toBe("Session in progress");
      expect(getBookingProgressLabel("completed")).toBe("Completed");
      expect(getBookingProgressLabel("no_show")).toBe("No show");
    });
  });

  describe("isBookingProgressTerminal", () => {
    it("returns true for completed and no_show", () => {
      expect(isBookingProgressTerminal("completed")).toBe(true);
      expect(isBookingProgressTerminal("no_show")).toBe(true);
    });

    it("returns false for all other statuses", () => {
      for (const status of BOOKING_PROGRESS_STATUSES) {
        if (status !== "completed" && status !== "no_show") {
          expect(isBookingProgressTerminal(status)).toBe(false);
        }
      }
    });
  });

  describe("getTimestampFieldForProgressStatus", () => {
    it("maps statuses to correct timestamp columns", () => {
      expect(getTimestampFieldForProgressStatus("checked_in")).toBe("checked_in_at");
      expect(getTimestampFieldForProgressStatus("travel_started")).toBe("travel_started_at");
      expect(getTimestampFieldForProgressStatus("arrived")).toBe("arrived_at");
      expect(getTimestampFieldForProgressStatus("session_started")).toBe("session_started_at");
      expect(getTimestampFieldForProgressStatus("completed")).toBe("session_completed_at");
      expect(getTimestampFieldForProgressStatus("no_show")).toBe("no_show_at");
      expect(getTimestampFieldForProgressStatus("not_started")).toBeNull();
    });
  });
});
