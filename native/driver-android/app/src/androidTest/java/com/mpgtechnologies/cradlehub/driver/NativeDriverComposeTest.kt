package com.mpgtechnologies.cradlehub.driver

import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeDriverComposeTest {
    @get:Rule val compose = createAndroidComposeRule<NativeDriverActivity>()

    private fun ready() {
        compose.waitUntil(15000) {
            compose.onAllNodesWithText("On duty").fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun fiveNativeTabsAndMoreDestinationsAreFunctional() {
        ready()
        listOf("Today", "Trips", "Scan", "Map", "More").forEach {
            compose.onNodeWithText(it, useUnmergedTree = true).assertExists()
        }
        compose.onNodeWithText("More", useUnmergedTree = true).performClick()
        compose.onNodeWithText("My Profile").assertIsDisplayed()
        compose.onNodeWithText("Attendance & Shift").assertIsDisplayed()
        compose.onNodeWithText("Logout").assertIsDisplayed()
        compose.onNodeWithText("My Profile").performClick()
        compose.onNodeWithText("‹ Back").assertIsDisplayed()
    }

    @Test
    fun emptyMapHasNoBrandBannerOrOpaqueEmptyState() {
        ready()
        compose.onNodeWithText("Map", useUnmergedTree = true).performClick()
        compose.onNodeWithText("View trips").assertIsDisplayed()
        compose.onNodeWithText("CRADLEHUB DRIVER · UI TEST").assertDoesNotExist()
        compose.onNodeWithText("No trip selected").assertDoesNotExist()
        compose.onNodeWithText("Trip details").assertDoesNotExist()
    }

    @Test
    fun tripTapOpensNativeMapWithoutDetailsModal() {
        ready()
        compose.onNodeWithText("Open trip").performClick()
        compose.waitUntil(15000) {
            compose.onAllNodesWithText("Trip details").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Trip details").assertIsDisplayed()
        compose.onNodeWithText("End route").assertDoesNotExist()
    }

    @Test
    fun tripsModesKeepCorrectCountsReadinessAndHistory() {
        ready()
        compose.onNodeWithText("Trips", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Drop-off").assertIsSelected()
        compose.onNodeWithText("2 Trips").assertIsDisplayed()
        compose.onNodeWithText("12 min").assertIsDisplayed()
        compose.onNodeWithText("Therapist A · TEST").assertIsDisplayed()
        compose.onNodeWithText("Pick-up").performClick()
        compose.onNodeWithText("Pick-up").assertIsSelected()
        compose.onNodeWithText("2 Trips").assertIsDisplayed()
        compose.onNodeWithText("9 min").assertIsDisplayed()
        compose.onNodeWithText("Service completed · Ready for pickup").assertIsDisplayed()
        compose.onNodeWithTag("route-fixture-pick-wait").assertDoesNotExist()
        compose.onNodeWithTag("trips-list").performScrollToNode(hasText("24 min"))
        compose.onNodeWithText("24 min").assertIsDisplayed()
        compose
            .onNodeWithText("Service in progress · Est. completion in 28 min")
            .assertIsDisplayed()
        compose.onNodeWithText("Drop-off").performClick()
        compose.onNodeWithText("12 min").assertIsDisplayed()
        compose.onNodeWithText("More", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Trip History").performClick()
        compose.onNodeWithText("UI Test Service Record").assertIsDisplayed()
        compose.onNodeWithText("Service completed").assertIsDisplayed()
    }

    @Test
    fun dropOffRouteOpensExistingMapDirectly() {
        ready()
        compose.onNodeWithText("Trips", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("route-fixture-drop-a").performClick()
        compose.waitUntil(15000) {
            compose.onAllNodesWithText("Trip details").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("DROP-OFF").assertIsDisplayed()
        compose.onNodeWithText("‹ Back").assertDoesNotExist()
        compose.onNodeWithText("UI TEST · Branch pickup").assertIsDisplayed()
    }

    @Test
    fun pickupRouteOpensCollectionNotDelivery() {
        ready()
        compose.onNodeWithText("Trips", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Pick-up").performClick()
        compose.onNodeWithTag("route-fixture-pick-ready").performClick()
        compose.waitUntil(15000) {
            compose.onAllNodesWithText("Trip details").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("PICK-UP").assertIsDisplayed()
        compose.onNodeWithText("UI TEST · Collection point").assertIsDisplayed()
        compose.onNodeWithText("‹ Back").assertDoesNotExist()
    }

    @Test
    fun pooledCardNamesSeparateCustomerStops() {
        ready()
        compose.onNodeWithText("Trips", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("trips-list").performScrollToNode(hasText("2 Therapists (Pooled)"))
        compose.onNodeWithText("Lina · TEST & Nura · TEST").assertExists()
        compose.onNodeWithText("Lina · TEST · Customer · Bacolod · Pending").assertExists()
        compose.onNodeWithText("Nura · TEST · Customer · Alijis · Pending").assertExists()
        compose.onNodeWithTag("route-fixture-drop-pool").performScrollTo().performClick()
        compose.waitUntil(15000) {
            compose.onAllNodesWithText("Trip details").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Customer · Bacolod").assertIsDisplayed()
    }

    @Test
    fun nativeHostContainsNoBrowserView() {
        ready()
        compose.runOnUiThread {
            fun check(view: View) {
                assertFalse(
                    "No browser UI may be embedded",
                    view.javaClass.name.startsWith("android.webkit."),
                )
                if (view is ViewGroup) for (i in 0 until view.childCount) check(view.getChildAt(i))
            }
            check(compose.activity.window.decorView)
        }
    }

    @Test
    fun sessionStoreEncryptsAndClears() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = NativeSessionStore(context, "native-driver-test-vault")
        try {
            store.write(JSONObject().put("session", "SYNTHETIC_SECRET_ONLY"))
            val raw =
                context
                    .getSharedPreferences("native-driver-test-vault", 0)
                    .getString("sealed", "")!!
            assertFalse(raw.contains("SYNTHETIC_SECRET_ONLY"))
            assertEquals("SYNTHETIC_SECRET_ONLY", store.read()!!.getString("session"))
            store.clear()
            assertNull(store.read())
        } finally {
            store.clear()
        }
    }

    @Test
    fun scanTabShowsNativeCameraOrPermissionRecovery() {
        ready()
        compose.onNode(hasText("Scan") and hasClickAction()).performClick()
        compose.waitUntil(10000) {
            compose.onAllNodesWithText("Scan branch QR").fetchSemanticsNodes().isNotEmpty() ||
                compose.onAllNodesWithText("Allow camera").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Trip details").assertDoesNotExist()
    }
}
