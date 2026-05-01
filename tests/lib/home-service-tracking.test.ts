import { describe, it, expect } from "vitest";
import {
  getNextHomeServiceTrackingStatus,
  canTransitionHomeServiceTracking,
  getHomeServiceTrackingLabel,
  isHomeServiceTrackingComplete,
  getTimestampFieldForTrackingStatus,
  HOME_SERVICE_TRACKING_STATUSES,
} from "../../src/lib/home-service-tracking";

describe("home-service-tracking state machine", () => {
  describe("getNextHomeServiceTrackingStatus", () => {
    it("returns travel_started from not_started", () => {
      expect(getNextHomeServiceTrackingStatus("not_started")).toBe(
        "travel_started"
      );
    });

    it("returns arrived from travel_started", () => {
      expect(getNextHomeServiceTrackingStatus("travel_started")).toBe(
        "arrived"
      );
    });

    it("returns session_started from arrived", () => {
      expect(getNextHomeServiceTrackingStatus("arrived")).toBe(
        "session_started"
      );
    });

    it("returns completed from session_started", () => {
      expect(getNextHomeServiceTrackingStatus("session_started")).toBe(
        "completed"
      );
    });

    it("returns null from completed", () => {
      expect(getNextHomeServiceTrackingStatus("completed")).toBeNull();
    });
  });

  describe("canTransitionHomeServiceTracking", () => {
    it("allows not_started → travel_started", () => {
      expect(
        canTransitionHomeServiceTracking("not_started", "travel_started")
      ).toBe(true);
    });

    it("allows travel_started → arrived", () => {
      expect(
        canTransitionHomeServiceTracking("travel_started", "arrived")
      ).toBe(true);
    });

    it("allows arrived → session_started", () => {
      expect(
        canTransitionHomeServiceTracking("arrived", "session_started")
      ).toBe(true);
    });

    it("allows session_started → completed", () => {
      expect(
        canTransitionHomeServiceTracking("session_started", "completed")
      ).toBe(true);
    });

    it("blocks not_started → arrived", () => {
      expect(
        canTransitionHomeServiceTracking("not_started", "arrived")
      ).toBe(false);
    });

    it("blocks travel_started → completed", () => {
      expect(
        canTransitionHomeServiceTracking("travel_started", "completed")
      ).toBe(false);
    });

    it("blocks arrived → completed", () => {
      expect(
        canTransitionHomeServiceTracking("arrived", "completed")
      ).toBe(false);
    });

    it("blocks completed → travel_started", () => {
      expect(
        canTransitionHomeServiceTracking("completed", "travel_started")
      ).toBe(false);
    });

    it("blocks same-status transition", () => {
      expect(
        canTransitionHomeServiceTracking("travel_started", "travel_started")
      ).toBe(false);
    });
  });

  describe("getHomeServiceTrackingLabel", () => {
    it("returns correct labels for all statuses", () => {
      expect(getHomeServiceTrackingLabel("not_started")).toBe("Not started");
      expect(getHomeServiceTrackingLabel("travel_started")).toBe(
        "Travel started"
      );
      expect(getHomeServiceTrackingLabel("arrived")).toBe("Arrived");
      expect(getHomeServiceTrackingLabel("session_started")).toBe(
        "Session in progress"
      );
      expect(getHomeServiceTrackingLabel("completed")).toBe("Completed");
    });
  });

  describe("isHomeServiceTrackingComplete", () => {
    it("returns true for completed", () => {
      expect(isHomeServiceTrackingComplete("completed")).toBe(true);
    });

    it("returns false for all other statuses", () => {
      for (const status of HOME_SERVICE_TRACKING_STATUSES) {
        if (status !== "completed") {
          expect(isHomeServiceTrackingComplete(status)).toBe(false);
        }
      }
    });
  });

  describe("getTimestampFieldForTrackingStatus", () => {
    it("maps statuses to correct timestamp columns", () => {
      expect(getTimestampFieldForTrackingStatus("travel_started")).toBe(
        "travel_started_at"
      );
      expect(getTimestampFieldForTrackingStatus("arrived")).toBe("arrived_at");
      expect(getTimestampFieldForTrackingStatus("session_started")).toBe(
        "session_started_at"
      );
      expect(getTimestampFieldForTrackingStatus("completed")).toBe(
        "completed_at"
      );
      expect(getTimestampFieldForTrackingStatus("not_started")).toBeNull();
    });
  });
});
