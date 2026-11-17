package com.mpgtechnologies.cradlehub.driver

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import android.view.*
import android.widget.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.*
import androidx.compose.ui.platform.ComposeView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.google.android.libraries.navigation.NavigationFragment
import org.json.JSONObject

/** Single native host. The SDK view stays attached across every Compose tab. */
open class NativeDriverActivity : AppCompatActivity() {
    private lateinit var model: NativeDriverModel
    private lateinit var map: FrameLayout
    private var navigation: DriverNavigationController? = null
    private lateinit var action: Button
    private var cameraAllowed by mutableStateOf(false)
    private var networkCallback: android.net.ConnectivityManager.NetworkCallback? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars =
            false
        model =
            ViewModelProvider(
                this,
                object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T =
                        NativeDriverModel(applicationContext) as T
                },
            )[NativeDriverModel::class.java]
        cameraAllowed =
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        map =
            FrameLayout(this).apply {
                id =
                    savedInstanceState?.getInt("mapContainer", 0)?.takeIf { it != 0 }
                        ?: View.generateViewId()
            }
        action = Button(this)
        model.openTrip = { id ->
            handler.postDelayed(
                {
                    if (navigation == null && map.isAttachedToWindow) initializeNavigation()
                    navigation?.let { controller ->
                        DriverPerformance.begin("route_ready")
                        controller.select(id)
                        controller.selectedBooking()?.let(model::selected)
                    }
                },
                32,
            )
        }
        model.endGuidance = { navigation?.signOut() }
        model.onAuthenticated = {
            if (!model.fixture) {
                NativeDeviceRegistry.register(this, model.backend)
                if (
                    Build.VERSION.SDK_INT >= 33 &&
                        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                            PackageManager.PERMISSION_GRANTED &&
                        !getPreferences(MODE_PRIVATE).getBoolean("alertsAsked", false)
                ) {
                    getPreferences(MODE_PRIVATE).edit().putBoolean("alertsAsked", true).apply()
                    ActivityCompat.requestPermissions(
                        this,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        205,
                    )
                }
            }
        }
        map.addOnAttachStateChangeListener(
            object : View.OnAttachStateChangeListener {
                override fun onViewAttachedToWindow(view: View) {
                    handler.post {
                        if (model.ui.tab == DriverTab.MAP && model.ui.selectedId != null)
                            handler.postDelayed({ initializeNavigation() }, 32)
                    }
                }

                override fun onViewDetachedFromWindow(view: View) {}
            }
        )
        val compose =
            ComposeView(this).apply {
                setContent {
                    NativeDriverApp(
                        model,
                        map,
                        this@NativeDriverActivity,
                        cameraAllowed,
                        {
                            if (
                                !shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) &&
                                    getPreferences(MODE_PRIVATE).getBoolean("cameraAsked", false)
                            )
                                startActivity(
                                    Intent(
                                        android.provider.Settings
                                            .ACTION_APPLICATION_DETAILS_SETTINGS,
                                        Uri.parse("package:$packageName"),
                                    )
                                )
                            else {
                                getPreferences(MODE_PRIVATE)
                                    .edit()
                                    .putBoolean("cameraAsked", true)
                                    .apply()
                                ActivityCompat.requestPermissions(
                                    this@NativeDriverActivity,
                                    arrayOf(Manifest.permission.CAMERA),
                                    204,
                                )
                            }
                        },
                        {
                            DriverPerformance.begin("start_to_guidance")
                            action.performClick()
                        },
                        { navigation?.endRoute() },
                        { navigation?.toggleVoice() },
                        { navigation?.recenter() },
                        { phone ->
                            startActivity(
                                Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null))
                            )
                        },
                    )
                }
            }
        setContentView(compose)
        val network = getSystemService(android.net.ConnectivityManager::class.java)
        networkCallback =
            object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onLost(value: android.net.Network) {
                    handler.post { model.connectivity(false) }
                }

                override fun onCapabilitiesChanged(
                    value: android.net.Network,
                    capabilities: android.net.NetworkCapabilities,
                ) {
                    handler.post {
                        model.connectivity(
                            capabilities.hasCapability(
                                android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED
                            )
                        )
                    }
                }
            }
        network.registerDefaultNetworkCallback(networkCallback!!)
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when {
                        model.ui.secondary != null -> model.closeSecondary()
                        model.ui.tab != DriverTab.TODAY -> model.selectTab(DriverTab.TODAY)
                        navigation?.isGuiding() == true -> moveTaskToBack(true)
                        else -> finish()
                    }
                }
            },
        )
        val incoming = bookingFrom(intent) ?: savedInstanceState?.getString("selectedBooking")
        if (incoming != null) {
            if (model.ui.workspace != null) model.selectTrip(incoming)
            else model.pendingNotification = incoming
        }
        if (model.fixture) {
            intent.getStringExtra("fixtureScreen")?.let { screen ->
                DriverTab.entries
                    .firstOrNull { it.title.equals(screen, true) }
                    ?.let(model::selectTab)
            }
            if (model.ui.tab == DriverTab.MAP)
                model.ui.workspace?.trips?.firstOrNull()?.let { model.selectTrip(it.id) }
        }
    }

    private fun initializeNavigation() {
        if (navigation != null || isFinishing || supportFragmentManager.isStateSaved) return
        val fragment =
            (supportFragmentManager.findFragmentByTag("native-driver-map") as? NavigationFragment)
                ?: NavigationFragment().also {
                    supportFragmentManager
                        .beginTransaction()
                        .add(map.id, it, "native-driver-map")
                        .commitNow()
                }
        val status = TextView(this)
        val pause = Button(this)
        navigation =
            DriverNavigationController(
                this,
                fragment,
                status,
                action,
                pause,
                { path, body ->
                    if (model.fixture)
                        DriverHttp.Reply(
                            503,
                            JSONObject().put("ok", false).put("code", "ui_fixture"),
                        )
                    else model.backend.call(path, body)
                },
                { id ->
                    model.pendingNotification = id
                    model.authExpired()
                },
            )
        navigation!!.setObserver {
            model.navigation(
                NativeNavUi(
                    status.text.toString(),
                    action.text.toString(),
                    action.isEnabled,
                    navigation!!.isGuiding(),
                    navigation!!.isRouteReady(),
                    navigation!!.isLoading(),
                    navigation!!.selectedStage(),
                )
            )
        }
        model.ui.selectedId?.let { navigation!!.select(it) }
    }

    private fun bookingFrom(intent: Intent): String? {
        val extra = intent.getStringExtra("bookingId")
        val uri = intent.data
        val id =
            extra
                ?: if (uri?.scheme == "cradlehub-driver" && uri.host == "trip") uri.path?.trim('/')
                else null
        return id?.takeIf { DriverTripPolicy.validId(it) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        bookingFrom(intent)?.let {
            if (model.ui.workspace != null) model.selectTrip(it) else model.pendingNotification = it
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putInt("mapContainer", map.id)
        outState.putString("selectedBooking", navigation?.selectedBooking())
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        cameraAllowed =
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        navigation?.resume()
        if (::model.isInitialized && model.ui.workspace != null) model.refresh()
    }

    override fun onStop() {
        navigation?.pause()
        super.onStop()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 204)
            cameraAllowed = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        if (requestCode == 205) {
            NativeDeviceRegistry.reset()
            NativeDeviceRegistry.register(this, model.backend)
        }
        navigation?.resume()
    }

    override fun onDestroy() {
        networkCallback?.let {
            getSystemService(android.net.ConnectivityManager::class.java)
                .unregisterNetworkCallback(it)
        }
        handler.removeCallbacksAndMessages(null)
        navigation?.destroy(isFinishing)
        model.openTrip = null
        model.endGuidance = null
        model.onAuthenticated = null
        super.onDestroy()
    }
}
