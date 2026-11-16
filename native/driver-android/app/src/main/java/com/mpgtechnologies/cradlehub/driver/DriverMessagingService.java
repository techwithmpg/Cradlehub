package com.mpgtechnologies.cradlehub.driver;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.UUID;

/**
 * Firebase receiver foundation. A push payload is NOT authorization: it contains an opaque booking
 * ID only; the Web and native route endpoints independently check the signed-in driver and current
 * assignment.
 *
 * <p>Delivery requires separate server-side token registration and FCM sender. This file DOES NOT
 * mean push delivery is active.
 */
public final class DriverMessagingService extends FirebaseMessagingService {
  private static final String CHANNEL = "driver_assignments";

  @Override
  public void onNewToken(String token) {
    DriverDeviceRegistration.upload(this, token);
  }

  @Override
  public void onMessageReceived(RemoteMessage remote) {
    if (!"driver_assignment".equals(remote.getData().get("type"))
        && !"driver_update".equals(remote.getData().get("type"))) return;
    String bookingId = remote.getData().get("bookingId");
    try {
      UUID.fromString(bookingId);
    } catch (Exception invalid) {
      return;
    }

    if (Build.VERSION.SDK_INT >= 33
        && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) return;

    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) return;
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(
          new NotificationChannel(
              CHANNEL, "Home Service assignments", NotificationManager.IMPORTANCE_HIGH));
    }
    Intent open = new Intent(this, DriverShellActivity.class);
    open.putExtra("bookingId", bookingId);
    open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pending =
        PendingIntent.getActivity(
            this,
            bookingId.hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    String noticeId = remote.getData().get("notificationId");
    if (noticeId == null) noticeId = remote.getMessageId();
    if (noticeId == null) return;
    android.content.SharedPreferences prefs =
        getSharedPreferences("driver-notification-dedupe", MODE_PRIVATE);
    java.util.ArrayList<String> recent =
        new java.util.ArrayList<>(
            java.util.Arrays.asList(prefs.getString("recent", "").split("\n")));
    if (recent.contains(noticeId)) return;
    recent.add(noticeId);
    while (recent.size() > 100) recent.remove(0);
    manager.notify(
        noticeId.hashCode(),
        new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle("CradleHub Home Service")
            .setContentText(
                "Your driver journey has an update. Open to check the current assignment.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build());
    prefs.edit().putString("recent", android.text.TextUtils.join("\n", recent)).apply();
  }
}
