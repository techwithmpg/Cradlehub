package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import android.view.View;
import android.widget.*;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.maps.GoogleMap.CameraPerspective;
import com.google.android.libraries.navigation.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** One guidance owner per host. Pane changes never recreate the SDK session. */
final class DriverNavigationController {
  private final androidx.appcompat.app.AppCompatActivity host;
  interface Transport { DriverHttp.Reply call(String path, JSONObject body) throws Exception; }
  private final Transport transport;
  private final java.util.function.Consumer<String> authentication;
  private Runnable observer;
  private boolean routing;
  private final NavigationFragment fragment;
  private final TextView status;
  private final Button action;
  private final Button pause;
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private final DriverSessionState state = DriverSessionState.runtime();
  private Navigator navigator;
  private Navigator.ArrivalListener arrival;
  private final LocationManager locations;
  private Location point;
  private boolean watching, loading, destroyed, foreground = true, initializing, autoStart;
  private double targetLat, targetLng;
  private boolean hasTarget;
  private String pendingRequest;
  private String pendingAction;
  private JSONObject pendingPayload;
  private long lastShared;
  private final Runnable poll =
      new Runnable() {
        public void run() {
          if (!destroyed && (foreground || state.guiding)) {
            refresh();
            main.postDelayed(this, 20000);
          }
        }
      };
  private final LocationListener listener =
      new LocationListener() {
        public void onLocationChanged(Location value) {
          point = value;
          if (!state.guiding) return;
          long age =
              android.os.SystemClock.elapsedRealtimeNanos() - value.getElapsedRealtimeNanos();
          if (age < 0
              || age > 30000000000L
              || !value.hasAccuracy()
              || value.getAccuracy() > 50
              || value.getAccuracy() <= 0) return;
          float[] distance = new float[1];
          Location.distanceBetween(
              value.getLatitude(), value.getLongitude(), targetLat, targetLng, distance);
          if (state.unified
              && hasTarget
              && distance[0] + value.getAccuracy() <= 100
              && !state.pending) {
            event("gps_arrival");
          } else if (System.currentTimeMillis() - lastShared >= 30000 && !state.pending) {
            lastShared = System.currentTimeMillis();
            if (state.unified) event("location");
            else shareLegacy(value);
          }
        }
      };

  DriverNavigationController(androidx.appcompat.app.AppCompatActivity h, NavigationFragment f,
      TextView s, Button a, Button p, Transport backend,
      java.util.function.Consumer<String> signIn) {
    host = h; fragment = f; status = s; action = a; pause = p;
    transport = backend; authentication = signIn;
    pause.setOnClickListener(v -> { stopGuidance(); render(); });
    locations = (LocationManager) h.getSystemService(android.content.Context.LOCATION_SERVICE);
    a.setOnClickListener(v -> onAction());
    main.post(poll);
  }

  void setObserver(Runnable callback) { observer = callback; changed(); }
  private void changed() { if (observer != null) observer.run(); }
  private void showStatus(CharSequence text) { status.setText(text); changed(); }
  private void enableAction(boolean enabled) { action.setEnabled(enabled); changed(); }
  private void labelAction(CharSequence label) { action.setText(label); changed(); }
  boolean isRouteReady() { return state.routeReady; }
  String selectedStage() { return state.stage; }
  boolean isLoading() { return loading || initializing || routing || state.pending; }
  void endRoute() { stopGuidance(); render(); }
  private boolean voice = true;
  void toggleVoice() {
    voice = !voice;
    if (navigator != null) navigator.setAudioGuidanceSettings(AudioGuidanceSettings.builder()
      .setGuidanceMode(voice ? AudioGuidanceSettings.GuidanceMode.VOICE_ALERTS_AND_GUIDANCE
        : AudioGuidanceSettings.GuidanceMode.SILENT).build());
  }
  void recenter() {
    fragment.getMapAsync(map -> {
      if (destroyed) return;
      if (host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
          != PackageManager.PERMISSION_GRANTED) {
        showStatus("Allow precise location to recenter.");
        return;
      }
      try {
        map.followMyLocation(CameraPerspective.TILTED);
      } catch (SecurityException removedPermission) {
        showStatus("Location permission was removed. Allow precise location to recenter.");
      }
    });
  }

  String selectedBooking() {
    return state.bookingId;
  }

  boolean isGuiding() {
    return state.guiding;
  }

  boolean hasSelection() {
    return state.bookingId != null;
  }

  void select(String id) {
    try {
      boolean changed = state.select(id);
      if (changed) {
        hasTarget = false;
        pendingRequest = null;
        autoStart = false;
      }
      refresh();
    } catch (IllegalStateException e) {
      showStatus(e.getMessage());
    }
  }

  void show() {
    if (state.bookingId == null) showStatus("Choose an assigned trip from Trips.");
    else if (state.guiding) showStatus("Guidance active · checking current assignment…");
    refresh();
  }

  void resume() {
    foreground = true;
    if (host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && state.guiding) {
      stopGuidance();
      showStatus("Location permission was removed. Allow precise location to resume.");
    }
    main.removeCallbacks(poll);
    main.post(poll);
  }

  void pause() {
    foreground = false;
    if (!state.guiding) main.removeCallbacks(poll);
  }

  private void refresh() {
    if (destroyed || loading || state.pending || state.bookingId == null) return;
    if (state.guiding && navigator != null && !navigator.isGuidanceRunning()) {
      stopGuidance();
      render();
    }
    loading = true; changed();
    String id = state.bookingId;
    long generation = state.generation;
    io.execute(
        () -> {
          try {
            DriverHttp.Reply response =
                transport.call("/api/staff/driver/journeys?bookingId=" + id, null);
            boolean unified = response.status == 200 && response.body.optBoolean("ok");
            if (response.status == 401 || response.status == 403) {
              main.post(
                  () -> {
                    if (id.equals(state.bookingId)) {
                      stopGuidance();
                      state.clear();
                      showStatus("Sign in and check your current assignment.");
                      authentication.accept(id);
                    }
                  });
              return;
            }
            if (unified) {
              JSONArray rows = response.body.optJSONArray("journeys");
              JSONObject journey =
                  rows != null && rows.length() == 1 ? rows.getJSONObject(0) : null;
              if (journey == null) {
                DriverHttp.Reply legacy =
                    transport.call("/api/staff/driver/native-itinerary?bookingId=" + id, null);
                main.post(
                    () -> {
                      if (current(id, generation)) acceptLegacy(id, legacy);
                    });
              } else
                main.post(
                    () -> {
                      if (current(id, generation)) accept(journey, false);
                    });
            } else if (NativeDriverCompatibility.legacyRead(response.status, response.body.optString("code"))) {
              DriverHttp.Reply legacy =
                  transport.call("/api/staff/driver/native-itinerary?bookingId=" + id, null);
              main.post(
                  () -> {
                    if (current(id, generation)) acceptLegacy(id, legacy);
                  });
            } else
              main.post(
                  () -> {
                    if (current(id, generation)) {
                      enableAction(false);
                      showStatus(
                          "Journey status unavailable. Guidance may continue; reconnect before"
                              + " changing trip state.");
                    }
                  });
          } catch (Exception ignored) {
            main.post(
                () -> {
                  if (current(id, generation)) {
                    enableAction(false);
                    showStatus(
                        "Offline · current route may be outdated. Reconnect before acting.");
                  }
                });
          } finally {
            main.post(() -> { loading = false; changed(); });
          }
        });
  }

  private boolean current(String id, long generation) {
    return !destroyed && id.equals(state.bookingId) && generation == state.generation;
  }

  private void accept(JSONObject j, boolean startAuthorized) {
    try {
      String id = j.getString("bookingId"),
          leg = j.isNull("leg") ? null : j.getString("leg"),
          stage = j.getString("stage");
      int revision = j.getInt("revision");
      String oldLeg = state.leg;
      if (!state.apply(id, leg, stage, revision)) return;
      state.unified = true;
      if (pendingPayload != null && pendingPayload.optInt("expectedRevision") != revision) {
        pendingPayload = null;
        pendingRequest = null;
        pendingAction = null;
      }
      if (oldLeg != null && !Objects.equals(oldLeg, leg)) {
        stopGuidance();
        hasTarget = false;
      }
      if ("review".equals(stage) || "complete".equals(stage)) {
        stopGuidance();
        if (navigator != null) navigator.clearDestinations();
        state.routeReady = false; hasTarget = false;
        enableAction(false);
        showStatus(
            "review".equals(stage)
                ? "Assignment changed. Ask dispatch to reconcile this journey."
                : "Transport completed.");
        return;
      }
      JSONObject destination = j.optJSONObject("destination");
      if (destination != null) {
        double lat = destination.getDouble("lat"), lng = destination.getDouble("lng");
        boolean changed = !hasTarget || lat != targetLat || lng != targetLng;
        if (changed) {
          if (state.guiding) {
            stopGuidance();
            showStatus("Destination changed. Recheck the route before restarting.");
          }
          targetLat = lat;
          targetLng = lng;
          hasTarget = validPoint(lat, lng);
          state.routeReady = false;
        }
      } else hasTarget = false;
      if (!state.travelling() && state.guiding) stopGuidance();
      if (startAuthorized) autoStart = true;
      if (hasTarget && (stage.endsWith("_pending") || state.travelling())) prepare();
      render();
      if (autoStart && state.routeReady && state.travelling()) startSdk();
    } catch (Exception ignored) {
      stopGuidance();
      enableAction(false);
      showStatus("Journey response could not be verified.");
    }
  }

  private void acceptLegacy(String id, DriverHttp.Reply reply) {
    try {
      if (reply.status != 200 || !reply.body.optBoolean("ok")) {
        stopGuidance();
        if (navigator != null) navigator.clearDestinations();
        state.routeReady = false; state.stage = null; state.leg = null; hasTarget = false;
        enableAction(false);
        showStatus("Legacy route unavailable. Check your assignment.");
        return;
      }
      JSONArray stops = reply.body.getJSONArray("stops");
      if (stops.length() != 1) throw new IllegalStateException();
      JSONObject stop = stops.getJSONObject(0);
      if (!id.equals(stop.getString("bookingId"))) throw new IllegalStateException();
      double lat = stop.getDouble("lat"), lng = stop.getDouble("lng");
      if (!validPoint(lat, lng)) throw new IllegalStateException();
      state.unified = false;
      state.leg = "delivery";
      state.stage =
          reply.body.optBoolean("requiresTravelStart") ? "delivery_pending" : "delivery_enroute";
      state.revision = 0;
      if (!hasTarget || targetLat != lat || targetLng != lng) {
        targetLat = lat;
        targetLng = lng;
        hasTarget = true;
        state.routeReady = false;
      }
      prepare();
      render();
    } catch (Exception ignored) {
      stopGuidance();
      enableAction(false);
      showStatus("The assigned destination could not be verified.");
    }
  }

  private static boolean validPoint(double lat, double lng) {
    return Double.isFinite(lat)
        && Double.isFinite(lng)
        && Math.abs(lat) <= 90
        && Math.abs(lng) <= 180;
  }

  private void prepare() {
    if ((state.routeReady && navigator != null) || initializing || routing || !hasTarget || destroyed) return;
    if (host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
        != PackageManager.PERMISSION_GRANTED) {
      labelAction("Allow precise location");
      enableAction(true);
      return;
    }
    initializing = true;
    String id = state.bookingId;
    long generation = state.generation;
    NavigationApi.getNavigator(
        host,
        new NavigationApi.NavigatorListener() {
          public void onNavigatorReady(Navigator ready) {
            initializing = false;
            if (!current(id, generation)) return;
            navigator = ready;
            recenter();
            if (arrival != null) ready.removeArrivalListener(arrival);
            arrival =
                event -> {
                  if (event.isFinalDestination())
                    main.post(
                        () -> {
                          if (state.unified) {
                            if (point != null && !state.pending) event("gps_arrival");
                            else
                              showStatus(
                                  "GPS arrival observed. Waiting for fresh accurate location.");
                          } else {
                            stopGuidance();
                            showStatus(
                                "Destination reached · verify arrival in CradleHub. Collection is"
                                    + " not enabled for this legacy trip.");
                          }
                        });
                };
            ready.addArrivalListener(arrival);
            if (state.guiding && ready.isGuidanceRunning()) {
              state.routeReady = true;
              startLocations();
              render();
              return;
            }
            if (ready.isGuidanceRunning()) ready.stopGuidance();
            routing = true;
            ready
                .setDestinations(
                    Collections.singletonList(
                        Waypoint.builder()
                            .setLatLng(targetLat, targetLng)
                            .setTitle("Assigned " + state.leg + " destination")
                            .build()))
                .setOnResultListener(
                    result ->
                        main.post(
                            () -> {
                              routing = false;
                              if (!current(id, generation)) return;
                              if (result == Navigator.RouteStatus.OK) {
                                state.routeReady = true;
                                ready.setAudioGuidanceSettings(
                                    AudioGuidanceSettings.builder()
                                        .setGuidanceMode(
                                            AudioGuidanceSettings.GuidanceMode
                                                .VOICE_ALERTS_AND_GUIDANCE)
                                        .build());
                                render();
                                if (autoStart && state.travelling()) startSdk();
                              } else {
                                enableAction(false);
                                showStatus(
                                    "Route calculation failed. Check location, connection and"
                                        + " dispatch destination.");
                              }
                            }));
          }

          public void onError(int code) {
            initializing = false;
            if (current(id, generation)) {
              enableAction(false);
              showStatus(
                  "Native navigation is unavailable. Check permissions, Google key and terms.");
            }
          }
        });
  }

  private void render() {
    if (hasTarget && (state.travelling() || (state.stage != null && state.stage.endsWith("_pending")))
        && host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      action.setVisibility(View.VISIBLE); pause.setVisibility(View.GONE);
      labelAction("Allow precise location"); enableAction(true); showStatus("Location permission needed"); return;
    }
    pause.setVisibility(state.guiding ? View.VISIBLE : View.GONE);
    if (state.guiding) {
      action.setVisibility(View.GONE);
      showStatus("Navigating · " + state.leg + " · CRM updates require connectivity");
      return;
    }
    action.setVisibility(View.VISIBLE);
    boolean boarding =
        "pickup_arrived".equals(state.stage) || "collection_arrived".equals(state.stage);
    boolean finish = "return_arrived".equals(state.stage);
    labelAction(
        boarding
            ? ("pickup_arrived".equals(state.stage) ? "Therapist on board" : "Therapist collected")
            : finish
                ? "Confirm branch drop-off"
                : state.travelling()
                    ? "Resume navigation"
                    : "Start " + (state.leg == null ? "" : state.leg) + " navigation");
    enableAction(!state.pending && (boarding || finish || state.routeReady));
    showStatus(
        state.unified
            ? (state.stage == null ? "Checking journey…" : state.stage.replace('_', ' '))
            : "Legacy delivery only · pickup and collection service is not enabled");
  }

  private void onAction() {
    if (state.pending) return;
    if ((state.travelling() || (state.stage != null && state.stage.endsWith("_pending")))
        && host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(
          host,
          new String[] {
            Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
          },
          103);
      return;
    }
    if (state.unified) {
      event(
          "pickup_arrived".equals(state.stage) || "collection_arrived".equals(state.stage)
              ? "board"
              : "return_arrived".equals(state.stage)
                  ? "finish_return"
                  : state.travelling() ? "resume" : "start");
    } else legacyStart();
  }

  private void event(String kind) {
    if (state.bookingId == null || state.pending || destroyed) return;
    try {
      JSONObject body =
          new JSONObject()
              .put("bookingId", state.bookingId)
              .put("expectedRevision", state.revision)
              .put("action", kind);
      if (!kind.equals(pendingAction)
          || pendingRequest == null
          || pendingPayload == null
          || pendingPayload.optInt("expectedRevision") != state.revision) {
        pendingRequest = UUID.randomUUID().toString();
        pendingAction = kind;
        pendingPayload = null;
      }
      body.put("requestId", pendingRequest);
      if ("gps_arrival".equals(kind) || "location".equals(kind)) {
        if (point == null) return;
        long age = android.os.SystemClock.elapsedRealtimeNanos() - point.getElapsedRealtimeNanos();
        if (age < 0
            || age > 30000000000L
            || !point.hasAccuracy()
            || point.getAccuracy() <= 0
            || point.getAccuracy() > 50) return;
        body.put(
            "point",
            new JSONObject()
                .put("lat", point.getLatitude())
                .put("lng", point.getLongitude())
                .put("accuracyMeters", point.getAccuracy())
                .put("observedAt", java.time.Instant.ofEpochMilli(point.getTime()).toString()));
      }
      if (pendingPayload != null
          && kind.equals(pendingAction)
          && pendingPayload.optInt("expectedRevision") == state.revision) body = pendingPayload;
      else pendingPayload = body;
      final JSONObject payload = body;
      state.pending = true;
      enableAction(false);
      String id = state.bookingId;
      io.execute(
          () -> {
            try {
              DriverHttp.Reply reply = transport.call("/api/staff/driver/journeys", payload);
              main.post(
                  () -> {
                    if (destroyed || !id.equals(state.bookingId)) return;
                    state.pending = false;
                    if (reply.status == 200
                        && reply.body.optBoolean("ok")
                        && reply.body.optJSONObject("journey") != null) {
                      pendingRequest = null;
                      pendingAction = null;
                      pendingPayload = null;
                      accept(
                          reply.body.optJSONObject("journey"),
                          ("start".equals(kind) || "resume".equals(kind)));
                    } else {
                      pendingRequest = null;
                      pendingAction = null;
                      if (reply.status == 401 || reply.status == 403) {
                        signOut();
                        authentication.accept(id);
                      } else {
                        showStatus(
                            "Update rejected or journey changed. Refreshing before another"
                                + " action.");
                        refresh();
                      }
                    }
                  });
            } catch (Exception ignored) {
              main.post(
                  () -> {
                    state.pending = false;
                    enableAction(false);
                    showStatus("Update not confirmed. Reconnect and refresh before retrying.");
                    refresh();
                  });
            }
          });
    } catch (Exception ignored) {
      state.pending = false;
      showStatus("Cannot send this journey update.");
    }
  }

  private void legacyStart() {
    if (!state.routeReady) return;
    state.pending = true;
    enableAction(false);
    String id = state.bookingId;
    io.execute(
        () -> {
          try {
            DriverHttp.Reply reply =
                transport.call(
                    "/api/staff/driver/native-start", new JSONObject().put("bookingId", id));
            main.post(
                () -> {
                  state.pending = false;
                  if (!id.equals(state.bookingId) || destroyed) return;
                  if (reply.status == 200
                      && reply.body.optBoolean("ok")
                      && id.equals(reply.body.optString("bookingId"))) {
                    state.stage = "delivery_enroute";
                    startSdk();
                  } else {
                    enableAction(false);
                    showStatus("Start was not confirmed. Refresh the assignment.");
                    refresh();
                  }
                });
          } catch (Exception ignored) {
            main.post(
                () -> {
                  state.pending = false;
                  showStatus("Start not confirmed. Reconnect before retrying.");
                });
          }
        });
  }

  private void startSdk() {
    if (navigator == null || !state.routeReady || !state.travelling()) return;
    try { if (!navigator.isGuidanceRunning()) navigator.startGuidance(); }
    catch (RuntimeException error) { stopGuidance(); enableAction(false); showStatus("Guidance could not start. Check location and retry."); return; }
    state.guiding = true;
    autoStart = false;
    startLocations();
    render();
  }

  private void startLocations() {
    if (watching
        || host.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return;
    try {
      locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 5, listener);
      watching = true;
    } catch (RuntimeException ignored) {
      showStatus("Guidance started; CRM GPS sharing is unavailable.");
    }
  }

  private void shareLegacy(Location sample) {
    try {
      JSONObject body =
          new JSONObject()
              .put("bookingId", state.bookingId)
              .put("lat", sample.getLatitude())
              .put("lng", sample.getLongitude())
              .put("accuracyMeters", sample.getAccuracy())
              .put("observedAt", java.time.Instant.ofEpochMilli(sample.getTime()).toString());
      io.execute(
          () -> {
            try {
              transport.call("/api/staff/driver/native-location", body);
            } catch (Exception ignored) {
            }
          });
    } catch (Exception ignored) {
    }
  }

  private void stopGuidance() {
    if (navigator != null && navigator.isGuidanceRunning()) navigator.stopGuidance();
    state.guiding = false;
    pause.setVisibility(View.GONE);
    autoStart = false;
    if (watching) {
      locations.removeUpdates(listener);
      watching = false;
    }
  }

  void signOut() {
    stopGuidance();
    if (navigator != null) navigator.clearDestinations();
    state.clear();
    hasTarget = false;
    pendingRequest = null;
    enableAction(false);
    showStatus("Sign in to view current assignments.");
  }

  void destroy(boolean finishing) {
    destroyed = true;
    observer = null;
    main.removeCallbacksAndMessages(null);
    if (watching) locations.removeUpdates(listener);
    if (navigator != null) {
      if (arrival != null) navigator.removeArrivalListener(arrival);
      if (finishing) {
        stopGuidance();
        navigator.clearDestinations();
        navigator.cleanup();
      }
    }
    if (finishing) state.clear(); else state.pending = false;
    io.shutdownNow();
  }
}
