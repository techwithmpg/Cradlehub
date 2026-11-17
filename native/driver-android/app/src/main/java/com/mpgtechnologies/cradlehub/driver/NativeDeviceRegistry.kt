package com.mpgtechnologies.cradlehub.driver

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.Executors

internal object NativeDeviceRegistry {
    private val io = Executors.newSingleThreadExecutor()
    private var last = 0L

    @JvmStatic
    fun onNewToken(context: Context, token: String) {
        val app = context.applicationContext
        io.execute {
            runCatching {
                val backend = NativeDriverBackend(app)
                if (backend.hasSession && backend.configured)
                    backend.registerDevice(
                        token,
                        NotificationManagerCompat.from(app).areNotificationsEnabled(),
                    )
            }
        }
    }

    // The reviewed server registry is FCM-token based. FID migration requires a separate server
    // contract.
    @Suppress("DEPRECATION")
    @Synchronized
    fun register(context: Context, backend: NativeDriverBackend) {
        if (
            !backend.configured ||
                !backend.hasSession ||
                FirebaseApp.getApps(context).isEmpty() ||
                System.currentTimeMillis() - last < 120000
        )
            return
        last = System.currentTimeMillis()
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            val app = context.applicationContext
            io.execute {
                runCatching {
                    backend.registerDevice(
                        token,
                        NotificationManagerCompat.from(app).areNotificationsEnabled(),
                    )
                }
            }
        }
    }

    @Synchronized
    fun reset() {
        last = 0
    }
}
