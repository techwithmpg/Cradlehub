package com.mpgtechnologies.cradlehub.driver

import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class O4TripPlansParserTest {
    @Test
    fun parsesPooledDropOffAndSplitPickUpPlansFromBackendJson() {
        val booking1 = "50000000-0000-4000-8000-000000000001"
        val booking2 = "50000000-0000-4000-8000-000000000002"
        val driverId = "30000000-0000-4000-8000-000000000002"
        val dueAt = "2026-11-17T03:00:00Z"

        val dropJson =
            JSONObject()
                .put("id", "DROP_OFF:60000000-0000-4000-8000-000000000001")
                .put("driverId", driverId)
                .put("mode", "DROP_OFF")
                .put("scheduled", "2026-11-17 10:00")
                .put("origin", "Bacolod Main")
                .put("destination", "Bata, Bacolod")
                .put("stage", "pickup_pending")
                .put("routeAuthorized", true)
                .put(
                    "passengers",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("id", "t1")
                                .put("name", "Therapist One")
                                .put("service", "UNKNOWN")
                                .put("collection", "REQUIRED")
                                .put("boarded", false)
                                .put("dropped", false)
                        )
                        .put(
                            JSONObject()
                                .put("id", "t2")
                                .put("name", "Therapist Two")
                                .put("service", "UNKNOWN")
                                .put("collection", "NOT_REQUIRED")
                                .put("boarded", false)
                                .put("dropped", false)
                        )
                )
                .put(
                    "stops",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("id", "$booking1:pickup")
                                .put("bookingId", booking1)
                                .put("role", "BRANCH_PICKUP")
                                .put("label", "Bacolod Main")
                                .put("passengers", JSONArray().put("t1").put("t2"))
                                .put("progress", "PENDING")
                                .put("lat", 10.6765)
                                .put("lng", 122.9509)
                        )
                        .put(
                            JSONObject()
                                .put("id", "$booking1:delivery")
                                .put("bookingId", booking1)
                                .put("role", "CUSTOMER_DROP")
                                .put("label", "Mandalagan")
                                .put("passengers", JSONArray().put("t1"))
                                .put("progress", "PENDING")
                                .put("lat", 10.6800)
                                .put("lng", 122.9550)
                        )
                        .put(
                            JSONObject()
                                .put("id", "$booking2:delivery")
                                .put("bookingId", booking2)
                                .put("role", "CUSTOMER_DROP")
                                .put("label", "Bata")
                                .put("passengers", JSONArray().put("t2"))
                                .put("progress", "PENDING")
                                .put("lat", 10.6850)
                                .put("lng", 122.9600)
                        )
                )

        val pickJson =
            JSONObject()
                .put("id", "PICK_UP:$booking1")
                .put("driverId", driverId)
                .put("mode", "PICK_UP")
                .put("scheduled", "2026-11-17 10:00")
                .put("origin", "Mandalagan")
                .put("destination", "Bacolod Main")
                .put("stage", "service_active")
                .put("routeAuthorized", false)
                .put(
                    "passengers",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("id", "t1")
                                .put("name", "Therapist One")
                                .put("service", "IN_PROGRESS")
                                .put("estimatedCompletion", dueAt)
                                .put("collection", "REQUIRED")
                                .put("boarded", false)
                                .put("dropped", false)
                        )
                )
                .put(
                    "stops",
                    JSONArray()
                        .put(
                            JSONObject()
                                .put("id", "$booking1:collection")
                                .put("bookingId", booking1)
                                .put("role", "THERAPIST_COLLECTION")
                                .put("label", "Mandalagan")
                                .put("passengers", JSONArray().put("t1"))
                                .put("progress", "PENDING")
                                .put("lat", 10.6800)
                                .put("lng", 122.9550)
                        )
                )

        val plans = NativeTripsPolicy.parseTripPlans(JSONArray().put(dropJson).put(pickJson))!!
        assertEquals(2, plans.size)

        val drop = plans[0]
        assertEquals(TripsMode.DROP_OFF, drop.mode)
        assertEquals(2, drop.passengers.size)
        assertEquals(3, drop.stops.size)
        assertEquals(StopRole.BRANCH_PICKUP, drop.stops[0].role)
        assertEquals(CollectionNeed.NOT_REQUIRED, drop.passengers[1].collection)
        assertNotNull(NativeTripsPolicy.route(drop, driverId))

        val pick = plans[1]
        assertEquals(TripsMode.PICK_UP, pick.mode)
        assertEquals(ServiceReadiness.IN_PROGRESS, pick.passengers[0].service)
        assertEquals(Instant.parse(dueAt), pick.passengers[0].estimatedCompletion)
        assertNull(NativeTripsPolicy.route(pick, driverId))
        assertTrue(
            NativeTripsPolicy.banner(pick, Instant.parse("2026-11-17T02:45:00Z"))
                .contains("15 min")
        )
    }

    @Test
    fun nullTripPlansFallsBackCleanly() {
        assertNull(NativeTripsPolicy.parseTripPlans(null))
    }
}
