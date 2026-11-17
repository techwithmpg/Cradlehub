package com.mpgtechnologies.cradlehub.driver

/** Synthetic O3 presentation evidence only. No network/operational writer consumes these plans. */
internal object NativeTripsFixture {
    fun plans(w: DriverWorkspace): List<TripsJourney> {
        val now = w.verifiedAt
        val first = w.trips.first { it.id.startsWith("11111111") }
        val pooled = w.trips.first { it.id.startsWith("33333333") }
        val collect = w.trips.first { it.id.startsWith("22222222") }
        val future = w.trips.first { it.id.startsWith("77777777") }
        val driver = w.profile.id
        val a = TripsPassenger("fixture-a", "Therapist A · TEST")
        val b = TripsPassenger("fixture-b", "Lina · TEST", boarded = true)
        val c = TripsPassenger("fixture-c", "Nura · TEST", boarded = true)
        val pickup =
            TripsStop(
                "branch-a",
                first.id,
                StopRole.BRANCH_PICKUP,
                "Main Branch",
                setOf(a.id),
                StopProgress.ENROUTE,
                10.676,
                122.956,
            )
        val dropA =
            TripsStop(
                "customer-a",
                first.id,
                StopRole.CUSTOMER_DROP,
                "Customer · Talisay",
                setOf(a.id),
                lat = 10.74,
                lng = 122.97,
            )
        val dropB =
            TripsStop(
                "customer-b",
                pooled.id,
                StopRole.CUSTOMER_DROP,
                "Customer · Bacolod",
                setOf(b.id),
                StopProgress.ENROUTE,
                pooled.lat,
                pooled.lng,
            )
        val dropC =
            TripsStop(
                "customer-c",
                pooled.id,
                StopRole.CUSTOMER_DROP,
                "Customer · Alijis",
                setOf(c.id),
                lat = 10.62,
                lng = 122.95,
            )
        val collection =
            TripsStop(
                "collection-a",
                collect.id,
                StopRole.THERAPIST_COLLECTION,
                "Customer · Talisay",
                setOf(a.id),
                lat = collect.lat,
                lng = collect.lng,
            )
        val collectionB =
            TripsStop(
                "collection-b",
                future.id,
                StopRole.THERAPIST_COLLECTION,
                "Customer · Bacolod",
                setOf(b.id),
                lat = future.lat,
                lng = future.lng,
            )
        fun eta(stop: TripsStop, leg: String, seconds: Int, meters: Int, prefix: List<TripsStop>) =
            TripsRoadEta(
                stop.bookingId,
                leg,
                stop.lat!!,
                stop.lng!!,
                seconds,
                meters,
                now,
                now,
                8.0,
                stop.id,
                prefix.map { it.id },
            )
        return listOf(
            TripsJourney(
                "fixture-drop-a",
                driver,
                TripsMode.DROP_OFF,
                "Today, 10:30 AM",
                "Main Branch",
                "Customer · Talisay",
                listOf(a),
                listOf(pickup, dropA),
                "pickup_enroute",
                true,
                eta(dropA, "delivery", 720, 8400, listOf(pickup, dropA)),
            ),
            TripsJourney(
                "fixture-drop-pool",
                driver,
                TripsMode.DROP_OFF,
                "Today, 11:15 AM",
                "Main Branch",
                "2 customer stops",
                listOf(b, c),
                listOf(dropB, dropC),
                "delivery_enroute",
                true,
                eta(dropB, "delivery", 1080, 11700, listOf(dropB)),
            ),
            TripsJourney(
                "fixture-pick-ready",
                driver,
                TripsMode.PICK_UP,
                "Today, 2:00 PM",
                "Customer · Talisay",
                "Main Branch",
                listOf(
                    a.copy(
                        service = ServiceReadiness.COMPLETED,
                        collection = CollectionNeed.REQUIRED,
                    )
                ),
                listOf(collection),
                "collection_pending",
                true,
                eta(collection, "collection", 540, 5600, listOf(collection)),
            ),
            TripsJourney(
                "fixture-pick-wait",
                driver,
                TripsMode.PICK_UP,
                "Today, 2:45 PM",
                "Customer · Bacolod",
                "Next authorized stop",
                listOf(
                    b.copy(
                        service = ServiceReadiness.IN_PROGRESS,
                        estimatedCompletion = now.plusSeconds(1680),
                        collection = CollectionNeed.REQUIRED,
                        boarded = false,
                    )
                ),
                listOf(collectionB),
                "service_active",
                true,
                eta(collectionB, "collection", 1440, 14900, listOf(collectionB)),
            ),
        )
    }
}
