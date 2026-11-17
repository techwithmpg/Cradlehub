package com.mpgtechnologies.cradlehub.driver

import java.time.LocalDate
import java.util.Base64
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeDriverPolicyTest {
    private val today = LocalDate.parse("2026-11-17")

    private fun trip(
        stage: String = "pickup_pending",
        date: LocalDate = today,
        history: Boolean = false,
    ) =
        DriverTrip(
            "11111111-1111-4111-8111-111111111111",
            1,
            stage,
            if (stage.startsWith("collection")) "collection" else "pickup",
            "Test customer",
            "Test provider",
            date,
            "12:00:00",
            "Test branch",
            "Test destination",
            serviceHistory = history,
        )

    private fun snapshot() =
        JSONObject()
            .put("bookingId", trip().id)
            .put("revision", 1)
            .put("stage", "pickup_pending")
            .put("leg", "pickup")
            .put("destination", JSONObject.NULL)
            .put("observedAt", "2026-11-17T00:00:00Z")

    @Test
    fun tomorrowDoesNotAppearUnderActive() {
        assertTrue(
            DriverTripPolicy.filtered(
                    listOf(trip(date = today.plusDays(1))),
                    TripFilter.ACTIVE,
                    today,
                )
                .isEmpty()
        )
    }

    @Test
    fun tomorrowAppearsUnderUpcoming() {
        assertEquals(
            1,
            DriverTripPolicy.filtered(
                    listOf(trip(date = today.plusDays(1))),
                    TripFilter.UPCOMING,
                    today,
                )
                .size,
        )
    }

    @Test
    fun completedServiceWithOpenCollectionStaysActive() {
        assertEquals(
            "Collect therapist",
            DriverTripPolicy.filtered(listOf(trip("collection_pending")), TripFilter.ACTIVE, today)
                .single()
                .label,
        )
    }

    @Test
    fun serviceHistoryCannotBecomeNavigationTask() {
        val record = trip("service_history", history = true)
        assertFalse(record.actionable)
        assertTrue(DriverTripPolicy.filtered(listOf(record), TripFilter.ACTIVE, today).isEmpty())
    }

    @Test
    fun remainingCollectionFromYesterdayIsStillActive() {
        assertEquals(
            1,
            DriverTripPolicy.filtered(
                    listOf(trip("collection_pending", today.minusDays(1))),
                    TripFilter.ACTIVE,
                    today,
                )
                .size,
        )
    }

    @Test
    fun staleUnstartedPickupIsNotPresentedAsActive() {
        assertTrue(
            DriverTripPolicy.filtered(
                    listOf(trip(date = today.minusDays(1))),
                    TripFilter.ACTIVE,
                    today,
                )
                .isEmpty()
        )
    }

    @Test
    fun scheduleOrderIsPreservedWithoutNearestFirst() {
        val first = trip().copy(id = "a", time = "14:00:00", lat = 50.0)
        val second = trip().copy(id = "b", time = "16:00:00", lat = 0.0)
        assertEquals("a", DriverTripPolicy.next(listOf(second, first), today)?.id)
    }

    @Test
    fun inServiceIsNotAStartableJourney() {
        assertFalse(trip("service_active").actionable)
    }

    @Test
    fun validSnapshotIsParsed() {
        assertEquals("pickup_pending", DriverTripPolicy.parse(snapshot()).stage)
    }

    @Test(expected = IllegalArgumentException::class)
    fun mismatchedServerLegIsRejected() {
        DriverTripPolicy.parse(snapshot().put("leg", "collection"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun negativeRevisionIsRejected() {
        DriverTripPolicy.parse(snapshot().put("revision", -1))
    }

    @Test(expected = IllegalArgumentException::class)
    fun fractionalRevisionIsRejected() {
        DriverTripPolicy.parse(snapshot().put("revision", 1.5))
    }

    @Test(expected = IllegalArgumentException::class)
    fun unknownServerStageIsRejected() {
        DriverTripPolicy.parse(snapshot().put("stage", "anything_enroute"))
    }

    @Test
    fun sameOriginBranchQrIsRecognized() {
        assertEquals(
            "TEST_CODE_1234",
            NativeQrPolicy.publicCode(
                "https://review.example.test/scan/TEST_CODE_1234",
                "https://review.example.test:443",
            ),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun otherOriginQrIsRejected() {
        NativeQrPolicy.publicCode(
            "https://other.example.test/scan/TEST_CODE_1234",
            "https://review.example.test",
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun activationQrCannotBecomeAttendanceScan() {
        NativeQrPolicy.publicCode(
            "https://review.example.test/scan/activate/TEST_TOKEN_1234",
            "https://review.example.test",
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun qrWithQueryCannotOverrideOperation() {
        NativeQrPolicy.publicCode(
            "https://review.example.test/scan/TEST_CODE_1234?staff=other",
            "https://review.example.test",
        )
    }

    @Test
    fun ssrCookieMatchesInstalledWireFormat() {
        val json = "{\"access_token\":\"SYNTHETIC\",\"user\":{\"name\":\"ç”¨æˆ·\"}}"
        val cookie = NativeSsrSession.cookies("sb-test-auth-token", json)
        val decoded =
            String(Base64.getUrlDecoder().decode(cookie.substringAfter("base64-")), Charsets.UTF_8)
        assertEquals(json, decoded)
    }

    @Test
    fun longSsrSessionIsChunkedWithoutLosingBytes() {
        val json = JSONObject().put("test", "x".repeat(8000)).toString()
        val parts = NativeSsrSession.cookies("sb-test-auth-token", json).split("; ")
        assertTrue(parts.size > 1)
        assertTrue(parts.all { it.substringAfter('=').length <= 3180 })
        val value = parts.joinToString("") { it.substringAfter('=') }.removePrefix("base64-")
        assertEquals(json, String(Base64.getUrlDecoder().decode(value), Charsets.UTF_8))
    }

    @Test(expected = IllegalArgumentException::class)
    fun cookieNameCannotInjectHeaders() {
        NativeSsrSession.cookies("sb-bad\r\nname-auth-token", "{}")
    }

    @Test
    fun noTargetIsInert() {
        assertFalse(
            NativeTargetPolicy.allowed(
                "UNCONFIGURED",
                "https://review.example.test",
                "https://testproject.supabase.co",
                "sb_publishable_" + "x".repeat(40),
            )
        )
    }

    @Test
    fun onlyExplicitTestPublicConfigurationIsAccepted() {
        assertTrue(
            NativeTargetPolicy.allowed(
                "TEST",
                "https://review.example.test",
                "https://testproject.supabase.co",
                "sb_publishable_" + "x".repeat(40),
            )
        )
    }

    @Test
    fun knownProductionOriginIsRejected() {
        assertFalse(
            NativeTargetPolicy.allowed(
                "TEST",
                "https://WWW.CRADLEWELLNESSLIVING.COM",
                "https://testproject.supabase.co",
                "sb_publishable_" + "x".repeat(40),
            )
        )
    }

    @Test
    fun privilegedKeyIsRejected() {
        assertFalse(NativeTargetPolicy.publicKey("sb_secret_" + "x".repeat(50)))
    }

    private fun legacyBooking(): JSONObject =
        JSONObject()
            .put("id", "11111111-1111-4111-8111-111111111111")
            .put("driver_id", "22222222-2222-4222-8222-222222222222")
            .put("branch_id", "33333333-3333-4333-8333-333333333333")
            .put("delivery_type", "home_service")
            .put("status", "confirmed")
            .put("booking_date", "2026-11-17")
            .put("start_time", "14:00:00")
            .put("booking_progress_status", "not_started")
            .put(
                "metadata",
                JSONObject()
                    .put(
                        "home_service_address",
                        JSONObject()
                            .put("full_address", "SYNTHETIC TEST ADDRESS")
                            .put("lat", 10.6)
                            .put("lng", 122.9),
                    ),
            )

    private fun legacy(row: JSONObject) =
        DriverTripPolicy.parseLegacy(
            row,
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
        )

    @Test
    fun legacyCompatibilityNeverDowngradesDeniedOrFailedAuthority() {
        assertTrue(NativeDriverCompatibility.legacyRead(404, ""))
        assertTrue(NativeDriverCompatibility.legacyRead(503, "journeys_inactive"))
        for (status in listOf(200, 401, 403, 409, 500, 503)) assertFalse(
            NativeDriverCompatibility.legacyRead(status, "other")
        )
    }

    @Test
    fun deployedBookingProjectsDeliveryWithoutInventingPickupOrCollection() {
        val trip = legacy(legacyBooking())
        assertEquals("delivery_pending", trip.stage)
        assertEquals("delivery", trip.leg)
        assertEquals(
            "delivery_enroute",
            legacy(legacyBooking().put("booking_progress_status", "travel_started")).stage,
        )
        assertEquals(
            "service_active",
            legacy(legacyBooking().put("booking_progress_status", "session_started")).stage,
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun legacyRejectsAnotherDriver() {
        legacy(legacyBooking().put("driver_id", "44444444-4444-4444-8444-444444444444"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun legacyRejectsAnotherBranch() {
        legacy(legacyBooking().put("branch_id", "44444444-4444-4444-8444-444444444444"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun legacyRejectsCancelledBooking() {
        legacy(legacyBooking().put("status", "cancelled"))
    }

    @Test
    fun legacyMissingCoordinatesRequiresReview() {
        assertEquals("review", legacy(legacyBooking().put("metadata", JSONObject())).stage)
    }

    @Test
    fun productionRequiresOwnerPhoneAndExactHostPair() {
        val key = "sb_publishable_" + "x".repeat(40)
        val api = "https://www.cradlewellnessliving.com"
        val db = "https://lsrbwqhvzjfpiabeolkv.supabase.co"
        assertFalse(NativeTargetPolicy.allowed("PRODUCTION", api, db, key))
        assertTrue(NativeTargetPolicy.allowed("PRODUCTION", api, db, key, true))
        assertFalse(
            NativeTargetPolicy.allowed("PRODUCTION", "https://other.example.com", db, key, true)
        )
        assertFalse(NativeTargetPolicy.allowed("TEST", api, db, key, true))
    }
}
