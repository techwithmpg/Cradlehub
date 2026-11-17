package com.mpgtechnologies.cradlehub.driver

import java.time.*

/** Debug .localtest only. Never populated by release code or represented as backend evidence. */
internal object NativeUiFixture {
    @JvmStatic
    fun workspace(): DriverWorkspace {
        val today = LocalDate.now(ZoneId.of("Asia/Manila"))
        val first =
            DriverTrip(
                "11111111-1111-4111-8111-111111111111",
                0,
                "pickup_pending",
                "pickup",
                "UI Test Customer A",
                "UI Test Therapist",
                today,
                "14:00:00",
                "Main · Bacolod",
                "UI TEST · Branch pickup",
                10.676,
                122.956,
            )
        val trips =
            listOf(
                first,
                first.copy(
                    id = "22222222-2222-4222-8222-222222222222",
                    stage = "collection_pending",
                    leg = "collection",
                    customer = "UI Test Customer B",
                    time = "16:30:00",
                    pickup = "SM · Bacolod",
                    destination = "UI TEST · Collection point",
                ),
                first.copy(
                    id = "33333333-3333-4333-8333-333333333333",
                    date = today,
                    stage = "delivery_enroute",
                    leg = "delivery",
                    destination = "Customer · Bacolod",
                    customer = "UI Test Customer C",
                    time = "09:00:00",
                ),
                first.copy(
                    id = "77777777-7777-4777-8777-777777777777",
                    stage = "service_active",
                    leg = null,
                    customer = "UI Test Customer D",
                    destination = "Customer · Bacolod",
                    time = "14:45:00",
                ),
                first.copy(
                    id = "44444444-4444-4444-8444-444444444444",
                    stage = "service_history",
                    leg = null,
                    customer = "UI Test Service Record",
                    date = today.minusDays(1),
                    serviceHistory = true,
                ),
            )
        val workspace =
            DriverWorkspace(
                DriverProfile(
                    "55555555-5555-4555-8555-555555555555",
                    "Alex · UI TEST",
                    "66666666-6666-4666-8666-666666666666",
                    "Main · Bacolod",
                ),
                trips,
                "On duty",
                listOf(AttendanceRecord(today.toString(), "Checked in", "09:00", null)),
                listOf(
                    DriverNotice(
                        "test-notice",
                        "UI test assignment",
                        "Fixture only; no backend or push delivery",
                        first.id,
                    )
                ),
                Instant.now(),
                today,
            )
        return workspace.copy(tripPlans = NativeTripsFixture.plans(workspace))
    }
}
