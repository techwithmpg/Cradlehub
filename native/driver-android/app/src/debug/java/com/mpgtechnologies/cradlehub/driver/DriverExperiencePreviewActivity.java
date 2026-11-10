package com.mpgtechnologies.cradlehub.driver;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Debug-only, fully native ANDROID UI acceptance preview. It is intentionally
 * disconnected from operational booking/attendance/dispatch writers.
 * Android users can inspect the proposed flow without modifying production.
 * Real staff work remains in the unmodified DriverShellActivity WebView.
 */
public final class DriverExperiencePreviewActivity extends AppCompatActivity {
  private static final int FOREST = Color.rgb(17, 63, 45);
  private static final int GREEN = Color.rgb(9, 105, 72);
  private static final int INK = Color.rgb(27, 54, 42);
  private static final int MUTED = Color.rgb(90, 108, 98);
  private static final int CREAM = Color.rgb(249, 247, 239);
  private static final int PALE = Color.rgb(237, 239, 227);
  private static final int GOLD = Color.rgb(170, 132, 61);
  private static final int WHITE = Color.WHITE;
  private static final String STORE = "cradle_driver_flow_debug_preview";
  private DriverPreviewState model;
  private LinearLayout main;
  private SharedPreferences prefs;

  private int d(float value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  @Override public void onCreate(Bundle bundle) {
    super.onCreate(bundle);
    prefs = getSharedPreferences(STORE, MODE_PRIVATE);
    model = new DriverPreviewState(
        prefs.getString("screen", "TODAY"),
        prefs.getString("filter", "TODAY"),
        prefs.getInt("sample", 1));
    getWindow().setStatusBarColor(FOREST);
    getWindow().setNavigationBarColor(FOREST);
    getWindow().getDecorView().setSystemUiVisibility(0);
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() {
        if (model.screen() == DriverPreviewState.Screen.TODAY) {
          moveTaskToBack(true);
        } else {
          model.back();
          render();
        }
      }
    });
    render();
  }

  private void persist() {
    // Only presentation enums + 1/2 sample choice. No identity, customer,
    // cookies, GPS, bookings, tokens or authorization decisions persisted.
    prefs.edit()
        .putString("screen", model.screen().name())
        .putString("filter", model.filter().name())
        .putInt("sample", model.sampleTrip())
        .apply();
  }

  private GradientDrawable shape(int fill, int radius, int stroke, int thickness) {
    GradientDrawable bg = new GradientDrawable();
    bg.setColor(fill);
    bg.setCornerRadius(d(radius));
    if (thickness > 0) bg.setStroke(d(thickness), stroke);
    return bg;
  }

  private TextView text(String value, int sp, int color, boolean bold) {
    TextView view = new TextView(this);
    view.setText(value);
    view.setTextSize(sp);
    view.setTextColor(color);
    view.setIncludeFontPadding(true);
    if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    return view;
  }

  private LinearLayout vertical() {
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    return layout;
  }

  private LinearLayout horizontal() {
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.HORIZONTAL);
    layout.setGravity(Gravity.CENTER_VERTICAL);
    return layout;
  }

  private void add(LinearLayout parent, View child, int height) {
    parent.addView(child, new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, height < 0 ? height : d(height)));
  }

  private void gap(LinearLayout parent, int height) {
    View spacer = new View(this);
    add(parent, spacer, height);
  }

  private LinearLayout card() {
    LinearLayout c = vertical();
    c.setPadding(d(18), d(18), d(18), d(18));
    c.setBackground(shape(WHITE, 24, Color.rgb(231, 231, 220), 1));
    c.setElevation(d(3));
    return c;
  }

  private TextView action(String label, boolean primary, Runnable callback) {
    TextView button = text(label, 16, primary ? WHITE : FOREST, true);
    button.setGravity(Gravity.CENTER);
    button.setMinHeight(d(56));
    GradientDrawable rounded = shape(primary ? GREEN : PALE, 16, primary ? GREEN : Color.rgb(215, 223, 210), 1);
    button.setBackground(new RippleDrawable(
        ColorStateList.valueOf(primary ? Color.rgb(33, 130, 93) : Color.rgb(219, 229, 210)),
        rounded, null));
    button.setClickable(true);
    button.setFocusable(true);
    button.setContentDescription(label);
    button.setOnClickListener(v -> callback.run());
    return button;
  }

  private void pageTitle(String heading, String subheading) {
    add(main, text(heading, 30, INK, true), -2);
    gap(main, 3);
    add(main, text(subheading, 14, MUTED, false), -2);
    gap(main, 20);
  }

  private void pageHint(String body) {
    gap(main, 16);
    add(main, text(body, 12, MUTED, false), -2);
  }

  private void render() {
    persist();
    LinearLayout root = vertical();
    root.setBackgroundColor(CREAM);
    setContentView(root);

    LinearLayout brand = vertical();
    brand.setPadding(d(22), d(12), d(20), d(12));
    brand.setBackgroundColor(FOREST);
    add(brand, text("CRADLEHUB  /  DRIVER", 12, Color.rgb(237, 220, 165), true), -2);
    TextView notice = text("INTERACTIVE UI DEMO · no live trip changes", 10, WHITE, false);
    add(brand, notice, -2);
    add(root, brand, -2);

    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setVerticalScrollBarEnabled(false);
    main = vertical();
    main.setPadding(d(20), d(24), d(20), d(28));
    scroll.addView(main, new ScrollView.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    root.addView(scroll, new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

    switch (model.screen()) {
      case TODAY: today(); break;
      case TRIPS: trips(); break;
      case NAVIGATION: navigation(); break;
      case ARRIVAL: arrived(); break;
      case MORE: more(); break;
    }

    if (model.screen() == DriverPreviewState.Screen.TODAY
        || model.screen() == DriverPreviewState.Screen.TRIPS
        || model.screen() == DriverPreviewState.Screen.MORE) {
      bottomNavigation(root);
    }
  }

  private void bottomNavigation(LinearLayout root) {
    LinearLayout tabs = horizontal();
    tabs.setBackgroundColor(WHITE);
    tabs.setPadding(d(8), d(6), d(8), d(6));
    addTab(tabs, "⌂\nToday", DriverPreviewState.Screen.TODAY);
    addTab(tabs, "↗\nTrips", DriverPreviewState.Screen.TRIPS);
    addTab(tabs, "•••\nMore", DriverPreviewState.Screen.MORE);
    add(root, tabs, 70);
  }

  private void addTab(LinearLayout tabs, String label, DriverPreviewState.Screen tab) {
    boolean selected = model.screen() == tab;
    TextView item = text(label, 13, selected ? GREEN : MUTED, selected);
    item.setGravity(Gravity.CENTER);
    item.setBackground(shape(selected ? PALE : WHITE, 12, WHITE, 0));
    item.setClickable(true);
    item.setFocusable(true);
    item.setOnClickListener(v -> {
      model.showTab(tab);
      render();
    });
    tabs.addView(item, new LinearLayout.LayoutParams(0, d(57), 1));
  }

  private void today() {
    pageTitle("Today", "Your next trip, without extra steps");

    LinearLayout feature = card();
    add(feature, text("NEXT TRIP  ·  SAMPLE", 11, GOLD, true), -2);
    gap(feature, 10);
    add(feature, text("Demo trip 01", 24, INK, true), -2);
    gap(feature, 5);
    add(feature, text("Sports Massage", 15, MUTED, false), -2);
    gap(feature, 20);
    add(feature, text("◷  4:00 PM", 16, INK, true), -2);
    gap(feature, 10);
    add(feature, text("⌖  Central Market, Bacolod → Langilan", 15, MUTED, false), -2);
    gap(feature, 24);
    add(feature, action("➤  Start navigation", true, () -> {
      model.openTrip(1);
      render();
    }), 60);
    add(main, feature, -2);

    pageHint("The button opens the navigation screen in one tap. This is a sample route: no booking status or GPS is changed.");
    gap(main, 26);
    add(main, text("YOUR SHIFT", 11, GOLD, true), -2);
    gap(main, 10);
    LinearLayout small = card();
    add(small, text("Attendance stays in the Staff Portal", 14, INK, true), -2);
    gap(small, 5);
    add(small, text("This demo never clocks you in or out.", 12, MUTED, false), -2);
    add(main, small, -2);
  }

  private void trips() {
    pageTitle("Trips", "Tap any sample trip to open navigation");

    LinearLayout filters = horizontal();
    for (DriverPreviewState.Filter option : DriverPreviewState.Filter.values()) {
      boolean current = option == model.filter();
      String title = option == DriverPreviewState.Filter.TODAY ? "Today"
          : option == DriverPreviewState.Filter.UPCOMING ? "Upcoming" : "Completed";
      TextView button = text(title, 13, current ? WHITE : INK, current);
      button.setGravity(Gravity.CENTER);
      button.setMinHeight(d(48));
      button.setBackground(shape(current ? FOREST : PALE, 14, WHITE, 0));
      button.setOnClickListener(v -> {
        model.filter(option);
        render();
      });
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, d(48), 1);
      lp.setMargins(d(2), 0, d(2), 0);
      filters.addView(button, lp);
    }
    add(main, filters, 48);
    gap(main, 18);

    if (model.filter() == DriverPreviewState.Filter.TODAY) {
      sampleTripCard(1, "4:00 PM", "Central Market → Langilan", "EN ROUTE  ·  DEMO");
      sampleTripCard(2, "5:30 PM", "Langilan → Granada", "UPCOMING  ·  DEMO");
    } else {
      LinearLayout empty = card();
      add(empty, text(
          model.filter() == DriverPreviewState.Filter.UPCOMING
              ? "No upcoming sample trips" : "No completed sample trips",
          17, INK, true), -2);
      gap(empty, 6);
      add(empty, text("Live assignments remain in the existing Staff Portal.", 13, MUTED, false), -2);
      add(main, empty, -2);
    }
    pageHint("Every card is one large tap target. There is no trip-detail page.");
  }

  private void sampleTripCard(int number, String time, String route, String badge) {
    LinearLayout c = card();
    add(c, text(badge, 11, GOLD, true), -2);
    gap(c, 10);
    add(c, text("Demo trip 0" + number + "    ›", 20, INK, true), -2);
    gap(c, 8);
    add(c, text("Sports Massage  ·  " + time, 14, MUTED, false), -2);
    gap(c, 10);
    add(c, text("⌖  " + route, 14, INK, false), -2);
    c.setMinHeight(d(148));
    c.setClickable(true);
    c.setFocusable(true);
    c.setContentDescription("Open demo trip " + number + " in navigation");
    c.setOnClickListener(v -> {
      model.openTrip(number);
      render();
    });
    add(main, c, -2);
    gap(main, 12);
  }

  private String destination() {
    return model.sampleTrip() == 1 ? "Langilan" : "Granada";
  }

  private void navigation() {
    add(main, action("‹  Back to trips", false, () -> {
      model.back();
      render();
    }), 48);
    gap(main, 18);
    add(main, text("Navigating to " + destination(), 26, INK, true), -2);
    gap(main, 6);
    add(main, text("DEMO ROUTE  ·  not live guidance", 12, GOLD, true), -2);
    gap(main, 18);
    PreviewMapView map = new PreviewMapView();
    map.setBackground(shape(Color.rgb(222, 239, 226), 22, Color.rgb(206, 224, 208), 1));
    add(main, map, 350);
    gap(main, 16);
    LinearLayout info = card();
    add(info, text("Demo trip 0" + model.sampleTrip(), 17, INK, true), -2);
    gap(info, 8);
    add(info, text("⌖  " + (model.sampleTrip() == 1 ? "Central Market → Langilan" : "Langilan → Granada"), 14, MUTED, false), -2);
    add(main, info, -2);
    gap(main, 16);
    add(main, action("✓  Arrived", true, () -> {
      model.arrive();
      render();
    }), 60);
    pageHint("Map and arrival are interactive UI samples only. Actual turn-by-turn GPS and driver status transitions still use the authorized Staff Portal.");
  }

  private void arrived() {
    gap(main, 65);
    TextView tick = text("✓", 48, GREEN, true);
    tick.setGravity(Gravity.CENTER);
    add(main, tick, 70);
    gap(main, 12);
    TextView title = text("Destination reached", 25, INK, true);
    title.setGravity(Gravity.CENTER);
    add(main, title, -2);
    gap(main, 10);
    TextView note = text("UI DEMO ONLY · No arrival recorded in CradleHub", 12, GOLD, true);
    note.setGravity(Gravity.CENTER);
    add(main, note, -2);
    gap(main, 24);
    LinearLayout c = card();
    add(c, text("Demo trip 0" + model.sampleTrip(), 19, INK, true), -2);
    gap(c, 10);
    add(c, text("Sports Massage", 15, MUTED, false), -2);
    gap(c, 8);
    add(c, text("⌖  " + destination(), 15, MUTED, false), -2);
    add(main, c, -2);
    gap(main, 22);
    add(main, action(model.sampleTrip() == 1 ? "Next trip →" : "Back to trips", true, () -> {
      model.next();
      render();
    }), 60);
    pageHint("In the real app, arrival must be recorded by the server after authorization.");
  }

  private void more() {
    pageTitle("More", "Keep everything else out of the driver's way");
    LinearLayout c = card();
    add(c, text("Driver Flow Demo", 21, INK, true), -2);
    gap(c, 12);
    add(c, text(
        "Native layout and tabs are local, so they switch without any network requests. "
        + "The preview remembers the last screen. Only sample data is shown here.",
        14, MUTED, false), -2);
    gap(c, 16);
    add(c, action("Open real Staff Portal", true, () -> {
      // Official app retains auth/session and all server authority.
      startActivity(new Intent(this, DriverShellActivity.class));
    }), 56);
    add(main, c, -2);
    gap(main, 22);
    add(main, text("DEVELOPMENT TOOLS", 11, GOLD, true), -2);
    gap(main, 12);
    add(main, action("Reset demo to Today", false, () -> {
      model = new DriverPreviewState("TODAY", "TODAY", 1);
      render();
    }), 54);
    pageHint("No driver location, booking status, sign-in token or personal data is stored by this preview.");
  }

  /** Deliberately schematic canvas; never represents actual Google map tiles or ETA. */
  private final class PreviewMapView extends View {
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    PreviewMapView() { super(DriverExperiencePreviewActivity.this); }

    @Override protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      float w = getWidth(), h = getHeight();
      if (w <= 0 || h <= 0) return;
      canvas.save();
      canvas.clipRect(0, 0, w, h);
      canvas.drawColor(Color.rgb(225, 240, 227));
      p.setStyle(Paint.Style.STROKE);
      p.setStrokeCap(Paint.Cap.ROUND);
      p.setStrokeJoin(Paint.Join.ROUND);
      p.setStrokeWidth(d(2));
      p.setColor(Color.rgb(199, 220, 204));
      for (int i = 0; i < 6; i++) {
        float y = h * (i + 1) / 7;
        canvas.drawLine(0, y, w, y + (i % 2 == 0 ? -d(24) : d(26)), p);
      }
      for (int i = 0; i < 5; i++) {
        float x = w * (i + 1) / 6;
        canvas.drawLine(x, 0, x + d(18), h, p);
      }
      Path road = new Path();
      road.moveTo(w * .15f, h * .68f);
      road.lineTo(w * .32f, h * .51f);
      road.lineTo(w * .47f, h * .59f);
      road.lineTo(w * .66f, h * .38f);
      road.lineTo(w * .84f, h * .29f);
      p.setColor(Color.WHITE); p.setStrokeWidth(d(14));
      canvas.drawPath(road, p);
      p.setColor(Color.rgb(25, 113, 208)); p.setStrokeWidth(d(6));
      canvas.drawPath(road, p);
      p.setStyle(Paint.Style.FILL);
      p.setColor(Color.rgb(177, 51, 42));
      canvas.drawCircle(w * .15f, h * .68f, d(10), p);
      canvas.drawCircle(w * .84f, h * .29f, d(10), p);
      p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
      p.setTextSize(d(16)); p.setColor(FOREST);
      canvas.drawText("Start", w * .08f, h * .78f, p);
      canvas.drawText(destination(), w * .63f, h * .22f, p);
      p.setTextSize(d(11));
      canvas.drawText("ILLUSTRATIVE MAP  •  NO GPS", d(16), d(28), p);
      canvas.restore();
    }
  }
}
