package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.regex.Pattern;

/**
 * Existing Staff Driver PWA, presented in its own Android workspace.
 * The ONLY native operation is launching a server-authorized route; no JS
 * bridge, no browser-supplied coordinates, no service-role credentials.
 */
public final class DriverShellActivity extends AppCompatActivity {
  public static final String WEB_ORIGIN = "https://www.cradlewellnessliving.com";
  private static final String TRUSTED_HOST = "www.cradlewellnessliving.com";
  private static final Pattern BOOKING_ID = Pattern.compile(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private WebView web;
  private Button navigate;
  private String currentBookingId;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_driver_shell);
    web = findViewById(R.id.driverWeb);
    navigate = findViewById(R.id.openNativeNavigation);
    navigate.setOnClickListener(view -> {
      if (currentBookingId == null) return;
      Intent intent = new Intent(this, NativeNavigationActivity.class);
      // Booking ID is a selector, NOT an authorization grant. The native screen
      // must re-verify against the authenticated CradleHub server.
      intent.putExtra(NativeNavigationActivity.EXTRA_BOOKING_ID, currentBookingId);
      startActivity(intent);
    });

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
          return false; // Same-origin PWA, including its existing login routes.
        }
        // OAuth flows in embedded user agents may be unsupported. Never pass
        // the WebView's authenticated cookies to external web origins.
        if ("https".equals(url.getScheme())) {
          startActivity(new Intent(Intent.ACTION_VIEW, url));
        }
        return true;
      }
      @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        updateRouteAction(url); // also catches Next.js client-side pushState
      }
      @Override public void onPageFinished(WebView view, String url) {
        updateRouteAction(url);
      }
    });

    String bookingId = getIntent().getStringExtra("bookingId");
    String path = "/staff/driver";
    if (bookingId != null && BOOKING_ID.matcher(bookingId).matches()) {
      path = "/staff/driver/map?bookingId=" + bookingId;
    }
    if (state == null || web.restoreState(state) == null) {
      web.loadUrl(WEB_ORIGIN + path);
    }
    if (Build.VERSION.SDK_INT >= 33 &&
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 102);
    }
  }

  private void updateRouteAction(String rawUrl) {
    try {
      Uri url = Uri.parse(rawUrl);
      String candidate = url.getQueryParameter("bookingId");
      if ("https".equals(url.getScheme()) && TRUSTED_HOST.equals(url.getHost())
          && "/staff/driver/map".equals(url.getPath())
          && candidate != null && BOOKING_ID.matcher(candidate).matches()) {
        currentBookingId = candidate;
      } else {
        currentBookingId = null;
      }
    } catch (RuntimeException ignored) {
      currentBookingId = null;
    }
    navigate.setVisibility(currentBookingId == null ? View.GONE : View.VISIBLE);
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
