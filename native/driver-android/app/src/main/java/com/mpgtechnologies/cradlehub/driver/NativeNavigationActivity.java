package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.webkit.CookieManager;
import com.google.android.gms.maps.GoogleMap.CameraPerspective;
import com.google.android.libraries.navigation.ArrivalEvent;
import com.google.android.libraries.navigation.AudioGuidanceSettings;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.NavigationFragment;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.Waypoint;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Fullscreen native Google Navigation UI. Only reads the current driver's
 * authenticated, active booking from CradleHub. No destination in the Intent.
 *
 * Native SDK arrival events are local GPS observations. They do not
 * automatically mutate booking progress or therapist service state.
 */
public final class NativeNavigationActivity extends AppCompatActivity {
  public static final String EXTRA_BOOKING_ID = "bookingId";
  private static final int LOCATION_REQUEST = 201;
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final List<Waypoint> waypoints = new ArrayList<>();
  private Navigator navigator;
  private Navigator.ArrivalListener arrivalListener;
  private TextView status;
  private Button startButton;
  private String selectedBookingId;
  private boolean requiresTravelStart;
  private boolean routeReady;
  private boolean startPending;
  private boolean inGuidance;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_navigation);
    status = findViewById(R.id.navigationStatus);
    startButton = findViewById(R.id.startNavigation);
    startButton.setEnabled(false);
    startButton.setOnClickListener(view -> startConfirmedGuidance());

    selectedBookingId = getIntent().getStringExtra(EXTRA_BOOKING_ID);
    if (selectedBookingId == null || !selectedBookingId.matches(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
      status.setText("Invalid trip. Return to CradleHub.");
      return;
    }
    fetchAssignedRoute(selectedBookingId);
  }

  private void fetchAssignedRoute(String bookingId) {
    io.execute(() -> {
      HttpURLConnection connection = null;
      try {
        String cookie = CookieManager.getInstance().getCookie(DriverShellActivity.WEB_ORIGIN);
        if (cookie == null || cookie.isEmpty()) {
          showStatus("Sign in to CradleHub before starting navigation.");
          return;
        }
        String endpoint = DriverShellActivity.WEB_ORIGIN
            + "/api/staff/driver/native-itinerary?bookingId="
            + URLEncoder.encode(bookingId, "UTF-8");
        connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("Cookie", cookie);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        if (connection.getResponseCode() != 200) {
          showStatus("Trip unavailable. Check your assignment.");
          return;
        }
        byte[] bytes;
        try (InputStream stream = connection.getInputStream();
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
          byte[] block = new byte[4096];
          int count;
          while ((count = stream.read(block)) >= 0) {
            buffer.write(block, 0, count);
            if (buffer.size() > 8192) throw new IllegalStateException("Unexpected route size");
          }
          bytes = buffer.toByteArray();
        }
        JSONObject reply = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        if (!reply.optBoolean("ok") || !bookingId.equals(reply.optString("bookingId"))) {
          showStatus("The assigned route could not be verified.");
          return;
        }
        requiresTravelStart = reply.optBoolean("requiresTravelStart", false);
        JSONArray stops = reply.getJSONArray("stops");
        if (stops.length() != 1) {
          showStatus("The assigned route is not ready for this version.");
          return;
        }
        JSONObject stop = stops.getJSONObject(0);
        if (!bookingId.equals(stop.optString("bookingId"))) {
          showStatus("The route did not match this booking.");
          return;
        }
        double latitude = stop.getDouble("lat");
        double longitude = stop.getDouble("lng");
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          showStatus("CRM must verify the destination GPS.");
          return;
        }
        runOnUiThread(() -> {
          waypoints.clear();
          waypoints.add(Waypoint.builder()
              .setLatLng(latitude, longitude)
              .setTitle("Home Service destination")
              .build());
          requireLocationAndInitialize();
        });
      } catch (Exception error) {
        // No customer data, coordinates, cookies or tokens are ever logged.
        showStatus("Could not load the route. Check your connection.");
      } finally {
        if (connection != null) connection.disconnect();
      }
    });
  }

  private void requireLocationAndInitialize() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(
          this, new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, LOCATION_REQUEST);
      return;
    }
    beginNavigation();
  }

  @Override public void onRequestPermissionsResult(
      int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == LOCATION_REQUEST) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        beginNavigation();
      } else {
        showStatus("Precise location is required for navigation.");
      }
    }
  }

  private void beginNavigation() {
    if (waypoints.isEmpty()) return;
    NavigationApi.getNavigator(this, new NavigationApi.NavigatorListener() {
      @Override public void onNavigatorReady(Navigator ready) {
        navigator = ready;
        NavigationFragment fragment = (NavigationFragment)
            getSupportFragmentManager().findFragmentById(R.id.navigation_fragment);
        if (fragment != null) {
          fragment.getMapAsync(map -> map.followMyLocation(CameraPerspective.TILTED));
        }
        arrivalListener = (ArrivalEvent event) -> {
          runOnUiThread(() -> {
            // Automatic GPS arrival, no manual driver confirmation. The SDK
            // callback is NOT an authorized server booking transition.
            if (event.isFinalDestination()) {
              if (navigator != null && inGuidance) {
                navigator.stopGuidance();
                inGuidance = false;
              }
              status.setText("Arrived");
            } else if (navigator != null && inGuidance) {
              navigator.continueToNextDestination();
              navigator.startGuidance();
            }
          });
        };
        ready.addArrivalListener(arrivalListener);
        ready.setDestinations(waypoints).setOnResultListener(result -> {
          runOnUiThread(() -> {
            if (result == Navigator.RouteStatus.OK) {
              ready.setAudioGuidanceSettings(AudioGuidanceSettings.builder()
                  .setGuidanceMode(AudioGuidanceSettings.GuidanceMode.VOICE_ALERTS_AND_GUIDANCE)
                  .build());
              // Calculating/displaying the route must never begin guidance.
              // The driver explicitly taps Start once after the route is ready.
              routeReady = true;
              startButton.setEnabled(true);
              status.setText("Route ready");
            } else {
              status.setText("Google could not calculate this driving route.");
            }
          });
        });
      }
      @Override public void onError(@NavigationApi.ErrorCode int code) {
        showStatus("Google Navigation is not ready. Check key, terms and connection.");
      }
    });
  }

  private void startConfirmedGuidance() {
    if (!routeReady || startPending || inGuidance || navigator == null) return;
    startPending = true;
    startButton.setEnabled(false);
    if (!requiresTravelStart) {
      startGuidanceAfterAuthorization();
      return;
    }
    status.setText("Starting trip…");
    // Do not start travel when a native route is merely viewed. The
    // existing backend RPC rechecks the staff, branch and transition.
    io.execute(() -> {
      boolean ok = postExplicitTravelStart();
      runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        if (ok) {
          requiresTravelStart = false;
          startGuidanceAfterAuthorization();
        } else {
          startPending = false;
          startButton.setEnabled(true);
          status.setText("Could not start trip. Try again or contact dispatch.");
        }
      });
    });
  }

  private boolean postExplicitTravelStart() {
    HttpURLConnection connection = null;
    try {
      String cookie = CookieManager.getInstance().getCookie(DriverShellActivity.WEB_ORIGIN);
      if (cookie == null || cookie.isEmpty()) return false;
      URL endpoint = new URL(DriverShellActivity.WEB_ORIGIN + "/api/staff/driver/native-start");
      connection = (HttpURLConnection) endpoint.openConnection();
      connection.setRequestMethod("POST");
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(10000);
      connection.setReadTimeout(10000);
      connection.setDoOutput(true);
      connection.setRequestProperty("Cookie", cookie);
      connection.setRequestProperty("Origin", DriverShellActivity.WEB_ORIGIN);
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setRequestProperty("Accept", "application/json");
      connection.setRequestProperty("Cache-Control", "no-store");
      byte[] payload = new JSONObject().put("bookingId", selectedBookingId)
          .toString().getBytes(StandardCharsets.UTF_8);
      try (OutputStream body = connection.getOutputStream()) {
        body.write(payload);
      }
      if (connection.getResponseCode() != 200) return false;
      try (InputStream stream = connection.getInputStream();
           ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
        byte[] block = new byte[512];
        int count;
        while ((count = stream.read(block)) != -1) {
          bytes.write(block, 0, count);
          if (bytes.size() > 2048) return false;
        }
        JSONObject answer = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
        return answer.optBoolean("ok") && selectedBookingId.equals(answer.optString("bookingId"));
      }
    } catch (Exception ignored) {
      return false;
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private void startGuidanceAfterAuthorization() {
    if (navigator == null || !routeReady || inGuidance) return;
    navigator.startGuidance();
    inGuidance = true;
    startPending = false;
    startButton.setVisibility(View.GONE);
    status.setText("Navigating");
  }

  private void showStatus(String message) {
    runOnUiThread(() -> { if (!isFinishing()) status.setText(message); });
  }

  @Override protected void onDestroy() {
    if (navigator != null) {
      if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
      if (isFinishing() && inGuidance) navigator.stopGuidance();
    }
    io.shutdownNow();
    super.onDestroy();
  }
}
