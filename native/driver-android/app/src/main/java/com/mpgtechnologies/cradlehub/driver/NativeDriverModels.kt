package com.mpgtechnologies.cradlehub.driver

import java.time.*
import java.time.format.DateTimeFormatter
import java.util.UUID
import org.json.JSONObject

internal enum class DriverTab(val title: String) {
    TODAY("Today"),
    TRIPS("Trips"),
    SCAN("Scan"),
    MAP("Map"),
    MORE("More"),
}

internal enum class TripFilter {
    ACTIVE,
    UPCOMING,
    COMPLETED,
}

internal data class DriverProfile(
    val id: String,
    val name: String,
    val branchId: String,
    val branch: String,
    val avatar: String? = null,
    val phone: String? = null,
    val email: String? = null,
)

internal data class DriverTrip(
    val id: String,
    val revision: Int,
    val stage: String,
    val leg: String?,
    val customer: String,
    val therapist: String,
    val date: LocalDate?,
    val time: String,
    val pickup: String,
    val destination: String,
    val lat: Double? = null,
    val lng: Double? = null,
    val serviceHistory: Boolean = false,
) {
    val label: String
        get() =
            when (stage) {
                "pickup_pending",
                "pickup_enroute",
                "pickup_arrived" -> "Pickup"
                "delivery_pending",
                "delivery_enroute" -> "To customer"
                "customer_arrived" -> "Awaiting service"
                "service_active" -> "In service"
                "collection_pending",
                "collection_enroute",
                "collection_arrived" -> "Collect therapist"
                "return_pending",
                "return_enroute",
                "return_arrived" -> "Return trip"
                "complete" -> "Completed"
                "service_history" -> "Service completed"
                else -> "Dispatch review"
            }

    val actionable
        get() =
            !serviceHistory &&
                stage !in setOf("complete", "review", "service_active", "customer_arrived")

    fun scheduled(today: LocalDate): String {
        val day =
            when (date) {
                today -> "Today"
                today.plusDays(1) -> "Tomorrow"
                null -> "Time unavailable"
                else -> date.toString()
            }
        val clock = runCatching {
            LocalTime.parse(time).format(DateTimeFormatter.ofPattern("h:mm a", java.util.Locale.US))
        }
            .getOrDefault("")
        return if (clock.isBlank()) day else "$day, $clock"
    }
}

internal data class DriverNotice(
    val id: String,
    val title: String,
    val body: String,
    val bookingId: String?,
)

internal data class AttendanceRecord(
    val day: String,
    val state: String,
    val arrival: String?,
    val departure: String?,
)

internal data class DriverWorkspace(
    val profile: DriverProfile,
    val trips: List<DriverTrip>,
    val shift: String,
    val attendance: List<AttendanceRecord>,
    val notices: List<DriverNotice>,
    val verifiedAt: Instant,
    val today: LocalDate,
    val partialError: String? = null,
    val failures: Set<String> = emptySet(),
)

internal data class NativeNavUi(
    val status: String = "Choose a trip",
    val action: String = "Start",
    val enabled: Boolean = false,
    val guiding: Boolean = false,
    val routeReady: Boolean = false,
    val loading: Boolean = false,
    val stage: String? = null,
)

internal data class NativeDriverUi(
    val workspace: DriverWorkspace? = null,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val stale: Boolean = false,
    val tab: DriverTab = DriverTab.TODAY,
    val filter: TripFilter = TripFilter.ACTIVE,
    val secondary: String? = null,
    val selectedId: String? = null,
    val nav: NativeNavUi = NativeNavUi(),
    val scanStatus: String = "Ready to scan",
    val scanBusy: Boolean = false,
    val scanOk: Boolean? = null,
)

internal object DriverTripPolicy {
    private val stages =
        setOf(
            "pickup_pending",
            "pickup_enroute",
            "pickup_arrived",
            "delivery_pending",
            "delivery_enroute",
            "customer_arrived",
            "service_active",
            "collection_pending",
            "collection_enroute",
            "collection_arrived",
            "return_pending",
            "return_enroute",
            "return_arrived",
            "complete",
            "review",
        )

    fun validId(id: String) = runCatching {
        UUID.fromString(id).toString().equals(id, true)
    }
        .getOrDefault(false)

    fun parse(j: JSONObject): DriverTrip {
        val id = j.getString("bookingId")
        require(validId(id))
        val revision = j.getInt("revision")
        require(revision >= 0 && j.getDouble("revision") == revision.toDouble())
        val stage = j.getString("stage")
        require(stage in stages)
        val leg = if (j.isNull("leg")) null else j.getString("leg")
        val expected =
            listOf("pickup", "delivery", "collection", "return").firstOrNull {
                stage.startsWith(it + "_")
            }
        require(leg == expected)
        val target = j.optJSONObject("destination")
        val lat = target?.getDouble("lat")
        val lng = target?.getDouble("lng")
        require(lat == null || lat.isFinite() && lat in -90.0..90.0)
        require(lng == null || lng.isFinite() && lng in -180.0..180.0)
        Instant.parse(j.getString("observedAt"))
        return DriverTrip(
            id,
            revision,
            stage,
            leg,
            j.nullableText("customerName") ?: "Assigned trip",
            j.nullableText("therapistName") ?: "Assigned therapist",
            j.nullableText("bookingDate")?.let(LocalDate::parse),
            j.optString("startTime"),
            j.nullableText("pickupLabel") ?: j.nullableText("branchName") ?: "Assigned branch",
            target?.optString("label") ?: j.nullableText("reason") ?: "Awaiting service",
            lat,
            lng,
        )
    }

    fun filtered(trips: List<DriverTrip>, filter: TripFilter, today: LocalDate): List<DriverTrip> =
        trips
            .filter { trip ->
                when (filter) {
                    TripFilter.COMPLETED -> trip.serviceHistory || trip.stage == "complete"
                    TripFilter.UPCOMING ->
                        !trip.serviceHistory &&
                            trip.stage != "complete" &&
                            trip.date?.isAfter(today) == true
                    TripFilter.ACTIVE ->
                        !trip.serviceHistory &&
                            trip.stage != "complete" &&
                            trip.date?.isAfter(today) != true &&
                            (trip.date == today || trip.stage !in setOf("pickup_pending", "review"))
                }
            }
            .sortedWith(
                compareBy<DriverTrip> { it.date ?: LocalDate.MAX }
                    .thenBy { it.time }
                    .thenBy { it.id }
            )

    fun next(trips: List<DriverTrip>, today: LocalDate) =
        filtered(trips, TripFilter.ACTIVE, today).firstOrNull { it.actionable }
}

internal fun JSONObject.nullableText(key: String): String? =
    if (isNull(key)) null else optString(key).trim().takeIf { it.isNotEmpty() && it != "null" }

internal object NativeQrPolicy {
    fun publicCode(raw: String, origin: String): String {
        require(raw.length <= 1024)
        val uri = java.net.URI(raw.trim())
        val trusted = java.net.URI(origin)
        fun port(u: java.net.URI) = if (u.port == -1) 443 else u.port
        require(
            uri.scheme == "https" &&
                uri.host?.equals(trusted.host, true) == true &&
                port(uri) == port(trusted) &&
                uri.userInfo == null &&
                uri.query == null &&
                uri.fragment == null
        ) {
            "Use your branch attendance QR"
        }
        return Regex("^/(?:scan|staff/scan/process)/([A-Za-z0-9_-]{8,160})/?$")
            .matchEntire(uri.path)
            ?.groupValues
            ?.get(1) ?: throw IllegalArgumentException("Use your branch attendance QR")
    }
}
