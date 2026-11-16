package com.mpgtechnologies.cradlehub.driver;

import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.UUID;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Token stays in Firebase storage and the private authenticated server registry. */
final class DriverDeviceRegistration {
  private static final ExecutorService io = Executors.newSingleThreadExecutor();
  private static long lastAttempt;

  static synchronized void register(Context context) {
    if (FirebaseApp.getApps(context).isEmpty()) {
      status(context, "unavailable");
      return;
    }
    if (System.currentTimeMillis() - lastAttempt < 120000) return;
    lastAttempt = System.currentTimeMillis();
    FirebaseMessaging.getInstance()
        .getToken()
        .addOnSuccessListener(token -> upload(context, token))
        .addOnFailureListener(error -> status(context, "unavailable"));
  }

  private static void status(Context context, String value) {
    if (context instanceof DriverShellActivity)
      ((DriverShellActivity) context).setDeviceStatus(value);
  }

  static void reset() {
    lastAttempt = 0;
  }

  static void upload(Context context, String token) {
    Context app = context.getApplicationContext();
    io.execute(
        () -> {
          try {
            android.content.SharedPreferences prefs =
                app.getSharedPreferences("driver-installation", Context.MODE_PRIVATE);
            String id = prefs.getString("id", null);
            if (id == null) {
              id = UUID.randomUUID().toString();
              prefs.edit().putString("id", id).apply();
            }
            boolean enabled =
                androidx.core.app.NotificationManagerCompat.from(app).areNotificationsEnabled();
            DriverHttp.Reply reply =
                DriverHttp.call(
                    "/api/staff/driver/native-device",
                    new JSONObject()
                        .put("installationId", id)
                        .put("token", token)
                        .put("enabled", enabled));
            status(
                context, reply.status == 200 ? (enabled ? "registered" : "denied") : "unavailable");
          } catch (Exception ignored) {
            status(context, "unavailable");
            /* Retry after the next signed-in page/resume. Never log the token. */
          }
        });
  }
}
