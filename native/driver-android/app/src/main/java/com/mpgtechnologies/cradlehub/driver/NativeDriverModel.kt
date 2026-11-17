package com.mpgtechnologies.cradlehub.driver

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONObject

internal object DriverPerformance {
    private val started = SystemClock.elapsedRealtime()
    private val marks = mutableMapOf<String, Long>()

    @Synchronized
    fun begin(name: String) {
        marks[name] = SystemClock.elapsedRealtime()
    }

    @Synchronized
    fun end(name: String) {
        val time = marks.remove(name) ?: return
        record(name, SystemClock.elapsedRealtime() - time)
    }

    @Synchronized
    fun firstFrame() {
        if (!marks.containsKey("first_frame_done")) {
            marks["first_frame_done"] = 1
            record("activity_to_first_compose_frame", SystemClock.elapsedRealtime() - started)
        }
    }

    fun record(name: String, millis: Long) {
        Log.i(
            "CradleDriverPerf",
            "$name elapsed_ms=$millis mode=${if(BuildConfig.NATIVE_UI_FIXTURE)"fixture" else "backend"}",
        )
    }
}

internal class NativeDriverModel(context: Context) : ViewModel() {
    val backend = NativeDriverBackend(context.applicationContext)
    val fixture =
        BuildConfig.DEBUG &&
            BuildConfig.NATIVE_UI_FIXTURE &&
            context.packageName.endsWith(".localtest")
    private var sessionVisible by mutableStateOf(fixture || backend.hasSession)
    var ui by mutableStateOf(NativeDriverUi())
        private set

    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var generation = 0
    private var refreshing = false
    private var scanRetry: Pair<String, String>? = null
    var pendingNotification: String? = null
    var openTrip: ((String) -> Unit)? = null
    var openMap: (() -> Unit)? = null
    var endGuidance: (() -> Unit)? = null
    var onAuthenticated: (() -> Unit)? = null

    init {
        if (BuildConfig.DEBUG)
            android.util.Log.i(
                "CradleDriverAuth",
                "configured=${backend.configured} fixture=$fixture",
            )
        if (BuildConfig.NATIVE_OWNER_PHONE && backend.configured)
            io.execute {
                runCatching { backend.checkConnection() }
                    .onFailure {
                        android.util.Log.w(
                            "CradleDriverAuth",
                            "connection_check_failed type=${it.javaClass.simpleName}",
                        )
                    }
            }
        refresh()
    }

    val signedIn
        get() = sessionVisible

    private fun fixtureWorkspace(): DriverWorkspace =
        Class.forName("com.mpgtechnologies.cradlehub.driver.NativeUiFixture")
            .getMethod("workspace")
            .invoke(null) as DriverWorkspace

    fun refresh() {
        if (refreshing) return
        if (!signedIn) {
            ui = ui.copy(loading = false)
            return
        }
        refreshing = true
        val expected = generation
        if (ui.workspace == null) ui = ui.copy(loading = true, error = null)
        else ui = ui.copy(busy = true)
        DriverPerformance.begin("trips_loading")
        io.execute {
            try {
                val workspace = if (fixture) fixtureWorkspace() else backend.workspace()
                main.post {
                    if (expected == generation) {
                        ui =
                            ui.copy(
                                workspace = workspace,
                                loading = false,
                                busy = false,
                                error =
                                    if ("trips" in workspace.failures) "Trips unavailable"
                                    else null,
                                stale = false,
                            )
                        onAuthenticated?.invoke()
                        pendingNotification?.let {
                            pendingNotification = null
                            selectTrip(it)
                        }
                    }
                }
            } catch (error: Exception) {
                if (BuildConfig.DEBUG)
                    android.util.Log.w(
                        "CradleDriverAuth",
                        "sign_in_failed type=${error.javaClass.simpleName}",
                    )
                main.post {
                    if (expected == generation) {
                        if (error is NativeAuthExpired) {
                            authExpired()
                        } else
                            ui =
                                ui.copy(
                                    loading = false,
                                    busy = false,
                                    error =
                                        if (ui.workspace == null) "Unable to load assignments"
                                        else "Refresh unavailable",
                                    stale = ui.workspace != null,
                                )
                    }
                }
            } finally {
                main.post {
                    refreshing = false
                    DriverPerformance.end("trips_loading")
                }
            }
        }
    }

    fun login(email: String, password: String) {
        if (ui.busy) return
        ui = ui.copy(busy = true, error = null)
        val expected = ++generation
        io.execute {
            try {
                backend.signIn(email, password)
                main.post {
                    if (expected == generation) {
                        sessionVisible = true
                        scanRetry = null
                        ui = ui.copy(busy = false, loading = true)
                        refresh()
                    }
                }
            } catch (error: Exception) {
                main.post {
                    if (expected == generation)
                        ui =
                            ui.copy(
                                busy = false,
                                loading = false,
                                error =
                                    when {
                                        !backend.configured -> "Connection not configured"
                                        error is NativeSignInFailure -> error.message
                                        error is javax.net.ssl.SSLException ->
                                            "Secure connection failed. Check your phone date and network."
                                        error is java.io.IOException ->
                                            "Connection failed. Check your internet and try again."
                                        else ->
                                            "Sign-in could not finish. Restart the app and try again."
                                    },
                            )
                }
            }
        }
    }

    fun selectTab(tab: DriverTab) {
        DriverPerformance.begin("tab_switch")
        ui = ui.copy(tab = tab, secondary = null)
    }

    fun showSecondary(value: String) {
        ui = ui.copy(secondary = value)
    }

    fun closeSecondary() {
        ui = ui.copy(secondary = null)
    }

    fun tripsMode(value: TripsMode) {
        ui = ui.copy(tripsMode = value)
    }

    fun openRoute(journey: TripsJourney) {
        if (ui.stale) return
        val driver = ui.workspace?.profile?.id ?: return
        val stop = NativeTripsPolicy.route(journey, driver) ?: return
        selectTrip(
            stop.bookingId
        ) // Existing itinerary reauthorizes its current stop; no destination override.
    }

    fun filter(value: TripFilter) {
        ui = ui.copy(filter = value)
    }

    fun selectTrip(id: String) {
        if (!DriverTripPolicy.validId(id)) return
        val known = ui.workspace?.trips?.firstOrNull { it.id == id }
        if (known?.serviceHistory == true || known?.stage == "complete") return
        if (ui.nav.guiding && ui.selectedId != id) {
            ui = ui.copy(tab = DriverTab.MAP, secondary = null)
            return
        }
        DriverPerformance.begin("trip_tap_to_native_map")
        ui = ui.copy(tab = DriverTab.MAP, secondary = null, selectedId = id)
        openTrip?.invoke(id)
    }

    fun selected(id: String) {
        ui = ui.copy(selectedId = id)
    }

    fun navigation(value: NativeNavUi) {
        val brief =
            when {
                value.status.startsWith("Journey status unavailable") -> "Unable to verify trip"
                value.status.startsWith("Offline") -> "Connection unavailable"
                value.status.startsWith("Native navigation is unavailable") ->
                    "Navigation unavailable"
                value.status.startsWith("Route calculation failed") -> "Route unavailable"
                value.status.startsWith("Update rejected") -> "Trip changed. Refresh"
                value.status.startsWith("Legacy route unavailable") -> "Trip unavailable"
                else -> value.status
            }
        val nativeValue = value.copy(status = brief)
        if (value.routeReady && !ui.nav.routeReady) DriverPerformance.end("route_ready")
        if (value.guiding && !ui.nav.guiding) DriverPerformance.end("start_to_guidance")
        ui = ui.copy(nav = nativeValue)
    }

    fun scanLocationStarted() {
        ui = ui.copy(scanBusy = true, scanStatus = "Checking location", scanOk = null)
    }

    fun scanLocationFailed(message: String) {
        ui = ui.copy(scanBusy = false, scanStatus = message, scanOk = false)
    }

    fun scanWithLocation(raw: String, location: JSONObject) {
        ui = ui.copy(scanBusy = false)
        scan(raw, location)
    }

    fun scan(raw: String, location: JSONObject? = null) {
        if (ui.scanBusy || ui.scanOk != null) return
        val id = scanRetry?.takeIf { it.first == raw }?.second ?: UUID.randomUUID().toString()
        scanRetry = raw to id
        val expected = generation
        ui = ui.copy(scanBusy = true, scanStatus = "Confirming scan", scanOk = null)
        io.execute {
            try {
                val result =
                    if (fixture)
                        JSONObject()
                            .put("ok", false)
                            .put("title", "UI test · no attendance submitted")
                    else backend.scan(raw, id, location)
                main.post {
                    if (expected == generation) {
                        scanRetry = null
                        ui =
                            ui.copy(
                                scanBusy = false,
                                scanOk = result.optBoolean("ok"),
                                scanStatus = result.nullableText("title") ?: "Scan not confirmed",
                            )
                        refresh()
                    }
                }
            } catch (error: Exception) {
                main.post {
                    if (expected == generation)
                        ui =
                            ui.copy(
                                scanBusy = false,
                                scanOk = false,
                                scanStatus =
                                    if (error is IllegalArgumentException)
                                        "Use your branch attendance QR"
                                    else "Scan not confirmed. Retry.",
                            )
                }
            }
        }
    }

    fun scanAgain() {
        ui = ui.copy(scanOk = null, scanBusy = false, scanStatus = "Ready to scan")
    }

    fun cameraError(message: String) {
        if (!ui.scanBusy && ui.scanOk == null) ui = ui.copy(scanStatus = message)
    }

    fun tick() {
        if (ui.workspace?.verifiedAt?.isBefore(Instant.now().minusSeconds(60)) == true)
            ui = ui.copy(stale = true)
        refresh()
    }

    fun authExpired() {
        generation++
        sessionVisible = false
        scanRetry = null
        endGuidance?.invoke()
        ui = NativeDriverUi(loading = false, error = "Sign in again")
        io.execute { backend.clear() }
    }

    fun connectivity(online: Boolean) {
        if (!online && ui.workspace != null) ui = ui.copy(stale = true)
        if (online && signedIn) refresh()
    }

    fun logout() {
        generation++
        sessionVisible = false
        scanRetry = null
        endGuidance?.invoke()
        pendingNotification = null
        ui = NativeDriverUi(loading = false, busy = true)
        io.execute {
            val revoked = runCatching { backend.signOut() }.getOrDefault(false)
            main.post {
                ui =
                    NativeDriverUi(
                        loading = false,
                        error = if (revoked || fixture) null else "Signed out on this device",
                    )
            }
        }
    }

    override fun onCleared() {
        generation++
        io.shutdownNow()
        super.onCleared()
    }
}
