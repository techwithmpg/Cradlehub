package com.mpgtechnologies.cradlehub.driver;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public final class StaffShellRoutePolicyTest {
  private static final String BOOKING = "11111111-1111-4111-8111-111111111111";

  @Test public void freshLaunchAlwaysUsesSharedStaffRoleRouter() {
    assertEquals("/staff/", StaffShellRoutePolicy.initialPath(null));
    assertEquals("/staff/", StaffShellRoutePolicy.initialPath(""));
  }

  @Test public void validDriverNotificationOpensOnlyTheCanonicalRoute() {
    assertTrue(StaffShellRoutePolicy.validBookingId(BOOKING));
    assertEquals("/staff/driver/map?bookingId=" + BOOKING,
        StaffShellRoutePolicy.initialPath(BOOKING));
  }

  @Test public void malformedOrInjectedBookingIdsFallBackToStaffRouter() {
    assertFalse(StaffShellRoutePolicy.validBookingId("../owner"));
    assertFalse(StaffShellRoutePolicy.validBookingId(BOOKING + "&launch=native"));
    assertFalse(StaffShellRoutePolicy.validBookingId("https://evil.example"));
    assertEquals("/staff/", StaffShellRoutePolicy.initialPath(BOOKING + "&launch=native"));
  }
}
