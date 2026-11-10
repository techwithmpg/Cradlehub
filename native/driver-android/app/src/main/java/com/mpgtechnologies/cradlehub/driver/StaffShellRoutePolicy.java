package com.mpgtechnologies.cradlehub.driver;

import java.util.regex.Pattern;

/**
 * Presentation-only launch routing. This does not authorize a staff identity
 * or a booking: the existing CradleHub backend remains authoritative.
 */
final class StaffShellRoutePolicy {
  private static final Pattern BOOKING_ID = Pattern.compile(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private StaffShellRoutePolicy() { }

  static boolean validBookingId(String id) {
    return id != null && BOOKING_ID.matcher(id).matches();
  }

  static String initialPath(String id) {
    return validBookingId(id) ? "/staff/driver/map?bookingId=" + id : "/staff/";
  }
}
