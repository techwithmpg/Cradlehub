package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.ArrayList;
import java.util.List;

/**
 * One native container for the existing CradleHub Staff workspace.
 * The server decides the staff role and owns all business mutations; WebView
 * owns the only on-screen bottom navigation. Android owns permissions, system
 * back navigation, loading/retry and the existing verified driver Nav SDK.
 */
public final class DriverShellActivity extends AppCompatActivity {
  public static final String WEB_ORIGIN = BuildConfig.STAFF_ORIGIN;
  private static final Uri ORIGIN = Uri.parse(WEB_ORIGIN);
  private static final int LOCATION_REQUEST = 103;
  private static final int CAMERA_REQUEST = 104;
  private static final int FILE_REQUEST = 105;

  private WebView web;
  private View shellOverlay;
  private TextView shellMessage;
  private ProgressBar shellProgress;
  private Button retryButton;
  private boolean mainFrameFailed;
  private String lastLaunchUrl;
  private GeolocationPermissions.Callback pendingGeolocation;
  private String pendingGeolocationOrigin;
  private PermissionRequest pendingCamera;
  private ValueCallback<Uri[]> pendingFiles;

  private static boolean trusted(Uri url) {
    return url != null && "https".equals(url.getScheme())
        && "https".equals(ORIGIN.getScheme())
        && ORIGIN.getHost() != null && ORIGIN.getHost().equalsIgnoreCase(url.getHost())
        && (url.getPort() == -1 || url.getPort() == 443);
  }

  private static boolean onlyCamera(PermissionRequest request) {
    if (request == null || !trusted(request.getOrigin())) return false;
    String[] resources = request.getResources();
    return resources.length == 1
        && PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resources[0]);
  }

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_driver_shell);
    web = findViewById(R.id.driverWeb);
    shellOverlay = findViewById(R.id.shellOverlay);
    shellMessage = findViewById(R.id.shellMessage);
    shellProgress = findViewById(R.id.shellProgress);
    retryButton = findViewById(R.id.retryButton);

    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true); // Required by existing Staff Portal.
    settings.setDomStorageEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);
    settings.setSupportMultipleWindows(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
    // Display-only hint. NEVER authorize based on the user agent.
    settings.setUserAgentString(settings.getUserAgentString() + " CradleHubStaffAndroid/1.0 CradleHubDriverAndroid/1.0");

    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(
          String origin, GeolocationPermissions.Callback callback) {
        final Uri requested;
        try { requested = Uri.parse(origin); }
        catch (RuntimeException invalid) { callback.invoke(origin, false, false); return; }
        if (!trusted(requested)) { callback.invoke(origin, false, false); return; }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
          callback.invoke(origin, true, false);
        } else {
          // A new request supersedes only the outstanding prompt.
          if (pendingGeolocation != null) pendingGeolocation.invoke(pendingGeolocationOrigin, false, false);
          pendingGeolocationOrigin = origin;
          pendingGeolocation = callback;
          ActivityCompat.requestPermissions(DriverShellActivity.this,
              new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
              LOCATION_REQUEST);
        }
      }

      @Override public void onPermissionRequest(PermissionRequest request) {
        runOnUiThread(() -> {
          // NEVER grant all requested resources; only our own origin's camera
          // capture needed for the existing QR workflow is permitted.
          if (!onlyCamera(request)) { request.deny(); return; }
          if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
            return;
          }
          if (pendingCamera != null) { request.deny(); return; }
          pendingCamera = request;
          ActivityCompat.requestPermissions(DriverShellActivity.this,
              new String[] { Manifest.permission.CAMERA }, CAMERA_REQUEST);
        });
      }

      @Override public void onPermissionRequestCanceled(PermissionRequest request) {
        if (pendingCamera == request) pendingCamera = null;
      }

      @Override public boolean onShowFileChooser(
          WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        pendingFiles = callback;
        try {
          // Android's own picker supplies a user-chosen content URI. No
          // broad storage permission or direct filesystem access is needed.
          startActivityForResult(params.createIntent(), FILE_REQUEST);
          return true;
        } catch (ActivityNotFoundException | SecurityException error) {
          pendingFiles = null;
          callback.onReceiveValue(null);
          return true;
        }
      }
    });

    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!request.isForMainFrame()) return false;
        Uri url = request.getUrl();
        if (trusted(url)) return false;
        String scheme = url == null ? "" : url.getScheme();
        // External destinations never receive the WebView session cookie.
        // Only standard user-facing HTTPS/contact handlers are allowed.
        if ("https".equals(scheme) || "tel".equals(scheme)
            || "mailto".equals(scheme) || "sms".equals(scheme)) {
          try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
          catch (ActivityNotFoundException | SecurityException ignored) { }
        }
        return true;
      }

      @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
        mainFrameFailed = false;
        showLoading();
      }

      @Override public void onReceivedError(
          WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) {
          mainFrameFailed = true;
          showError("Can't reach CradleHub. Check your connection and try again.");
        }
      }

      @Override public void onPageFinished(WebView view, String url) {
        if (!mainFrameFailed) shellOverlay.setVisibility(View.GONE);
        maybeLaunchNavigation(url);
      }

      @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        maybeLaunchNavigation(url);
      }
    });

    retryButton.setOnClickListener(v -> {
      showLoading();
      String current = web.getUrl();
      if (current != null && trusted(Uri.parse(current))) web.reload();
      else web.loadUrl(WEB_ORIGIN + "/staff/");
    });

    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
      }
    });

    String initialPath = StaffShellRoutePolicy.initialPath(getIntent().getStringExtra("bookingId"));
    if (state == null || web.restoreState(state) == null) {
      web.loadUrl(WEB_ORIGIN + initialPath);
    }
    // Do not request notification permission yet: the current FCM receiver
    // has no authenticated token enrollment/sender. An OS prompt alone cannot
    // enable background alerts, so defer it to the reviewed notification stage.
  }

  private void showLoading() {
    shellMessage.setText(R.string.staff_shell_loading);
    shellProgress.setVisibility(View.VISIBLE);
    retryButton.setVisibility(View.GONE);
    shellOverlay.setVisibility(View.VISIBLE);
  }

  private void showError(String message) {
    shellMessage.setText(message);
    shellProgress.setVisibility(View.GONE);
    retryButton.setVisibility(View.VISIBLE);
    shellOverlay.setVisibility(View.VISIBLE);
  }

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    String bookingId = intent.getStringExtra("bookingId");
    if (StaffShellRoutePolicy.validBookingId(bookingId) && web != null) {
      lastLaunchUrl = null;
      web.loadUrl(WEB_ORIGIN + StaffShellRoutePolicy.initialPath(bookingId));
    }
  }

  /** Only explicit, server-confirmed Start/Resume URLs open native guidance. */
  private void maybeLaunchNavigation(String rawUrl) {
    try {
      Uri url = Uri.parse(rawUrl);
      String id = url.getQueryParameter("bookingId");
      if (!trusted(url) || !"/staff/driver/map".equals(url.getPath())
          || !"native".equals(url.getQueryParameter("launch"))
          || !StaffShellRoutePolicy.validBookingId(id)) return;
      if (rawUrl.equals(lastLaunchUrl)) return;
      lastLaunchUrl = rawUrl;
      Intent route = new Intent(this, NativeNavigationActivity.class);
      route.putExtra(NativeNavigationActivity.EXTRA_BOOKING_ID, id);
      startActivity(route);
      // NativeNavigationActivity independently revalidates assignment and
      // travel_started on the server before obtaining destination coordinates.
    } catch (RuntimeException ignored) {
      // No URL, booking ID or local state is a grant of route authority.
    }
  }

  @Override public void onRequestPermissionsResult(
      int requestCode, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(requestCode, permissions, results);
    boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
    if (requestCode == LOCATION_REQUEST && pendingGeolocation != null) {
      pendingGeolocation.invoke(pendingGeolocationOrigin, granted, false);
      pendingGeolocation = null;
      pendingGeolocationOrigin = null;
    } else if (requestCode == CAMERA_REQUEST && pendingCamera != null) {
      PermissionRequest request = pendingCamera;
      pendingCamera = null;
      if (granted && onlyCamera(request)) {
        request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
      } else request.deny();
    }
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == FILE_REQUEST && pendingFiles != null) {
      ValueCallback<Uri[]> callback = pendingFiles;
      pendingFiles = null;
      Uri[] returned = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
      List<Uri> userContent = new ArrayList<>();
      if (returned != null) {
        for (Uri uri : returned) {
          // Never pass a file://, javascript:, or app-internal URI to a
          // Web page. OS selection alone does not validate untrusted URIs.
          if (uri != null && "content".equals(uri.getScheme())) userContent.add(uri);
        }
      }
      callback.onReceiveValue(userContent.isEmpty() ? null : userContent.toArray(new Uri[0]));
    }
  }

  @Override protected void onResume() {
    super.onResume();
    if (web != null) web.onResume();
  }

  @Override protected void onPause() {
    if (web != null) web.onPause();
    super.onPause();
  }

  @Override protected void onSaveInstanceState(Bundle state) {
    if (web != null) web.saveState(state);
    super.onSaveInstanceState(state);
  }

  @Override protected void onDestroy() {
    if (pendingCamera != null) { pendingCamera.deny(); pendingCamera = null; }
    if (pendingGeolocation != null) {
      pendingGeolocation.invoke(pendingGeolocationOrigin, false, false);
      pendingGeolocation = null;
    }
    if (pendingFiles != null) { pendingFiles.onReceiveValue(null); pendingFiles = null; }
    if (web != null) {
      web.stopLoading();
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }
}
