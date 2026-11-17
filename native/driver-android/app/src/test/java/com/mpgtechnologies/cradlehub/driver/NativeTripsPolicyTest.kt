package com.mpgtechnologies.cradlehub.driver

import java.time.*
import org.junit.Assert.*
import org.junit.Test

class NativeTripsPolicyTest {
    private val now = Instant.parse("2026-11-17T02:00:00Z")
    private val booking = "11111111-1111-4111-8111-111111111111"
    private val other = "22222222-2222-4222-8222-222222222222"
    private val passenger = TripsPassenger("a", "Therapist A", collection = CollectionNeed.REQUIRED)
    private val branch =
        TripsStop(
            "branch",
            booking,
            StopRole.BRANCH_PICKUP,
            "Branch",
            setOf("a"),
            lat = 10.0,
            lng = 122.0,
        )
    private val customer =
        TripsStop(
            "customer",
            booking,
            StopRole.CUSTOMER_DROP,
            "Customer",
            setOf("a"),
            lat = 10.1,
            lng = 122.1,
        )
    private val collect = customer.copy(id = "collection", role = StopRole.THERAPIST_COLLECTION)

    private fun journey(mode: TripsMode = TripsMode.DROP_OFF) =
        TripsJourney(
            "journey",
            "driver-a",
            mode,
            "Today, 10:30 AM",
            "Branch",
            "Customer",
            listOf(passenger),
            if (mode == TripsMode.DROP_OFF) listOf(branch, customer) else listOf(collect),
            if (mode == TripsMode.DROP_OFF) "pickup_pending" else "collection_pending",
            true,
        )

    private fun eta(stop: TripsStop = customer, leg: String = "delivery") =
        TripsRoadEta(
            booking,
            leg,
            stop.lat!!,
            stop.lng!!,
            720,
            8400,
            now,
            now,
            10.0,
        )

    @Test
    fun modesCountOnlyAssignedJourneys() {
        val rows =
            listOf(
                journey(),
                journey(TripsMode.PICK_UP).copy(id = "collection"),
                journey().copy(id = "other", driverId = "driver-b"),
            )
        assertEquals(1, NativeTripsPolicy.visible(rows, "driver-a", TripsMode.DROP_OFF).size)
        assertEquals(1, NativeTripsPolicy.visible(rows, "driver-a", TripsMode.PICK_UP).size)
        assertEquals(
            listOf("journey"),
            NativeTripsPolicy.visible(rows, "driver-a", TripsMode.DROP_OFF).map { it.id },
        )
    }

    @Test
    fun poolIsOneVehicleAndUnrelatedBookingsNeverMerge() {
        val pool = journey().copy(passengers = listOf(passenger, passenger.copy(id = "b")))
        assertEquals(
            1,
            NativeTripsPolicy.visible(listOf(pool), "driver-a", TripsMode.DROP_OFF).size,
        )
        assertEquals(
            2,
            NativeTripsPolicy.visible(
                    listOf(pool, pool.copy(id = "second-vehicle")),
                    "driver-a",
                    TripsMode.DROP_OFF,
                )
                .size,
        )
    }

    @Test
    fun independentDepartureAndUndecidedNeverInventCollection() {
        for (need in listOf(CollectionNeed.NOT_REQUIRED, CollectionNeed.UNDECIDED)) {
            val row =
                journey(TripsMode.PICK_UP)
                    .copy(passengers = listOf(passenger.copy(collection = need)))
            assertTrue(
                NativeTripsPolicy.visible(listOf(row), "driver-a", TripsMode.PICK_UP).isEmpty()
            )
            assertNull(NativeTripsPolicy.route(row, "driver-a"))
        }
    }

    @Test
    fun splitDriversUseCollectionAssignmentOwner() {
        val drop = journey()
        val pick = journey(TripsMode.PICK_UP).copy(driverId = "driver-b")
        assertEquals(
            0,
            NativeTripsPolicy.visible(listOf(drop, pick), "driver-a", TripsMode.PICK_UP).size,
        )
        assertEquals(
            1,
            NativeTripsPolicy.visible(listOf(drop, pick), "driver-b", TripsMode.PICK_UP).size,
        )
        assertNull(NativeTripsPolicy.route(pick, "driver-a"))
        assertNotNull(NativeTripsPolicy.route(pick, "driver-b"))
    }

    @Test
    fun branchOnlyEtaIsNotTimeToDrop() {
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(journey(), eta(branch, "pickup"), now).time,
        )
        assertEquals("ETA unavailable", NativeTripsPolicy.eta(journey(), eta(customer), now).time)
    }

    @Test
    fun fullDropIncludesRequiredBranchPrefix() {
        val full =
            eta().copy(targetStopId = customer.id, coveredStops = listOf(branch.id, customer.id))
        assertEquals("12 min", NativeTripsPolicy.eta(journey(), full, now).time)
        assertEquals("8.4 km", NativeTripsPolicy.eta(journey(), full, now).distance)
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(journey(), full.copy(coveredStops = listOf(customer.id)), now)
                .time,
        )
    }

    @Test
    fun alreadyCollectedDropUsesActualCustomerLeg() {
        assertEquals(
            "12 min",
            NativeTripsPolicy.eta(
                    journey()
                        .copy(
                            stops = listOf(customer),
                            passengers = listOf(passenger.copy(boarded = true)),
                        ),
                    eta(),
                    now,
                )
                .time,
        )
    }

    @Test
    fun pickupEtaTargetsTherapistNotReturnBranch() {
        val row = journey(TripsMode.PICK_UP)
        assertEquals("12 min", NativeTripsPolicy.eta(row, eta(collect, "collection"), now).time)
        assertEquals("ETA unavailable", NativeTripsPolicy.eta(row, eta(branch, "return"), now).time)
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(
                    row.copy(stops = listOf(branch.copy(role = StopRole.DESTINATION))),
                    eta(branch, "return"),
                    now,
                )
                .time,
        )
    }

    @Test
    fun wrongBookingOrCoordinatesNeverBorrowEta() {
        val row =
            journey()
                .copy(stops = listOf(customer), passengers = listOf(passenger.copy(boarded = true)))
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(row, eta().copy(bookingId = other), now).time,
        )
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(row, eta().copy(lat = 11.0), now).time,
        )
    }

    @Test
    fun staleInaccurateAndFutureGpsAreExplicit() {
        val row =
            journey()
                .copy(stops = listOf(customer), passengers = listOf(passenger.copy(boarded = true)))
        listOf(
                eta().copy(gpsAt = now.minusSeconds(31)),
                eta().copy(gpsAt = now.plusSeconds(2)),
                eta().copy(accuracyMeters = 51.0),
                eta().copy(accuracyMeters = Double.NaN),
            )
            .forEach {
                assertEquals("GPS stale or inaccurate", NativeTripsPolicy.eta(row, it, now).reason)
            }
    }

    @Test
    fun expiredRouteAndNoEstimateDoNotInventNumbers() {
        val row =
            journey()
                .copy(stops = listOf(customer), passengers = listOf(passenger.copy(boarded = true)))
        assertEquals(
            "Route estimate expired",
            NativeTripsPolicy.eta(row, eta().copy(calculatedAt = now.minusSeconds(61)), now).reason,
        )
        assertEquals("ETA unavailable", NativeTripsPolicy.eta(row, null, now).time)
    }

    @Test
    fun serviceCountdownIsSeparateFromRoadTravel() {
        val row =
            journey(TripsMode.PICK_UP)
                .copy(
                    passengers =
                        listOf(
                            passenger.copy(
                                service = ServiceReadiness.IN_PROGRESS,
                                estimatedCompletion = now.plusSeconds(1680),
                            )
                        )
                )
        assertEquals(
            "Service in progress · Est. completion in 28 min",
            NativeTripsPolicy.banner(row, now),
        )
        assertEquals(
            "24 min",
            NativeTripsPolicy.eta(row, eta(collect, "collection").copy(seconds = 1440), now).time,
        )
        assertNull(NativeTripsPolicy.route(row, "driver-a"))
    }

    @Test
    fun zeroAndLateTimerDoNotDeclareReady() {
        for (end in listOf(now, now.minusSeconds(3600))) {
            val row =
                journey(TripsMode.PICK_UP)
                    .copy(
                        passengers =
                            listOf(
                                passenger.copy(
                                    service = ServiceReadiness.IN_PROGRESS,
                                    estimatedCompletion = end,
                                )
                            )
                    )
            assertFalse(NativeTripsPolicy.banner(row, now).contains("Ready for pickup"))
            assertNull(NativeTripsPolicy.route(row, "driver-a"))
        }
    }

    @Test
    fun authoritativeCompletionEnablesAssignedCollection() {
        val row =
            journey(TripsMode.PICK_UP)
                .copy(passengers = listOf(passenger.copy(service = ServiceReadiness.COMPLETED)))
        assertEquals("Service completed · Ready for pickup", NativeTripsPolicy.banner(row, now))
        assertEquals(collect, NativeTripsPolicy.route(row, "driver-a"))
        assertNull(NativeTripsPolicy.route(row.copy(routeAuthorized = false), "driver-a"))
    }

    @Test
    fun unknownReadinessIsNotFalselyLabeledReady() {
        assertEquals(
            "Collection assigned · Service readiness unavailable",
            NativeTripsPolicy.banner(journey(TripsMode.PICK_UP), now),
        )
    }

    @Test
    fun approvedStopOrderDeterminesCorrectBooking() {
        val second = customer.copy(id = "second-customer", bookingId = other)
        var row = journey().copy(stops = listOf(branch, customer, second))
        assertEquals(branch, NativeTripsPolicy.route(row, "driver-a"))
        row =
            row.copy(
                stops = listOf(branch.copy(progress = StopProgress.CONFIRMED), customer, second)
            )
        assertEquals(customer, NativeTripsPolicy.route(row, "driver-a"))
        row =
            row.copy(
                stops =
                    listOf(
                        branch.copy(progress = StopProgress.CONFIRMED),
                        customer.copy(progress = StopProgress.CONFIRMED),
                        second,
                    )
            )
        assertEquals(other, NativeTripsPolicy.route(row, "driver-a")!!.bookingId)
    }

    @Test
    fun etaForNextCustomerDoesNotClaimAllPassengersDelivered() {
        val b = passenger.copy(id = "b", boarded = true)
        val second =
            customer.copy(id = "second", bookingId = other, passengers = setOf("b"), lat = 10.2)
        val row =
            journey()
                .copy(
                    passengers = listOf(passenger.copy(boarded = true), b),
                    stops = listOf(customer, second),
                )
        assertEquals("12 min", NativeTripsPolicy.eta(row, eta(), now).time)
        assertEquals(
            "ETA unavailable",
            NativeTripsPolicy.eta(row, eta(second).copy(bookingId = other), now).time,
        )
        assertFalse(NativeTripsPolicy.steps(row).last().done)
    }

    @Test
    fun readinessIsEvaluatedAtRelevantCollectionStop() {
        val completed = passenger.copy(service = ServiceReadiness.COMPLETED)
        val b = passenger.copy(id = "b", service = ServiceReadiness.IN_PROGRESS)
        val second = collect.copy(id = "second", bookingId = other, passengers = setOf("b"))
        val row =
            journey(TripsMode.PICK_UP)
                .copy(passengers = listOf(completed, b), stops = listOf(collect, second))
        assertNotNull(NativeTripsPolicy.route(row, "driver-a"))
        assertEquals("Service completed · Ready for pickup", NativeTripsPolicy.banner(row, now))
        assertNull(
            NativeTripsPolicy.route(
                row.copy(stops = listOf(collect.copy(progress = StopProgress.CONFIRMED), second)),
                "driver-a",
            )
        )
    }

    @Test
    fun vehicleArrivalIsNotBoardingOrDropoff() {
        val row =
            journey()
                .copy(
                    stage = "pickup_arrived",
                    stops = listOf(branch.copy(progress = StopProgress.ARRIVED), customer),
                )
        assertFalse(NativeTripsPolicy.steps(row).first { it.title == "Onboard" }.done)
        val arrived =
            row.copy(
                stage = "customer_arrived",
                stops = listOf(customer.copy(progress = StopProgress.ARRIVED)),
            )
        assertFalse(NativeTripsPolicy.steps(arrived).last().done)
        assertTrue(NativeTripsPolicy.banner(arrived, now).contains("not confirmed"))
    }

    @Test
    fun legacyDeliveryPendingDoesNotProveBoardingOrCreateCollection() {
        val trip =
            DriverTrip(
                booking,
                0,
                "delivery_pending",
                "delivery",
                "Customer",
                "Therapist",
                LocalDate.of(2026, 11, 17),
                "10:30",
                "Branch",
                "Customer",
                10.1,
                122.1,
                legacy = true,
            )
        val w =
            DriverWorkspace(
                DriverProfile("driver-a", "Driver", "branch", "Branch"),
                listOf(trip),
                "On duty",
                emptyList(),
                emptyList(),
                now,
                LocalDate.of(2026, 11, 17),
            )
        val rows = NativeTripsPolicy.fromWorkspace(w)
        assertFalse(rows.single().passengers.single().boarded)
        assertTrue(NativeTripsPolicy.visible(rows, "driver-a", TripsMode.PICK_UP).isEmpty())
        assertEquals("ETA unavailable", NativeTripsPolicy.eta(rows.single(), null, now).time)
    }

    @Test
    fun invalidTargetAndReadOnlyAssignmentNeverOpenRoute() {
        assertNull(
            NativeTripsPolicy.route(
                journey().copy(stops = listOf(branch.copy(lat = null))),
                "driver-a",
            )
        )
        assertNull(NativeTripsPolicy.route(journey().copy(routeAuthorized = false), "driver-a"))
    }

    @Test
    fun modeCannotRouteOppositeTransportLegOrUnknownPassengers() {
        assertNull(NativeTripsPolicy.route(journey().copy(stops = listOf(collect)), "driver-a"))
        assertNull(
            NativeTripsPolicy.route(
                journey(TripsMode.PICK_UP).copy(stops = listOf(customer)),
                "driver-a",
            )
        )
        assertNull(
            NativeTripsPolicy.route(
                journey().copy(stops = listOf(branch.copy(passengers = setOf("unknown")))),
                "driver-a",
            )
        )
    }

    @Test
    fun missingParticipantDeadlineDoesNotPredictAllReady() {
        val row =
            journey(TripsMode.PICK_UP)
                .copy(
                    passengers =
                        listOf(
                            passenger.copy(
                                service = ServiceReadiness.IN_PROGRESS,
                                estimatedCompletion = now.plusSeconds(60),
                            ),
                            passenger.copy(id = "b", service = ServiceReadiness.IN_PROGRESS),
                        ),
                    stops = listOf(collect.copy(passengers = setOf("a", "b"))),
                )
        assertEquals(
            "Service in progress · Awaiting Complete Service",
            NativeTripsPolicy.banner(row, now),
        )
    }

    @Test
    fun unknownBoardingCannotOmitRequiredBranchTravelFromDropEta() {
        val row = journey().copy(stops = listOf(customer))
        assertEquals("ETA unavailable", NativeTripsPolicy.eta(row, eta(), now).time)
        assertEquals(
            "12 min",
            NativeTripsPolicy.eta(
                    row.copy(passengers = listOf(passenger.copy(boarded = true))),
                    eta(),
                    now,
                )
                .time,
        )
    }
}
