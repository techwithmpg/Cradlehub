package com.mpgtechnologies.cradlehub.driver;

import android.webkit.CookieManager;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Same-origin, bounded, cookie-authenticated native client. Never follows redirects. */
public final class DriverHttp {
  public static final class Reply {
    public final int status;
    public final JSONObject body;

    Reply(int s, JSONObject b) {
      status = s;
      body = b;
    }
  }

  public static Reply call(String path, JSONObject payload) throws Exception {
    if (!path.startsWith("/api/staff/driver/") || path.contains(".."))
      throw new SecurityException("Invalid driver endpoint");
    String origin = DriverShellActivity.WEB_ORIGIN;
    String cookie = CookieManager.getInstance().getCookie(origin);
    if (cookie == null || cookie.isEmpty()) return new Reply(401, new JSONObject());
    HttpURLConnection c = (HttpURLConnection) new URL(origin + path).openConnection();
    try {
      c.setInstanceFollowRedirects(false);
      c.setConnectTimeout(10000);
      c.setReadTimeout(10000);
      c.setRequestProperty("Cookie", cookie);
      c.setRequestProperty("Accept", "application/json");
      c.setRequestProperty("Cache-Control", "no-store");
      if (payload != null) {
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Origin", origin);
        c.setRequestProperty("Content-Type", "application/json");
        try (OutputStream out = c.getOutputStream()) {
          out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
      }
      int status = c.getResponseCode();
      for (java.util.Map.Entry<String, java.util.List<String>> h : c.getHeaderFields().entrySet())
        if (h.getKey() != null && h.getKey().equalsIgnoreCase("Set-Cookie"))
          for (String value : h.getValue()) CookieManager.getInstance().setCookie(origin, value);
      CookieManager.getInstance().flush();
      InputStream response = status >= 400 ? c.getErrorStream() : c.getInputStream();
      if (response == null) return new Reply(status, new JSONObject());
      try (InputStream in = response;
          ByteArrayOutputStream out = new ByteArrayOutputStream()) {
        byte[] buffer = new byte[2048];
        int n;
        while ((n = in.read(buffer)) != -1) {
          out.write(buffer, 0, n);
          if (out.size() > 131072) throw new IOException("Reply too large");
        }
        return new Reply(status, new JSONObject(out.toString(StandardCharsets.UTF_8.name())));
      }
    } finally {
      c.disconnect();
    }
  }

  private DriverHttp() {}
}
