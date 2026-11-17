package com.mpgtechnologies.cradlehub.driver

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject

/** Captures raw evidence after QR decode. Only the existing server decides geofence/attendance. */
internal class NativeAttendanceLocation(private val context: Context) {
    private val manager = context.getSystemService(LocationManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var callback: ((JSONObject?) -> Unit)? = null
    private val timeout = Runnable { finish(null) }
    private val listener =
        object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (fresh(location)) finish(location)
            }
        }

    private fun fresh(location: Location): Boolean {
        val age = SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos
        return age in 0..10_000_000_000L && location.hasAccuracy() && location.accuracy > 0
    }

    fun capture(result: (JSONObject?) -> Unit) {
        callback = result
        if (
            context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            finish(null)
            return
        }
        try {
            val providers =
                listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter {
                    manager.isProviderEnabled(it)
                }
            if (providers.isEmpty()) {
                finish(null)
                return
            }
            val recent =
                providers
                    .mapNotNull { manager.getLastKnownLocation(it) }
                    .filter(::fresh)
                    .minByOrNull { it.accuracy }
            if (recent != null) {
                finish(recent)
                return
            }
            main.postDelayed(timeout, 15000)
            providers.forEach {
                manager.requestLocationUpdates(it, 1000L, 0f, listener, Looper.getMainLooper())
            }
        } catch (error: RuntimeException) {
            finish(null)
        }
    }

    private fun finish(point: Location?) {
        val reply = callback ?: return
        cancel()
        reply(
            point?.let {
                JSONObject()
                    .put("latitude", it.latitude)
                    .put("longitude", it.longitude)
                    .put("accuracy", it.accuracy.toDouble())
                    .put("timestamp", it.time)
            }
        )
    }

    fun cancel() {
        callback = null
        main.removeCallbacks(timeout)
        try {
            manager.removeUpdates(listener)
        } catch (_: SecurityException) {}
    }
}
