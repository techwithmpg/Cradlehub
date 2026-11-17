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
    fun upcomingAndCompletedFiltersStayDistinct() {
        ready()
        compose.onNodeWithText("Trips", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Upcoming").performClick()
        compose.onNodeWithText("UI Test Customer C").assertExists()
        compose.onNodeWithText("UI Test Customer A").assertDoesNotExist()
        compose.onNodeWithText("Completed").performClick()
        compose.onNodeWithText("Service completed").assertExists()
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
