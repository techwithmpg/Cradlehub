package com.mpgtechnologies.cradlehub.driver;

/** Activity-independent state. Restoration hints never authorize a trip. */
public final class DriverSessionState {
  private static final DriverSessionState RUNTIME = new DriverSessionState();

  public static DriverSessionState runtime() {
    return RUNTIME;
  }

  public String bookingId, leg, stage;
  public int revision = -1;
  public boolean routeReady, guiding, pending, unified;
  public long generation;

  public boolean select(String id) {
    if (id.equals(bookingId)) return false;
    if (guiding || pending)
      throw new IllegalStateException("Return to the active trip before selecting another.");
    bookingId = id;
    leg = null;
    stage = null;
    revision = -1;
    routeReady = false;
    generation++;
    return true;
  }

  public boolean apply(String id, String nextLeg, String nextStage, int nextRevision) {
    if (!id.equals(bookingId) || nextRevision < revision) return false;
    String expectedLeg;
    switch (nextStage) {
      case "pickup_pending":
      case "pickup_enroute":
      case "pickup_arrived":
        expectedLeg = "pickup";
        break;
      case "delivery_pending":
      case "delivery_enroute":
        expectedLeg = "delivery";
        break;
      case "collection_pending":
      case "collection_enroute":
      case "collection_arrived":
        expectedLeg = "collection";
        break;
      case "return_pending":
      case "return_enroute":
      case "return_arrived":
        expectedLeg = "return";
        break;
      case "customer_arrived":
      case "service_active":
      case "complete":
      case "review":
        expectedLeg = null;
        break;
      default:
        throw new IllegalArgumentException("Unknown journey stage");
    }
    if (nextRevision < 0 || !java.util.Objects.equals(expectedLeg, nextLeg))
      throw new IllegalArgumentException("Journey stage and leg disagree");
    boolean changed = leg != null && !leg.equals(nextLeg);
    leg = nextLeg;
    stage = nextStage;
    revision = nextRevision;
    if (changed) {
      routeReady = false;
      guiding = false;
      generation++;
    }
    return true;
  }

  public boolean travelling() {
    return stage != null && stage.endsWith("_enroute");
  }

  public void clear() {
    bookingId = null;
    leg = null;
    stage = null;
    revision = -1;
    routeReady = false;
    guiding = false;
    pending = false;
    unified = false;
    generation++;
  }
}
