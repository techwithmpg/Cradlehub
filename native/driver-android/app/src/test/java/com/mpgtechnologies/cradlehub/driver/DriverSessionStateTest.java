package com.mpgtechnologies.cradlehub.driver;

import static org.junit.Assert.*;

import org.junit.Test;

public class DriverSessionStateTest {
  @Test
  public void sameTripDoesNotResetGuidance() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "delivery", "delivery_enroute", 3);
    s.routeReady = true;
    s.guiding = true;
    assertFalse(s.select("a"));
    assertTrue(s.routeReady);
    assertTrue(s.guiding);
  }

  @Test
  public void cannotReplaceAnActiveTrip() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.guiding = true;
    try {
      s.select("b");
      fail();
    } catch (IllegalStateException expected) {
      assertEquals("a", s.bookingId);
    }
  }

  @Test
  public void delayedReplyCannotReopenEarlierLeg() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "collection", "collection_arrived", 8);
    assertFalse(s.apply("a", "delivery", "delivery_enroute", 3));
    assertEquals("collection_arrived", s.stage);
  }

  @Test
  public void anotherTripResponseIsIgnored() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    assertFalse(s.apply("b", "pickup", "pickup_enroute", 2));
  }

  @Test
  public void newLegRequiresFreshRouteWithoutChangingBookingAuthority() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "pickup", "pickup_arrived", 2);
    s.routeReady = true;
    assertTrue(s.apply("a", "delivery", "delivery_pending", 3));
    assertFalse(s.routeReady);
    assertFalse(s.travelling());
  }

  @Test
  public void signOutErasesRestorationHints() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.guiding = true;
    s.clear();
    assertNull(s.bookingId);
    assertFalse(s.guiding);
    assertFalse(s.routeReady);
  }

  @Test
  public void arrivalNeverMeansBoarding() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "collection", "collection_arrived", 8);
    assertFalse(s.travelling());
    assertEquals("collection_arrived", s.stage);
  }

  @Test(expected = IllegalArgumentException.class)
  public void rejectsUnknownServerStage() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "delivery", "unknown_enroute", 1);
  }

  @Test(expected = IllegalArgumentException.class)
  public void rejectsMismatchedLeg() {
    DriverSessionState s = new DriverSessionState();
    s.select("a");
    s.apply("a", "collection", "pickup_enroute", 1);
  }
}
