package com.mpgtechnologies.cradlehub.driver;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Review-only native Driver workspace backed by existing authenticated
 * CradleHub actions. NO demo trip is ever promoted to a real booking.
 *
 * Auth/session belong to DriverShellActivity's WebView. All bookings and
 * status mutations MUST be revalidated in the server-authorized API.
 */
public final class DriverConnectedActivity extends AppCompatActivity {
  private static final String PREFS = "driver_connected_ui_preferences";
  private static final String TODAY = "TODAY", TRIPS = "TRIPS", MORE = "MORE";
  private static final String ARRIVAL = "ARRIVAL";
  private static final String FILTER_TODAY = "TODAY", UPCOMING = "UPCOMING", COMPLETED = "COMPLETED";
  private static final int NAV_RESULT = 601;

  private static final int FOREST = Color.rgb(19, 63, 45);
  private static final int GREEN = Color.rgb(6, 103, 70);
  private static final int INK = Color.rgb(31, 55, 44);
  private static final int MUTED = Color.rgb(95, 112, 101);
  private static final int CREAM = Color.rgb(250, 248, 240);
  private static final int PALE = Color.rgb(238, 241, 230);
  private static final int GOLD = Color.rgb(158, 119, 48);

  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final List<Trip> trips = new ArrayList<>();
  private SharedPreferences preferences;
  private LinearLayout main;
  private String screen, filter, businessDate = "", driverName = "Driver";
  private String message = "Loading assigned trips…";
  private String currentBookingId = null;
  private boolean authenticated = false, busy = false, loading = false, arrivedViaSdk = false;
  private long refreshedAt = 0;

  private static final class Trip {
    final String id, customer, service, date, time, destination, bookingStatus, progress, dispatchStatus;
    final boolean destinationReady;
    Trip(JSONObject json) {
      id = json.optString("id", "");
      customer = json.optString("customerName", "Customer");
      service = json.optString("serviceName", "Service");
      date = json.optString("bookingDate", "");
      time = json.optString("startTime", "");
      destination = json.optString("destination", "Destination not confirmed");
      bookingStatus = json.optString("bookingStatus", "");
      progress = json.optString("bookingProgressStatus", "");
      dispatchStatus = json.optString("dispatchStatus", "");
      destinationReady = json.optBoolean("destinationReady", false);
    }
    boolean open() {
      return "confirmed".equals(bookingStatus) || "in_progress".equals(bookingStatus);
    }
    boolean canNavigate() {
      return open() && destinationReady &&
          ("not_started".equals(progress) || "travel_started".equals(progress));
    }
    boolean complete() {
      return "completed".equals(dispatchStatus) || "cancelled".equals(dispatchStatus);
    }
    String status() {
      if ("travel_started".equals(progress)) return "En route";
      if ("arrived".equals(progress)) return "Arrived";
      if (complete()) return "Finished";
      return "Assigned";
    }
  }

  private int dp(float x) { return (int) (getResources().getDisplayMetrics().density * x + .5f); }

  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
    screen = preferences.getString("screen", TODAY);
    filter = preferences.getString("filter", FILTER_TODAY);
    if (!TRIPS.equals(screen) && !MORE.equals(screen)) screen = TODAY;
    if (!UPCOMING.equals(filter) && !COMPLETED.equals(filter)) filter = FILTER_TODAY;
    getWindow().setStatusBarColor(FOREST);
    getWindow().setNavigationBarColor(FOREST);
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() {
        if (ARRIVAL.equals(screen)) {
          screen = TRIPS;
          arrivedViaSdk = false;
          currentBookingId = null;
          render();
        } else if (!TODAY.equals(screen)) {
          switchTab(TODAY);
        } else moveTaskToBack(true);
      }
    });
    render();
  }

  @Override protected void onResume() {
    super.onResume();
    // Re-authorize on every return from the Staff login window or native
    // navigator, but avoid a network request merely to switch tabs.
    if (!busy && !ARRIVAL.equals(screen) && (trips.isEmpty() ||
        System.currentTimeMillis() - refreshedAt > 15000)) refresh();
  }

  private void refresh() {
    if (loading || isFinishing()) return;
    loading = true;
    if (trips.isEmpty()) message = "Checking your assigned trips…";
    render();
    final String cookie = DriverNativeTransport.cookie();
    io.execute(() -> {
      DriverNativeTransport.Result result = null;
      try { result = DriverNativeTransport.getWorkspace(cookie); }
      catch (Exception ignored) { /* No user details or credentials logged. */ }
      final DriverNativeTransport.Result reply = result;
      runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        loading = false;
        if (reply == null) {
          message = "Connection unavailable. Your trips will refresh when online.";
        } else if (!reply.ok()) {
          authenticated = false;
          trips.clear(); // Never keep unauthorized customer information visible.
          message = reply.code == 401 ? "Sign in through the Staff Portal." : reply.error();
        } else {
          List<Trip> latest = new ArrayList<>();
          JSONArray items = reply.body.optJSONArray("trips");
          if (items != null) for (int i = 0; i < Math.min(items.length(), 100); i++) {
            JSONObject json = items.optJSONObject(i);
            if (json != null) {
              Trip t = new Trip(json);
              if (StaffShellRoutePolicy.validBookingId(t.id)) latest.add(t);
            }
          }
          trips.clear();
          trips.addAll(latest);
          businessDate = reply.body.optString("businessDate", "");
          driverName = reply.body.optString("name", "Driver");
          authenticated = true;
          message = trips.isEmpty() ? "No assigned trips." : "";
          refreshedAt = System.currentTimeMillis();
        }
        render();
      });
    });
  }

  private void setError(String value) {
    message = value;
    busy = false;
    render();
  }

  private void switchTab(String tab) {
    if (busy) return;
    screen = tab;
    preferences.edit().putString("screen", tab).apply();
    render(); // Native redraw from verified in-memory snapshot, no WebView reload.
  }

  private boolean hasNavKey() {
    try {
      ApplicationInfo info = getPackageManager().getApplicationInfo(
          getPackageName(), PackageManager.GET_META_DATA);
      String key = info.metaData == null ? null :
          info.metaData.getString("com.google.android.geo.API_KEY");
      return key != null && key.trim().length() >= 20;
    } catch (PackageManager.NameNotFoundException e) {
      return false;
    }
  }

  private void startTrip(Trip selected) {
    if (busy || !selected.canNavigate()) {
      setError("CRM must confirm this assignment and destination before navigating.");
      return;
    }
    if (!hasNavKey()) {
      setError("Google Navigation SDK key is not configured for this TEST APK.");
      return;
    }
    busy = true;
    message = "Verifying your trip with CradleHub…";
    render();
    final String cookie = DriverNativeTransport.cookie();
    io.execute(() -> {
      DriverNativeTransport.Result result = null;
      try { result = DriverNativeTransport.progress(selected.id, "start", cookie); }
      catch (Exception ignored) { }
      final DriverNativeTransport.Result reply = result;
      runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        busy = false;
        if (reply == null || !reply.ok() ||
            !"travel_started".equals(reply.body.optString("status")) ||
            !selected.id.equals(reply.body.optString("bookingId"))) {
          setError(reply == null ? "Connection failed. No navigation started." :
              reply.error());
          return;
        }
        currentBookingId = selected.id;
        message = "";
        // Activity independently reads authorized coordinates from the
        // existing /api/staff/driver/native-itinerary endpoint.
        Intent intent = new Intent(this, NativeNavigationActivity.class);
        intent.putExtra(NativeNavigationActivity.EXTRA_BOOKING_ID, selected.id);
        startActivityForResult(intent, NAV_RESULT);
      });
    });
  }

  @Override protected void onActivityResult(int code, int resultCode, Intent intent) {
    super.onActivityResult(code, resultCode, intent);
    if (code != NAV_RESULT) return;
    String returned = intent == null ? null :
        intent.getStringExtra(NativeNavigationActivity.EXTRA_BOOKING_ID);
    if (resultCode == RESULT_OK && currentBookingId != null &&
        currentBookingId.equals(returned)) {
      arrivedViaSdk = true;
      screen = ARRIVAL; // Only a prompt. No status mutation until POST.
      message = "";
    } else {
      screen = TRIPS;
      message = "Navigation closed. Trip progress remains server-authoritative.";
    }
    render();
  }

  private void confirmArrival() {
    if (busy || !arrivedViaSdk || currentBookingId == null) return;
    busy = true;
    message = "Confirming arrival with CradleHub…";
    render();
    final String id = currentBookingId;
    final String cookie = DriverNativeTransport.cookie();
    io.execute(() -> {
      DriverNativeTransport.Result result = null;
      try { result = DriverNativeTransport.progress(id, "arrive", cookie); }
      catch (Exception ignored) { }
      final DriverNativeTransport.Result reply = result;
      runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        busy = false;
        if (reply == null || !reply.ok() ||
            !"arrived".equals(reply.body.optString("status")) ||
            !id.equals(reply.body.optString("bookingId"))) {
          setError(reply == null ? "Connection failed. Arrival NOT confirmed." : reply.error());
          return;
        }
        arrivedViaSdk = false;
        currentBookingId = null;
        screen = TRIPS;
        preferences.edit().putString("screen", TRIPS).apply();
        message = "Arrival confirmed by CradleHub.";
        refreshedAt = 0;
        refresh();
      });
    });
  }

  private TextView text(String value, int size, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setTypeface(Typeface.DEFAULT, bold ? Typeface.BOLD : Typeface.NORMAL);
    return t;
  }
  private LinearLayout column() {
    LinearLayout c = new LinearLayout(this);
    c.setOrientation(LinearLayout.VERTICAL);
    return c;
  }
  private LinearLayout row() {
    LinearLayout r = new LinearLayout(this);
    r.setOrientation(LinearLayout.HORIZONTAL);
    r.setGravity(Gravity.CENTER_VERTICAL);
    return r;
  }
  private GradientDrawable background(int fill, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(fill);
    d.setCornerRadius(dp(radius));
    return d;
  }
  private void add(LinearLayout parent, View child, int height) {
    parent.addView(child, new LinearLayout.LayoutParams(-1, height == -2 ? -2 : dp(height)));
  }
  private void space(LinearLayout layout, int height) {
    add(layout, new View(this), height);
  }
  private LinearLayout card() {
    LinearLayout c = column();
    c.setPadding(dp(18), dp(18), dp(18), dp(18));
    c.setBackground(background(Color.WHITE, 22));
    c.setElevation(dp(3));
    return c;
  }
  private TextView button(String value, boolean filled, Runnable action) {
    TextView t = text(value, 16, filled ? Color.WHITE : FOREST, true);
    t.setGravity(Gravity.CENTER);
    t.setMinHeight(dp(54));
    t.setBackground(new RippleDrawable(
        ColorStateList.valueOf(filled ? Color.rgb(24, 132, 91) : Color.rgb(227, 233, 219)),
        background(filled ? GREEN : PALE, 15), null));
    t.setClickable(true); t.setFocusable(true);
    t.setEnabled(!busy);
    t.setOnClickListener(v -> action.run());
    return t;
  }

  private void title(String heading, String subtitle) {
    add(main, text(heading, 30, INK, true), -2);
    space(main, 4);
    add(main, text(subtitle, 14, MUTED, false), -2);
    space(main, 20);
  }

  private void render() {
    if (isFinishing()) return;
    LinearLayout root = column();
    root.setBackgroundColor(CREAM);
    setContentView(root);
    LinearLayout header = column();
    header.setBackgroundColor(FOREST);
    header.setPadding(dp(20), dp(12), dp(20), dp(14));
    add(header, text("CRADLEHUB  /  DRIVER", 12, Color.rgb(240, 221, 161), true), -2);
    add(header, text("Native TEST connection · server-authorized trips", 10, Color.WHITE, false), -2);
    add(root, header, -2);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    main = column();
    main.setPadding(dp(20), dp(20), dp(20), dp(25));
    scroll.addView(main, new ScrollView.LayoutParams(-1, -2));
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

    if (ARRIVAL.equals(screen)) {
      arrival();
      return;
    }
    if (TODAY.equals(screen)) today();
    else if (TRIPS.equals(screen)) tripsScreen();
    else more();

    LinearLayout tabs = row();
    tabs.setPadding(dp(8), dp(5), dp(8), dp(5));
    tabs.setBackgroundColor(Color.WHITE);
    tab(tabs, "⌂\nToday", TODAY);
    tab(tabs, "➤\nTrips", TRIPS);
    tab(tabs, "•••\nMore", MORE);
    add(root, tabs, 66);
  }

  private void tab(LinearLayout parent, String label, String tab) {
    TextView item = text(label, 13, tab.equals(screen) ? GREEN : MUTED, tab.equals(screen));
    item.setGravity(Gravity.CENTER);
    item.setBackground(background(tab.equals(screen) ? PALE : Color.WHITE, 13));
    item.setOnClickListener(v -> switchTab(tab));
    item.setClickable(true);
    parent.addView(item, new LinearLayout.LayoutParams(0, dp(55), 1));
  }

  private void notice() {
    if (loading) {
      add(main, text("Refreshing assigned trips…", 13, MUTED, false), -2);
      space(main, 12);
    }
    if (message != null && !message.isEmpty()) {
      LinearLayout status = card();
      add(status, text(message, 14, INK, false), -2);
      space(status, 10);
      if (!busy && !ARRIVAL.equals(screen)) {
        add(status, button("Refresh", false, this::refresh), 50);
      }
      add(main, status, -2);
      space(main, 16);
    }
  }

  private void today() {
    title("Today", authenticated ? "Welcome back, " + driverName : "Your next assigned trip");
    notice();
    Trip primary = null;
    for (Trip t : ordered()) {
      if (!t.complete() && t.date.equals(businessDate)) {
        if (primary == null || "travel_started".equals(t.progress)) {
          primary = t;
          if ("travel_started".equals(t.progress)) break;
        }
      }
    }
    if (primary != null) {
      LinearLayout c = card();
      add(c, text("NEXT ASSIGNED TRIP", 11, GOLD, true), -2);
      space(c, 10);
      add(c, text(primary.customer, 22, INK, true), -2);
      space(c, 8);
      add(c, text(primary.service, 15, MUTED, false), -2);
      space(c, 16);
      add(c, text("◷  " + primary.time, 16, INK, true), -2);
      space(c, 10);
      add(c, text("⌖  " + primary.destination, 15, MUTED, false), -2);
      space(c, 20);
      final Trip target = primary;
      add(c, button(primary.canNavigate() ? "➤  Start navigation" :
          "Trip not ready for navigation", primary.canNavigate(), () -> startTrip(target)), 60);
      add(main, c, -2);
    } else if (!loading && authenticated) {
      add(main, text("No assigned trips for today.", 17, MUTED, false), -2);
    } else if (!authenticated && !loading) {
      add(main, button("Open Staff Portal to sign in", true, this::openStaff), 56);
    }
  }

  private List<Trip> ordered() {
    List<Trip> list = new ArrayList<>(trips);
    Collections.sort(list, Comparator.comparing((Trip t) -> t.date + "T" + t.time));
    return list;
  }

  private void tripsScreen() {
    title("Trips", "Tap an assigned trip to navigate");
    LinearLayout filters = row();
    addFilter(filters, FILTER_TODAY, "Today");
    addFilter(filters, UPCOMING, "Upcoming");
    addFilter(filters, COMPLETED, "Completed");
    add(main, filters, 50);
    space(main, 18);
    notice();
    int shown = 0;
    for (Trip t : ordered()) {
      boolean visible = FILTER_TODAY.equals(filter) ? t.date.equals(businessDate) :
          UPCOMING.equals(filter) ? t.date.compareTo(businessDate) > 0 && !t.complete() :
          t.complete();
      if (!visible) continue;
      addTripCard(t);
      shown++;
    }
    if (shown == 0 && !loading && authenticated) {
      add(main, text("No trips in this section.", 16, MUTED, false), -2);
    }
    if (!authenticated && !loading) {
      space(main, 20);
      add(main, button("Sign in through Staff Portal", true, this::openStaff), 55);
    }
  }

  private void addFilter(LinearLayout parent, String value, String label) {
    boolean selected = value.equals(filter);
    TextView t = text(label, 13, selected ? Color.WHITE : INK, selected);
    t.setGravity(Gravity.CENTER);
    t.setMinHeight(dp(48));
    t.setBackground(background(selected ? FOREST : PALE, 12));
    t.setOnClickListener(v -> {
      filter = value;
      preferences.edit().putString("filter", filter).apply();
      render();
    });
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(48), 1);
    lp.setMargins(dp(2), 0, dp(2), 0);
    parent.addView(t, lp);
  }

  private void addTripCard(Trip t) {
    LinearLayout c = card();
    add(c, text(t.status().toUpperCase() + "  ·  " + t.time, 12, GOLD, true), -2);
    space(c, 10);
    add(c, text(t.customer + (t.canNavigate() ? "   ›" : ""), 20, INK, true), -2);
    space(c, 7);
    add(c, text(t.service, 15, MUTED, false), -2);
    space(c, 9);
    add(c, text("⌖  " + t.destination, 14, INK, false), -2);
    if (!t.canNavigate()) {
      space(c, 7);
      add(c, text("Not available to navigate", 12, MUTED, false), -2);
    }
    if (t.canNavigate()) {
      c.setClickable(true);
      c.setFocusable(true);
      c.setContentDescription("Navigate assigned trip");
      c.setOnClickListener(v -> startTrip(t));
    }
    add(main, c, -2);
    space(main, 12);
  }

  private void arrival() {
    title("Destination reached", "Navigation SDK reported arrival");
    notice();
    LinearLayout c = card();
    add(c, text("Confirm arrival with CradleHub", 18, INK, true), -2);
    space(c, 10);
    add(c, text("Your assigned trip will be updated only after the server checks your identity and booking state.", 13, MUTED, false), -2);
    space(c, 20);
    add(c, button("✓  Confirm arrival", true, this::confirmArrival), 60);
    add(main, c, -2);
  }

  private void more() {
    title("More", "Staff tools and login");
    notice();
    LinearLayout c = card();
    add(c, text("Staff account", 20, INK, true), -2);
    space(c, 10);
    add(c, text("Login and attendance stay in the existing CradleHub Staff Portal.", 14, MUTED, false), -2);
    space(c, 16);
    add(c, button("Open Staff Portal", true, this::openStaff), 54);
    add(main, c, -2);
    space(main, 20);
    add(main, button("Refresh assigned trips", false, this::refresh), 54);
  }

  private void openStaff() {
    // When the embedded Staff login returns, always validate again.
    refreshedAt = 0;
    startActivity(new Intent(this, DriverShellActivity.class));
  }

  @Override protected void onDestroy() {
    io.shutdownNow();
    super.onDestroy();
  }
}
