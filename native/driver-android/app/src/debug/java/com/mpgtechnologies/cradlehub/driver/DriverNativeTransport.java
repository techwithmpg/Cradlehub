package com.mpgtechnologies.cradlehub.driver;

import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Authenticated, HTTPS-only native HTTP adapter for reviewed CradleHub routes.
 * The existing WebView owns login/session cookies; server rules own permission.
 * No local table, offline mutation queue, token store or privileged API key.
 */
final class DriverNativeTransport {
  private DriverNativeTransport() { }

  static final class Result {
    final int code;
    final JSONObject body;
    Result(int code, JSONObject body) { this.code = code; this.body = body; }
    boolean ok() { return code == 200 && body.optBoolean("ok", false); }
    String error() { return body.optString("error", code == 401 ?
        "Sign in through the Staff Portal." : "Unable to contact CradleHub."); }
  }

  static String cookie() {
    return CookieManager.getInstance().getCookie(DriverShellActivity.WEB_ORIGIN);
  }

  static Result getWorkspace(String sessionCookie) throws Exception {
    return request("GET", "/api/staff/driver/native-workspace", null, sessionCookie);
  }

  static Result progress(String id, String operation, String sessionCookie) throws Exception {
    if (!StaffShellRoutePolicy.validBookingId(id) ||
        (!"start".equals(operation) && !"arrive".equals(operation))) {
      return new Result(400, new JSONObject().put("ok", false)
          .put("error", "Invalid trip action."));
    }
    JSONObject payload = new JSONObject().put("bookingId", id).put("operation", operation);
    return request("POST", "/api/staff/driver/native-travel", payload, sessionCookie);
  }

  private static Result request(String method, String path, JSONObject json, String cookies)
      throws Exception {
    if (cookies == null || cookies.isEmpty()) {
      return new Result(401, new JSONObject().put("ok", false)
          .put("error", "Sign in through the Staff Portal."));
    }
    final String origin = DriverShellActivity.WEB_ORIGIN;
    URL endpoint = new URL(origin + path);
    if (!"https".equals(endpoint.getProtocol()) ||
        endpoint.getHost() == null || endpoint.getHost().isEmpty()) {
      throw new IllegalStateException("The configured Staff origin is not HTTPS.");
    }
    HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
    try {
      conn.setInstanceFollowRedirects(false);
      conn.setConnectTimeout(10000);
      conn.setReadTimeout(10000);
      conn.setRequestMethod(method);
      conn.setUseCaches(false);
      conn.setRequestProperty("Accept", "application/json");
      conn.setRequestProperty("Cache-Control", "no-store");
      conn.setRequestProperty("Cookie", cookies);
      if (json != null) {
        byte[] bytes = json.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 1024) throw new IllegalStateException("Invalid request.");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        conn.setRequestProperty("Origin", origin);
        conn.setRequestProperty("X-CradleHub-Native", "driver-v1");
        conn.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream out = conn.getOutputStream()) { out.write(bytes); }
      }
      int code = conn.getResponseCode();
      // Supabase SSR may rotate its authenticated session cookie. Preserve
      // these server-issued cookies inside the existing WebView cookie jar,
      // or a native request could appear to log the staff out repeatedly.
      // Redirects are disabled, and the origin is a compile-time HTTPS host.
      CookieManager jar = CookieManager.getInstance();
      boolean received = false;
      for (Map.Entry<String, List<String>> header : conn.getHeaderFields().entrySet()) {
        if (header.getKey() == null || !"set-cookie".equalsIgnoreCase(header.getKey())) continue;
        if (header.getValue() == null) continue;
        for (String cookie : header.getValue()) {
          if (cookie == null || cookie.isEmpty()) continue;
          jar.setCookie(origin, cookie, null);
          received = true;
        }
      }
      if (received) jar.flush();
      if (code >= 300 && code < 400) {
        return new Result(401, new JSONObject().put("ok", false)
            .put("error", "Please sign in to CradleHub again."));
      }
      InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
      if (in == null) return new Result(code, new JSONObject());
      try (InputStream source = in; ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
        byte[] block = new byte[4096];
        int count;
        while ((count = source.read(block)) != -1) {
          buffer.write(block, 0, count);
          if (buffer.size() > 262144) throw new IllegalStateException("Server response too large.");
        }
        return new Result(code, new JSONObject(buffer.toString(StandardCharsets.UTF_8.name())));
      }
    } finally {
      conn.disconnect();
    }
  }
}
