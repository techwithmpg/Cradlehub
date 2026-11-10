package com.mpgtechnologies.cradlehub.driver;

/**
 * Local UI-only preview state. No customer, booking or authorization data is
 * ever persisted here. Live status changes remain in CradleHub server flows.
 */
final class DriverPreviewState {
  enum Screen { TODAY, TRIPS, NAVIGATION, ARRIVAL, MORE }
  enum Filter { TODAY, UPCOMING, COMPLETED }
  private Screen screen;
  private Filter filter;
  private int sampleTrip;

  DriverPreviewState(String screenName, String filterName, int sampleTrip) {
    this.screen = parseScreen(screenName);
    this.filter = parseFilter(filterName);
    this.sampleTrip = sampleTrip == 2 ? 2 : 1;
  }

  static Screen parseScreen(String value) {
    if (value != null) {
      try { return Screen.valueOf(value); } catch (IllegalArgumentException ignored) { }
    }
    return Screen.TODAY;
  }

  static Filter parseFilter(String value) {
    if (value != null) {
      try { return Filter.valueOf(value); } catch (IllegalArgumentException ignored) { }
    }
    return Filter.TODAY;
  }

  Screen screen() { return screen; }
  Filter filter() { return filter; }
  int sampleTrip() { return sampleTrip; }

  void showTab(Screen tab) {
    if (tab != Screen.TODAY && tab != Screen.TRIPS && tab != Screen.MORE) {
      throw new IllegalArgumentException("Not a navigation tab");
    }
    screen = tab;
  }

  void filter(Filter next) {
    filter = next;
  }

  void openTrip(int number) {
    if (number != 1 && number != 2) throw new IllegalArgumentException("Invalid demo trip");
    sampleTrip = number;
    screen = Screen.NAVIGATION;
  }

  void arrive() {
    if (screen != Screen.NAVIGATION) throw new IllegalStateException("Trip not in preview navigation");
    screen = Screen.ARRIVAL;
  }

  void next() {
    if (screen != Screen.ARRIVAL) throw new IllegalStateException("No demo arrival to advance");
    if (sampleTrip == 1) openTrip(2);
    else screen = Screen.TRIPS;
  }

  void back() {
    if (screen == Screen.NAVIGATION || screen == Screen.ARRIVAL) screen = Screen.TRIPS;
    else if (screen != Screen.TODAY) screen = Screen.TODAY;
  }
}
