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
 * Firebase receiver foundation. A push payload is NOT authorization:
 * it contains an opaque booking ID only; the Web and native route endpoints
 * independently check the signed-in driver and current assignment.
 *
 * Delivery requires separate server-side token registration and FCM sender.
 * This file DOES NOT mean push delivery is active.
 */
public final class DriverMessagingService extends FirebaseMessagingService {
  private static final String CHANNEL = "driver_assignments";

  @Override public void onNewToken(String token) {
    // Tokens are sensitive device identifiers. No logging, browser storage,
    // or upload until an authenticated staff-bound server registration writer
    // is designed, reviewed and approved.
  }

  @Override public void onMessageReceived(RemoteMessage remote) {
    if (!"driver_assignment".equals(remote.getData().get("type"))) return;
    String bookingId = remote.getData().get("bookingId");
    try { UUID.fromString(bookingId); }
    catch (Exception invalid) { return; }

    if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
          != PackageManager.PERMISSION_GRANTED) return;

    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) return;
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(new NotificationChannel(
          CHANNEL, "Home Service assignments", NotificationManager.IMPORTANCE_HIGH));
    }
    Intent open = new Intent(this, DriverShellActivity.class);
    open.putExtra("bookingId", bookingId);
    open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pending = PendingIntent.getActivity(this, bookingId.hashCode(), open,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    manager.notify(bookingId.hashCode(),
        new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle("CradleHub Home Service")
            .setContentText("A driver assignment is ready to view.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build());
  }
}
