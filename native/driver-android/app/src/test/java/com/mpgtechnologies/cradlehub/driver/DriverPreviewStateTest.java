package com.mpgtechnologies.cradlehub.driver;

import static org.junit.Assert.*;
import org.junit.Test;

/** No real booking state or authentication is exercised by this preview. */
public final class DriverPreviewStateTest {
  @Test public void invalidRestoreNeverCreatesPrivilegedState() {
    DriverPreviewState model = new DriverPreviewState("UNKNOWN", "BAD", 100);
    assertEquals(DriverPreviewState.Screen.TODAY, model.screen());
    assertEquals(DriverPreviewState.Filter.TODAY, model.filter());
    assertEquals(1, model.sampleTrip());
  }

  @Test public void tripCardGoesStraightToNavigationWithoutDetail() {
    DriverPreviewState model = new DriverPreviewState("TODAY", "TODAY", 1);
    model.openTrip(2);
    assertEquals(DriverPreviewState.Screen.NAVIGATION, model.screen());
    assertEquals(2, model.sampleTrip());
  }

  @Test public void arrivalRequiresNavigationStep() {
    DriverPreviewState model = new DriverPreviewState("TRIPS", "TODAY", 1);
    try { model.arrive(); fail("Arrival cannot precede navigation"); }
    catch (IllegalStateException expected) { }
    model.openTrip(1);
    model.arrive();
    assertEquals(DriverPreviewState.Screen.ARRIVAL, model.screen());
    model.next();
    assertEquals(DriverPreviewState.Screen.NAVIGATION, model.screen());
    assertEquals(2, model.sampleTrip());
  }

  @Test public void navigationTabSelectionCannotPretendToStartTrip() {
    DriverPreviewState model = new DriverPreviewState("TODAY", "TODAY", 1);
    try { model.showTab(DriverPreviewState.Screen.NAVIGATION); fail("No direct navigation tab"); }
    catch (IllegalArgumentException expected) { }
    assertEquals(DriverPreviewState.Screen.TODAY, model.screen());
    model.filter(DriverPreviewState.Filter.UPCOMING);
    model.showTab(DriverPreviewState.Screen.TRIPS);
    assertEquals(DriverPreviewState.Filter.UPCOMING, model.filter());
  }

  @Test public void returnFromNavigationKeepsTripsWorkspace() {
    DriverPreviewState model = new DriverPreviewState("TODAY", "TODAY", 1);
    model.showTab(DriverPreviewState.Screen.TRIPS);
    model.openTrip(1);
    model.back();
    assertEquals(DriverPreviewState.Screen.TRIPS, model.screen());
  }
}
