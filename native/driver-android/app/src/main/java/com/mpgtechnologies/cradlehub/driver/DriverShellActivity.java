package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.regex.Pattern;

/**
 * The existing Staff Driver PWA remains the only login, booking and dispatch
 * workspace. The Android companion handles native Google guidance ONLY.
 * No JS bridge, client-selected location or client-side authorization.
 */
public final class DriverShellActivity extends AppCompatActivity {
  public static final String WEB_ORIGIN = "https://www.cradlewellnessliving.com";
  private static final String TRUSTED_HOST = "www.cradlewellnessliving.com";
  private static final String ROUTE_PATH = "/staff/driver/map";
  private static final Pattern BOOKING_ID = Pattern.compile(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private WebView web;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_driver_shell);
    web = findViewById(R.id.driverWeb);

    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true); // existing Next.js Staff PWA
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!request.isForMainFrame()) return false;
        Uri url = request.getUrl();
        if ("https".equals(url.getScheme()) && TRUSTED_HOST.equals(url.getHost())) {
          // The focused Web route makes this navigation request ONLY after
          // the existing server-authorized Start Trip action succeeds.
          // A forged URL can at most open the native screen; the itinerary
          // endpoint must independently re-authorize the current assignment.
          String bookingId = url.getQueryParameter("bookingId");
          if (ROUTE_PATH.equals(url.getPath()) &&
              "1".equals(url.getQueryParameter("nativeNavigation")) &&
              validBookingId(bookingId)) {
            // Refresh server-backed trip state behind the native map so Back
            // shows Resume Navigation, not an outdated Start Trip button.
            view.loadUrl(WEB_ORIGIN + ROUTE_PATH + "?bookingId=" + bookingId);
            openNativeNavigation(bookingId);
            return true;
          }
          return false;
        }
        // Embedded OAuth may require an approved system-browser flow.
        // Never transmit WebView session cookies to another origin.
        if ("https".equals(url.getScheme())) {
          startActivity(new Intent(Intent.ACTION_VIEW, url));
        }
        return true;
      }
    });

    if (state == null || web.restoreState(state) == null) {
      loadRequestedTrip(getIntent());
    }
    if (Build.VERSION.SDK_INT >= 33 &&
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 102);
    }
  }

  private static boolean validBookingId(String id) {
    return id != null && BOOKING_ID.matcher(id).matches();
  }

  private void loadRequestedTrip(Intent source) {
    String bookingId = source == null ? null : source.getStringExtra("bookingId");
    String path = validBookingId(bookingId)
        ? ROUTE_PATH + "?bookingId=" + bookingId
        : "/staff/driver";
    // Notification taps open the authorized trip preview directly, not a
    // second map or an automatic mutation/guidance session.
    web.loadUrl(WEB_ORIGIN + path);
  }

  private void openNativeNavigation(String bookingId) {
    Intent intent = new Intent(this, NativeNavigationActivity.class);
    intent.putExtra(NativeNavigationActivity.EXTRA_BOOKING_ID, bookingId);
    startActivity(intent);
  }

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    if (web != null) loadRequestedTrip(intent);
  }

  @Override protected void onSaveInstanceState(Bundle state) {
    web.saveState(state);
    super.onSaveInstanceState(state);
  }

  @Override public void onBackPressed() {
    if (web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  @Override protected void onDestroy() {
    if (web != null) {
      web.stopLoading();
      web.destroy();
    }
    super.onDestroy();
  }
}
