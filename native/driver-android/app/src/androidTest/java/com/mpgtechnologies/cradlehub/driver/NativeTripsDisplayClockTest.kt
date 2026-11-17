package com.mpgtechnologies.cradlehub.driver

import android.os.SystemClock
import androidx.compose.material3.Text
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import java.time.Instant
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class NativeTripsDisplayClockTest {
    @get:Rule val compose = createAndroidComposeRule<NativeDriverActivity>()

    private class DisplayOwner : LifecycleOwner {
        val registry = LifecycleRegistry(this)
        override val lifecycle: Lifecycle
            get() = registry
    }

    @Test
    fun estimatesAgeWithoutRefreshAndClockStopsBelowStarted() {
        val initial = Instant.parse("2026-11-17T02:00:00Z")
        val current = AtomicReference(initial)
        val reads = AtomicInteger()
        lateinit var owner: DisplayOwner
        val booking = "11111111-1111-4111-8111-111111111111"
        val passenger =
            TripsPassenger(
                "a",
                "Synthetic therapist",
                ServiceReadiness.IN_PROGRESS,
                initial.plusSeconds(60),
                CollectionNeed.REQUIRED,
            )
        val stop =
            TripsStop(
                "collection",
                booking,
                StopRole.THERAPIST_COLLECTION,
                "Synthetic collection",
                setOf("a"),
                lat = 10.0,
                lng = 122.0,
            )
        val trip =
            TripsJourney(
                "clock-test",
                "driver",
                TripsMode.PICK_UP,
                "Today",
                "Customer",
                "Branch",
                listOf(passenger),
                listOf(stop),
                "service_active",
                false,
            )
        val estimate =
            TripsRoadEta(
                booking,
                "collection",
                10.0,
                122.0,
                720,
                8400,
                initial,
                initial,
                10.0,
            )
        compose.runOnUiThread {
            owner = DisplayOwner().apply { registry.currentState = Lifecycle.State.RESUMED }
            compose.activity.setContentView(
                ComposeView(compose.activity).apply {
                    setContent {
                        val now =
                            rememberTripsNow(owner) {
                                reads.incrementAndGet()
                                current.get()
                            }
                        val eta = NativeTripsPolicy.eta(trip, estimate, now)
                        Text(
                            "${eta.reason ?: eta.time} | ${NativeTripsPolicy.banner(trip, now)} | ${now.epochSecond}"
                        )
                    }
                }
            )
        }
        compose
            .onNodeWithText(
                "12 min | Service in progress · Est. completion in 1 min | ${initial.epochSecond}"
            )
            .assertExists()
        current.set(initial.plusSeconds(61))
        compose.waitUntil(8000) {
            compose
                .onAllNodesWithText(
                    "GPS stale or inaccurate | Service in progress · Awaiting Complete Service | ${initial.plusSeconds(61).epochSecond}"
                )
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        compose.runOnUiThread { owner.registry.currentState = Lifecycle.State.CREATED }
        val before = reads.get()
        current.set(initial.plusSeconds(120))
        SystemClock.sleep(5500)
        assertEquals("Hidden Trips must not continue ticking", before, reads.get())
        compose.runOnUiThread { owner.registry.currentState = Lifecycle.State.RESUMED }
        compose.waitUntil(2000) {
            compose
                .onAllNodesWithText(
                    "GPS stale or inaccurate | Service in progress · Awaiting Complete Service | ${initial.plusSeconds(120).epochSecond}"
                )
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }
}
