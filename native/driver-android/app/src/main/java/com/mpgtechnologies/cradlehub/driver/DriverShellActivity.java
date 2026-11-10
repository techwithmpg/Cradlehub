package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.regex.Pattern;

/**
 * Driver PWA is the single trip UI. No duplicate native button or JS bridge.
 * Only a server-confirmed Start action navigates the WebView to an explicit,
 * same-origin launch URL; native itinerary STILL rechecks driver authority.
 */
public final class DriverShellActivity extends AppCompatActivity {
  public static final String WEB_ORIGIN = "https://www.cradlewellnessliving.com";
  private static final String TRUSTED_HOST = "www.cradlewellnessliving.com";
  private static final int LOCATION_REQUEST = 103;
  private static final Pattern BOOKING_ID = Pattern.compile(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private WebView web;
  private String lastLaunchUrl;
  private GeolocationPermissions.Callback pendingGeolocation;
  private String pendingGeolocationOrigin;

  private static boolean trusted(Uri url) {
    return "https".equals(url.getScheme()) && TRUSTED_HOST.equals(url.getHost())
        && (url.getPort() == -1 || url.getPort() == 443);
  }

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_driver_shell);
    web = findViewById(R.id.driverWeb);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    // Presentation hint only. Never use the User-Agent as an authorization check.
    settings.setUserAgentString(settings.getUserAgentString() + " CradleHubDriverAndroid/1.0");
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(
          String origin, GeolocationPermissions.Callback callback) {
        final Uri requested;
        try { requested = Uri.parse(origin); }
        catch (RuntimeException invalid) { callback.invoke(origin, false, false); return; }
        if (!trusted(requested)) {
          callback.invoke(origin, false, false);
          return;
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
          callback.invoke(origin, true, false);
        } else {
          pendingGeolocationOrigin = origin;
          pendingGeolocation = callback;
          ActivityCompat.requestPermissions(DriverShellActivity.this,
              new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, LOCATION_REQUEST);
        }
      }
    });
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!request.isForMainFrame()) return false;
        Uri url = request.getUrl();
        if (trusted(url)) return false;
        // Browser OAuth/external destinations never receive this WebView's
        // authentication cookies or an injected JavaScript bridge.
        if ("https".equals(url.getScheme())) {
          startActivity(new Intent(Intent.ACTION_VIEW, url));
        }
        return true;
      }
      @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        maybeLaunchNavigation(url);
      }
      @Override public void onPageFinished(WebView view, String url) {
        maybeLaunchNavigation(url);
      }
    });

    String bookingId = getIntent().getStringExtra("bookingId");
    String path = "/staff/driver";
    if (bookingId != null && BOOKING_ID.matcher(bookingId).matches()) {
      path = "/staff/driver/map?bookingId=" + bookingId;
    }
    if (state == null || web.restoreState(state) == null) web.loadUrl(WEB_ORIGIN + path);
    if (Build.VERSION.SDK_INT >= 33 &&
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 102);
    }
  }

  /** A notification tap always shows the assigned route preview first. */
  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    String id = intent.getStringExtra("bookingId");
    if (id != null && BOOKING_ID.matcher(id).matches() && web != null) {
      lastLaunchUrl = null;
      web.loadUrl(WEB_ORIGIN + "/staff/driver/map?bookingId=" + id);
    }
  }

  private void maybeLaunchNavigation(String rawUrl) {
    try {
      Uri url = Uri.parse(rawUrl);
      String id = url.getQueryParameter("bookingId");
      if (!trusted(url) || !"/staff/driver/map".equals(url.getPath())
          || !"native".equals(url.getQueryParameter("launch"))
          || id == null || !BOOKING_ID.matcher(id).matches()) return;
      // The request query changes for each explicit Start / Resume action.
      // Avoid repeated launches from WebView page-finished/history callbacks.
      if (rawUrl.equals(lastLaunchUrl)) return;
      lastLaunchUrl = rawUrl;
      Intent nativeRoute = new Intent(this, NativeNavigationActivity.class);
      nativeRoute.putExtra(NativeNavigationActivity.EXTRA_BOOKING_ID, id);
      startActivity(nativeRoute);
    } catch (RuntimeException ignored) {
      // Malformed/untrusted navigation never launches native activity.
    }
  }

  @Override public void onRequestPermissionsResult(
      int requestCode, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(requestCode, permissions, results);
    if (requestCode == LOCATION_REQUEST && pendingGeolocation != null) {
      boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
      pendingGeolocation.invoke(pendingGeolocationOrigin, granted, false);
      pendingGeolocation = null;
      pendingGeolocationOrigin = null;
    }
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
