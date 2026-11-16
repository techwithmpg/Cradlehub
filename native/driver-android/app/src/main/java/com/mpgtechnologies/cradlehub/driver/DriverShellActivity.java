package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import com.google.android.libraries.navigation.NavigationFragment;
import java.util.regex.Pattern;

/** One host and one native navigation pane. Web remains the authenticated portal. */
public class DriverShellActivity extends AppCompatActivity {
  public static final String WEB_ORIGIN = BuildConfig.DRIVER_WEB_ORIGIN;
  static final Pattern BOOKING_ID =
      Pattern.compile(
          "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
  private static final int LOCATION_REQUEST = 103, CAMERA_REQUEST = 104, NOTIFICATION_REQUEST = 105;
  private WebView web;
  private View navigationPane;
  private View tabs;
  private DriverNavigationController navigation;
  private String deviceStatus = "checking";

  void setDeviceStatus(String value) {
    deviceStatus = value;
    runOnUiThread(
        () -> {
          if (web != null)
            web.evaluateJavascript(
                "window.__cradleDriverDeviceStatus="
                    + org.json.JSONObject.quote(value)
                    + ";window.dispatchEvent(new Event(\"cradle-driver-device-status\"))",
                null);
        });
  }

  private String selected = "Trips",
      lastLaunchUrl,
      pendingLocationOrigin,
      pendingNotificationBooking;
  private GeolocationPermissions.Callback pendingLocation;
  private PermissionRequest pendingCamera;

  void requireSignIn(String bookingId) {
    pendingNotificationBooking = bookingId;
    showAuthentication();
    web.loadUrl(WEB_ORIGIN + "/staff/login");
  }

  private void showAuthentication() {
    pauseCamera();
    navigationPane.setVisibility(View.GONE);
    web.setVisibility(View.VISIBLE);
    web.onResume();
    selected = "Trips";
    tabs.setVisibility(View.GONE);
  }

  static boolean trusted(Uri uri) {
    Uri expected = Uri.parse(WEB_ORIGIN);
    return expected.getScheme().equals(uri.getScheme())
        && expected.getHost().equals(uri.getHost())
        && effectivePort(expected) == effectivePort(uri)
        && uri.getUserInfo() == null;
  }

  private static int effectivePort(Uri uri) {
    return uri.getPort() != -1 ? uri.getPort() : ("https".equals(uri.getScheme()) ? 443 : 80);
  }

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_driver_shell);
    View root = findViewById(R.id.driverRoot);
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(
        root,
        (view, insets) -> {
          androidx.core.graphics.Insets bars =
              insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars());
          view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
          return insets;
        });
    web = findViewById(R.id.driverWeb);
    navigationPane = findViewById(R.id.driverNavigationPane);
    tabs = findViewById(R.id.driverTabs);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(
        BuildConfig.DEBUG && WEB_ORIGIN.equals("http://localhost:7100")
            ? WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            : WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setUserAgentString(settings.getUserAgentString() + " CradleHubDriverAndroid/2.0");
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    navigation =
        new DriverNavigationController(
            this,
            (NavigationFragment)
                getSupportFragmentManager().findFragmentById(R.id.navigation_fragment),
            findViewById(R.id.navigationStatus),
            findViewById(R.id.startNavigation));
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public void onGeolocationPermissionsShowPrompt(
              String origin, GeolocationPermissions.Callback callback) {
            if (!trusted(Uri.parse(origin))) {
              callback.invoke(origin, false, false);
              return;
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
              callback.invoke(origin, true, false);
              return;
            }
            if (pendingLocation != null)
              pendingLocation.invoke(pendingLocationOrigin, false, false);
            pendingLocationOrigin = origin;
            pendingLocation = callback;
            ActivityCompat.requestPermissions(
                DriverShellActivity.this,
                new String[] {
                  Manifest.permission.ACCESS_FINE_LOCATION,
                  Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_REQUEST);
          }

          @Override
          public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(
                () -> {
                  if (!trusted(request.getOrigin())
                      || (web.getUrl() == null
                          || !Uri.parse(web.getUrl()).getPath().startsWith("/staff/scan"))
                      || request.getResources().length != 1
                      || !PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(
                          request.getResources()[0])) {
                    request.deny();
                    return;
                  }
                  if (checkSelfPermission(Manifest.permission.CAMERA)
                      == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    return;
                  }
                  if (pendingCamera != null) pendingCamera.deny();
                  pendingCamera = request;
                  ActivityCompat.requestPermissions(
                      DriverShellActivity.this,
                      new String[] {Manifest.permission.CAMERA},
                      CAMERA_REQUEST);
                });
          }

          @Override
          public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingCamera == request) pendingCamera = null;
          }
        });
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri uri = request.getUrl();
            if (trusted(uri)) {
              if ("/staff/driver/more".equals(uri.getPath())
                  && "notifications".equals(uri.getQueryParameter("nativeAction"))) {
                if (Build.VERSION.SDK_INT >= 26)
                  startActivity(
                      new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                          .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName()));
                return true;
              }
              if (isNativeLaunch(uri)) {
                maybeLaunchNavigation(uri.toString());
                return true;
              }
              return false;
            }
            if ("https".equals(uri.getScheme())) startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
          }

          @Override
          public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            maybeLaunchNavigation(url);
          }

          @Override
          public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            if (trusted(Uri.parse(url)) && Uri.parse(url).getPath().startsWith("/staff/login")) {
              navigation.signOut();
              DriverDeviceRegistration.reset();
              deviceStatus = "checking";
              showAuthentication();
            }
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            if (!trusted(Uri.parse(url))) return;
            String path = Uri.parse(url).getPath();
            boolean signedIn = path.startsWith("/staff/") && !path.startsWith("/staff/login");
            tabs.setVisibility(signedIn ? View.VISIBLE : View.GONE);
            maybeLaunchNavigation(url);
            if (signedIn) {
              if (pendingNotificationBooking != null) {
                String pending = pendingNotificationBooking;
                pendingNotificationBooking = null;
                launchNativeTrip(pending);
              }
              setDeviceStatus(deviceStatus);
              DriverDeviceRegistration.register(DriverShellActivity.this);
              if (Build.VERSION.SDK_INT >= 33
                  && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                      != PackageManager.PERMISSION_GRANTED
                  && !getPreferences(MODE_PRIVATE).getBoolean("notificationAsked", false)) {
                getPreferences(MODE_PRIVATE).edit().putBoolean("notificationAsked", true).apply();
                ActivityCompat.requestPermissions(
                    DriverShellActivity.this,
                    new String[] {Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_REQUEST);
              }
            }
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame())
              Toast.makeText(
                      DriverShellActivity.this,
                      "Connection unavailable. Displayed trips may be outdated.",
                      Toast.LENGTH_LONG)
                  .show();
          }
        });
    getOnBackPressedDispatcher()
        .addCallback(
            this,
            new androidx.activity.OnBackPressedCallback(true) {
              @Override
              public void handleOnBackPressed() {
                if ("Navigate".equals(selected)) selectTab("Trips");
                else if (web.canGoBack()) web.goBack();
                else if (navigation.isGuiding()) moveTaskToBack(true);
                else finish();
              }
            });
    findViewById(R.id.tabTrips).setOnClickListener(v -> selectTab("Trips"));
    findViewById(R.id.tabNavigate).setOnClickListener(v -> selectTab("Navigate"));
    findViewById(R.id.tabScan).setOnClickListener(v -> selectTab("Scan"));
    findViewById(R.id.tabMore).setOnClickListener(v -> selectTab("More"));
    if (state == null || web.restoreState(state) == null) web.loadUrl(WEB_ORIGIN + "/staff/driver");
    String restored = state == null ? null : state.getString("selectedBooking");
    String requested = getIntent().getStringExtra("bookingId");
    pendingNotificationBooking = requested;
    if (requested == null) requested = restored;
    if (requested != null && BOOKING_ID.matcher(requested).matches()) launchNativeTrip(requested);
  }

  private boolean isNativeLaunch(Uri uri) {
    return trusted(uri)
        && "/staff/driver/map".equals(uri.getPath())
        && ("native".equals(uri.getQueryParameter("launch")) || navigation.hasSelection());
  }

  private void launchNativeTrip(String id) {
    if (!BOOKING_ID.matcher(id).matches()) return;
    selectTab("Navigate");
    navigation.select(id);
  }

  private void maybeLaunchNavigation(String raw) {
    try {
      Uri uri = Uri.parse(raw);
      if (!isNativeLaunch(uri) || raw.equals(lastLaunchUrl)) return;
      String id = uri.getQueryParameter("bookingId");
      if (id == null) id = navigation.selectedBooking();
      if (id == null || !BOOKING_ID.matcher(id).matches()) return;
      lastLaunchUrl = raw;
      launchNativeTrip(id);
    } catch (RuntimeException ignored) {
    }
  }

  void selectTab(String tab) {
    if (!"Scan".equals(tab)) pauseCamera();
    selected = tab;
    boolean map = "Navigate".equals(tab);
    navigationPane.setVisibility(map ? View.VISIBLE : View.GONE);
    web.setVisibility(map ? View.GONE : View.VISIBLE);
    if (map) {
      web.onPause();
      navigation.show();
    } else {
      web.onResume();
      String path =
          "Trips".equals(tab)
              ? "/staff/driver"
              : "Scan".equals(tab) ? "/staff/scan" : "/staff/driver/more";
      web.loadUrl(WEB_ORIGIN + path);
    }
    int[] ids = {R.id.tabTrips, R.id.tabNavigate, R.id.tabScan, R.id.tabMore};
    String[] names = {"Trips", "Navigate", "Scan", "More"};
    for (int i = 0; i < ids.length; i++) {
      Button b = findViewById(ids[i]);
      b.setSelected(names[i].equals(tab));
      b.setTextColor(names[i].equals(tab) ? 0xff0d6548 : 0xff65746b);
    }
  }

  private void pauseCamera() {
    if (web != null) {
      web.evaluateJavascript(
          "window.dispatchEvent(new"
              + " Event('cradle-driver-camera-pause'));document.querySelectorAll('video').forEach(v=>{if(v.srcObject)v.srcObject.getTracks().forEach(t=>t.stop())})",
          null);
    }
    if (pendingCamera != null) {
      pendingCamera.deny();
      pendingCamera = null;
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (navigation != null) navigation.resume();
    if (web != null
        && web.getUrl() != null
        && trusted(Uri.parse(web.getUrl()))
        && Uri.parse(web.getUrl()).getPath().startsWith("/staff/")
        && !Uri.parse(web.getUrl()).getPath().startsWith("/staff/login")) {
      DriverDeviceRegistration.reset();
      DriverDeviceRegistration.register(this);
    }
  }

  @Override
  protected void onStop() {
    pauseCamera();
    if (navigation != null) navigation.pause();
    super.onStop();
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
    if (request == LOCATION_REQUEST && pendingLocation != null) {
      pendingLocation.invoke(pendingLocationOrigin, granted, false);
      pendingLocation = null;
    } else if (request == CAMERA_REQUEST && pendingCamera != null) {
      if (granted
          && web.getVisibility() == View.VISIBLE
          && web.getUrl() != null
          && Uri.parse(web.getUrl()).getPath().startsWith("/staff/scan"))
        pendingCamera.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
      else pendingCamera.deny();
      pendingCamera = null;
    }
    if (request == NOTIFICATION_REQUEST) {
      DriverDeviceRegistration.reset();
      DriverDeviceRegistration.register(this);
    }
    navigation.resume();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    String id = intent.getStringExtra("bookingId");
    if (id != null && BOOKING_ID.matcher(id).matches()) launchNativeTrip(id);
  }

  @Override
  protected void onSaveInstanceState(Bundle state) {
    web.saveState(state);
    state.putString("selectedBooking", navigation.selectedBooking());
    super.onSaveInstanceState(state);
  }

  @Override
  protected void onDestroy() {
    pauseCamera();
    navigation.destroy(isFinishing());
    web.stopLoading();
    web.destroy();
    super.onDestroy();
  }
}
