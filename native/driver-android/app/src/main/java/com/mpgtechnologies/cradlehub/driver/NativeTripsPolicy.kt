package com.mpgtechnologies.cradlehub.driver

import java.time.Duration
import java.time.Instant
import java.util.Locale
import kotlin.math.ceil

internal enum class TripsMode(val title: String, val badge: String) {
    DROP_OFF("Drop-off", "DROP-OFF"),
    PICK_UP("Pick-up", "PICK-UP"),
}

internal enum class CollectionNeed {
    REQUIRED,
    NOT_REQUIRED,
    UNDECIDED,
}

internal enum class ServiceReadiness {
    UNKNOWN,
    IN_PROGRESS,
    COMPLETED,
}

internal enum class StopRole {
    BRANCH_PICKUP,
    CUSTOMER_DROP,
    THERAPIST_COLLECTION,
    DESTINATION,
}

internal enum class StopProgress {
    PENDING,
    ENROUTE,
    ARRIVED,
    CONFIRMED,
}

/** Presentation contract only. These values never grant server transport authority. */
internal data class TripsPassenger(
    val id: String,
    val name: String,
    val service: ServiceReadiness = ServiceReadiness.UNKNOWN,
    val estimatedCompletion: Instant? = null,
    val collection: CollectionNeed = CollectionNeed.UNDECIDED,
    val boarded: Boolean = false,
    val dropped: Boolean = false,
)

internal data class TripsStop(
    val id: String,
    val bookingId: String,
    val role: StopRole,
    val label: String,
    val passengers: Set<String>,
    val progress: StopProgress = StopProgress.PENDING,
    val lat: Double? = null,
    val lng: Double? = null,
)

internal data class TripsJourney(
    val id: String,
    val driverId: String,
    val mode: TripsMode,
    val scheduled: String,
    val origin: String,
    val destination: String,
    val passengers: List<TripsPassenger>,
    val stops: List<TripsStop>,
    val stage: String,
    val routeAuthorized: Boolean,
    val fixtureEta: TripsRoadEta? = null,
)

/**
 * SDK road-route result, tied to one booking/leg/coordinate target and a measured GPS fix.
 * coveredStops is an ordered prefix ending at targetStopId; it is never inferred from distance.
 */
internal data class TripsRoadEta(
    val bookingId: String,
    val leg: String,
    val lat: Double,
    val lng: Double,
    val seconds: Int,
    val meters: Int,
    val calculatedAt: Instant,
    val gpsAt: Instant,
    val accuracyMeters: Double,
    val targetStopId: String? = null,
    val coveredStops: List<String> = emptyList(),
)

internal data class TripsEtaText(val time: String, val distance: String?, val reason: String?)

internal data class TripsStep(val title: String, val done: Boolean, val current: Boolean)

internal object NativeTripsPolicy {
    fun nextStop(journey: TripsJourney): TripsStop? =
        journey.stops.firstOrNull { it.progress != StopProgress.CONFIRMED }

    fun visible(journeys: List<TripsJourney>, driver: String, mode: TripsMode): List<TripsJourney> =
        journeys
            .filter { journey ->
                journey.driverId == driver &&
                    journey.mode == mode &&
                    journey.passengers.isNotEmpty() &&
                    journey.stage != "complete" &&
                    (mode == TripsMode.DROP_OFF ||
                        journey.passengers.any { it.collection == CollectionNeed.REQUIRED })
            }
            .distinctBy { it.id }

    fun route(journey: TripsJourney, driver: String): TripsStop? {
        if (journey.driverId != driver || !journey.routeAuthorized) return null
        val stop = nextStop(journey) ?: return null
        val permittedRoles =
            if (journey.mode == TripsMode.DROP_OFF)
                setOf(StopRole.BRANCH_PICKUP, StopRole.CUSTOMER_DROP)
            else setOf(StopRole.THERAPIST_COLLECTION, StopRole.DESTINATION)
        if (
            stop.role !in permittedRoles ||
                stop.passengers.isEmpty() ||
                !journey.passengers.map { it.id }.containsAll(stop.passengers)
        )
            return null
        if (
            !DriverTripPolicy.validId(stop.bookingId) ||
                stop.lat == null ||
                stop.lng == null ||
                !stop.lat.isFinite() ||
                !stop.lng.isFinite() ||
                stop.lat !in -90.0..90.0 ||
                stop.lng !in -180.0..180.0
        )
            return null
        if (journey.mode == TripsMode.PICK_UP && stop.role == StopRole.THERAPIST_COLLECTION) {
            val relevant = journey.passengers.filter { it.id in stop.passengers }
            if (
                relevant.isEmpty() ||
                    relevant.any {
                        it.collection != CollectionNeed.REQUIRED ||
                            it.service == ServiceReadiness.IN_PROGRESS
                    }
            )
                return null
        }
        return stop
    }

    fun banner(journey: TripsJourney, now: Instant): String {
        val stop = nextStop(journey)
        if (journey.mode == TripsMode.DROP_OFF)
            return when {
                journey.stage == "service_active" -> "Service in progress"
                journey.stage == "customer_arrived" ->
                    "Vehicle arrived · Passenger drop-off not confirmed here"
                stop == null -> "Drop-off confirmed"
                stop.progress == StopProgress.ARRIVED ->
                    "Vehicle arrived · Confirm passenger action in Map"
                stop.role == StopRole.BRANCH_PICKUP -> "Next: Pick up therapist at ${stop.label}"
                stop.role == StopRole.CUSTOMER_DROP -> "Next: Deliver to ${stop.label}"
                else -> "Dispatch review required"
            }
        val relevant = journey.passengers.filter { it.id in (stop?.passengers ?: emptySet()) }
        if (stop?.role == StopRole.DESTINATION)
            return "Therapist onboard · Continue to authorized destination"
        if (relevant.isNotEmpty() && relevant.all { it.service == ServiceReadiness.COMPLETED })
            return "Service completed · Ready for pickup"
        val active = relevant.filter { it.service == ServiceReadiness.IN_PROGRESS }
        if (active.isNotEmpty()) {
            val completion =
                if (active.all { it.estimatedCompletion != null })
                    active.mapNotNull { it.estimatedCompletion }.maxOrNull()
                else null
            val minutes = completion?.let { ceil(Duration.between(now, it).seconds / 60.0).toInt() }
            return if (minutes != null && minutes > 0)
                "Service in progress · Est. completion in $minutes min"
            else "Service in progress · Awaiting Complete Service"
        }
        return "Collection assigned · Service readiness unavailable"
    }

    fun eta(journey: TripsJourney, sdk: TripsRoadEta?, now: Instant): TripsEtaText {
        val unavailable = TripsEtaText("ETA unavailable", null, null)
        val remaining = journey.stops.filter { it.progress != StopProgress.CONFIRMED }
        val target =
            if (journey.mode == TripsMode.DROP_OFF)
                remaining.firstOrNull { it.role == StopRole.CUSTOMER_DROP }
            else remaining.firstOrNull { it.role == StopRole.THERAPIST_COLLECTION }
        target ?: return unavailable
        val estimate = sdk ?: return unavailable
        val gpsAge = Duration.between(estimate.gpsAt, now).seconds
        if (
            gpsAge !in 0..30 ||
                !estimate.accuracyMeters.isFinite() ||
                estimate.accuracyMeters !in 0.01..50.0
        )
            return unavailable.copy(reason = "GPS stale or inaccurate")
        if (
            Duration.between(estimate.calculatedAt, now).seconds !in 0..60 ||
                estimate.seconds < 0 ||
                estimate.meters < 0
        )
            return unavailable.copy(reason = "Route estimate expired")
        // A branch-only SDK leg can never masquerade as the full customer drop-off estimate.
        val prefix = remaining.takeWhile { it.id != target.id } + target
        if (
            estimate.bookingId != target.bookingId ||
                estimate.leg !=
                    (if (journey.mode == TripsMode.DROP_OFF) "delivery" else "collection")
        )
            return unavailable
        val fullPrefix =
            estimate.coveredStops == prefix.map { it.id } && estimate.targetStopId == target.id
        val singleLeg = prefix.size == 1
        // A legacy delivery stage does not establish whether branch pickup is still required.
        // Only an explicit complete route prefix or confirmed onboard state can close that gap.
        if (
            singleLeg &&
                !fullPrefix &&
                journey.mode == TripsMode.DROP_OFF &&
                journey.passengers.any { it.id in target.passengers && !it.boarded }
        )
            return unavailable
        if (!(fullPrefix || singleLeg) || estimate.lat != target.lat || estimate.lng != target.lng)
            return unavailable
        val minutes = ceil(estimate.seconds / 60.0).toInt()
        val time = if (minutes == 0) "<1 min" else "$minutes min"
        return TripsEtaText(
            time,
            String.format(Locale.US, "%.1f km", estimate.meters / 1000.0),
            null,
        )
    }

    fun steps(journey: TripsJourney): List<TripsStep> {
        val stage = journey.stage
        val stop = nextStop(journey)
        val onboard = journey.passengers.all { it.boarded }
        val dropped = journey.passengers.all { it.dropped }
        if (journey.mode == TripsMode.DROP_OFF)
            return listOf(
                TripsStep("Assigned", true, false),
                TripsStep("To Pickup", onboard, stop?.role == StopRole.BRANCH_PICKUP),
                TripsStep("Onboard", onboard, false),
                TripsStep("To Customer", dropped, stop?.role == StopRole.CUSTOMER_DROP),
                TripsStep("Drop-off", dropped, false),
            )
        val waiting =
            journey.passengers.any {
                it.id in (stop?.passengers ?: emptySet()) &&
                    it.service == ServiceReadiness.IN_PROGRESS
            }
        return listOf(
            TripsStep("Assigned", true, false),
            TripsStep(
                when {
                    waiting -> "Awaiting Readiness"
                    stop?.progress == StopProgress.ARRIVED &&
                        stop.role == StopRole.THERAPIST_COLLECTION -> "Arrived"
                    else -> "To Therapist"
                },
                onboard,
                waiting || stop?.role == StopRole.THERAPIST_COLLECTION,
            ),
            TripsStep("Onboard", onboard, false),
            TripsStep("To Destination", stage == "complete", stop?.role == StopRole.DESTINATION),
            TripsStep("Completed", stage == "complete", false),
        )
    }

    /**
     * Existing authorized snapshots are single-leg/single-therapist. Do not fabricate a pool,
     * service deadline, collection obligation from delivery, or a hidden next destination.
     */
    fun fromWorkspace(workspace: DriverWorkspace): List<TripsJourney> =
        workspace.trips.mapNotNull { trip ->
            if (trip.serviceHistory || trip.stage == "complete") return@mapNotNull null
            val collection = trip.leg in setOf("collection", "return")
            val mode = if (collection) TripsMode.PICK_UP else TripsMode.DROP_OFF
            val passenger =
                TripsPassenger(
                    trip.id,
                    trip.therapist,
                    if (trip.stage == "service_active") ServiceReadiness.IN_PROGRESS
                    else ServiceReadiness.UNKNOWN,
                    collection =
                        if (collection) CollectionNeed.REQUIRED else CollectionNeed.UNDECIDED,
                    boarded = !trip.legacy && (trip.leg == "delivery" || trip.leg == "return"),
                )
            val role =
                when (trip.leg) {
                    "pickup" -> StopRole.BRANCH_PICKUP
                    "delivery" -> StopRole.CUSTOMER_DROP
                    "collection" -> StopRole.THERAPIST_COLLECTION
                    else -> StopRole.DESTINATION
                }
            val stop =
                TripsStop(
                    trip.id + ":" + trip.leg,
                    trip.id,
                    role,
                    trip.destination,
                    setOf(passenger.id),
                    when {
                        trip.stage.endsWith("_arrived") -> StopProgress.ARRIVED
                        trip.stage.endsWith("_enroute") -> StopProgress.ENROUTE
                        else -> StopProgress.PENDING
                    },
                    trip.lat,
                    trip.lng,
                )
            TripsJourney(
                trip.id,
                workspace.profile.id,
                mode,
                trip.scheduled(workspace.today),
                if (collection)
                    (if (trip.leg == "collection") trip.destination else "Collection point")
                else trip.pickup,
                when (trip.leg) {
                    "pickup" -> "Customer destination pending"
                    "collection" -> "Next destination set by dispatch"
                    else -> trip.destination
                },
                listOf(passenger),
                listOf(stop),
                trip.stage,
                trip.actionable,
            )
        }
}
