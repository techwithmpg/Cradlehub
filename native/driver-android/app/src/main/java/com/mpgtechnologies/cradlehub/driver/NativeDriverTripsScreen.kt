package com.mpgtechnologies.cradlehub.driver

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import java.time.Instant
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private val DropBlue = Color(0xFF124B78)
private val DropTint = Color(0xFFE5F2FE)
private val PickTint = Color(0xFFEAF5DF)

@Composable
internal fun TripsHeader(mode: TripsMode, change: (TripsMode) -> Unit, notices: () -> Unit) {
    Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Forest, DeepGreen)))) {
        Canvas(Modifier.matchParentSize()) {
            val wave =
                Path().apply {
                    moveTo(size.width * .48f, size.height * .8f)
                    cubicTo(
                        size.width * .76f,
                        size.height * .85f,
                        size.width * .72f,
                        size.height * .3f,
                        size.width,
                        size.height * .62f,
                    )
                }
            drawPath(wave, Gold.copy(alpha = .8f), style = Stroke(1.dp.toPx()))
        }
        Column(Modifier.padding(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LotusMark(Modifier.size(42.dp))
                Column(Modifier.weight(1f).padding(start = 9.dp)) {
                    Text(
                        "CradleHub",
                        color = Cream,
                        fontFamily = FontFamily.Serif,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        if (BuildConfig.NATIVE_UI_FIXTURE) "DRIVER · UI TEST" else "D R I V E R",
                        color = Cream,
                        fontSize = 10.sp,
                        lineHeight = 14.sp,
                        letterSpacing = 2.sp,
                    )
                }
                IconAction("Notifications", Glyph.BELL, notices, Cream)
            }
            Text(
                "Trips",
                color = Cream,
                fontFamily = FontFamily.Serif,
                fontSize = 29.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 5.dp, bottom = 8.dp).semantics { heading() },
            )
            Row(
                Modifier.fillMaxWidth()
                    .selectableGroup()
                    .border(1.dp, Cream, RoundedCornerShape(30.dp))
                    .padding(3.dp)
            ) {
                TripsMode.entries.forEach { item ->
                    val selected = item == mode
                    Row(
                        Modifier.weight(1f)
                            .clip(RoundedCornerShape(26.dp))
                            .background(if (selected) Cream else Color.Transparent)
                            .selectable(selected, role = Role.Tab, onClick = { change(item) })
                            .heightIn(min = 48.dp)
                            .padding(horizontal = 8.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        DriverIcon(
                            if (item == TripsMode.DROP_OFF) Glyph.TRUCK else Glyph.PERSON,
                            Modifier.size(22.dp),
                            if (selected) Forest else Cream,
                        )
                        Text(
                            item.title,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selected) Forest else Cream,
                            modifier = Modifier.padding(start = 9.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LotusMark(modifier: Modifier) {
    Canvas(modifier.clearAndSetSemantics {}) {
        val center =
            Path().apply {
                moveTo(size.width * .5f, size.height * .83f)
                cubicTo(
                    size.width * .13f,
                    size.height * .5f,
                    size.width * .43f,
                    size.height * .16f,
                    size.width * .5f,
                    size.height * .08f,
                )
                cubicTo(
                    size.width * .85f,
                    size.height * .4f,
                    size.width * .71f,
                    size.height * .63f,
                    size.width * .5f,
                    size.height * .83f,
                )
            }
        val sides =
            Path().apply {
                moveTo(size.width * .5f, size.height * .89f)
                quadraticTo(
                    size.width * .13f,
                    size.height * .88f,
                    size.width * .06f,
                    size.height * .49f,
                )
                quadraticTo(
                    size.width * .38f,
                    size.height * .54f,
                    size.width * .5f,
                    size.height * .89f,
                )
                quadraticTo(
                    size.width * .88f,
                    size.height * .87f,
                    size.width * .95f,
                    size.height * .48f,
                )
                quadraticTo(
                    size.width * .67f,
                    size.height * .56f,
                    size.width * .5f,
                    size.height * .89f,
                )
            }
        drawPath(center, Gold, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
        drawPath(sides, Gold, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** Display-only clock. Stops when Trips is disposed or its host is below STARTED. */
@Composable
internal fun rememberTripsNow(owner: LifecycleOwner, clock: () -> Instant = Instant::now): Instant {
    val currentClock by rememberUpdatedState(clock)
    var now by remember { mutableStateOf(clock()) }
    LaunchedEffect(owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (isActive) {
                now = currentClock()
                delay(5000)
            }
        }
    }
    return now
}

@Composable
internal fun NativeTripsScreen(model: NativeDriverModel, owner: LifecycleOwner) {
    val ui = model.ui
    val workspace = ui.workspace
    val plans =
        workspace?.let { it.tripPlans ?: NativeTripsPolicy.fromWorkspace(it) } ?: emptyList()
    val journeys = NativeTripsPolicy.visible(plans, workspace?.profile?.id ?: "", ui.tripsMode)
    val dropScroll = rememberLazyListState()
    val pickScroll = rememberLazyListState()
    val now = rememberTripsNow(owner)
    LazyColumn(
        Modifier.fillMaxSize().background(Cream).testTag("trips-list"),
        state = if (ui.tripsMode == TripsMode.DROP_OFF) dropScroll else pickScroll,
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item("summary") {
            TripsSummary(ui.tripsMode, journeys.size, ui.loading && workspace == null)
        }
        if (ui.error != null || ui.stale)
            item("status") {
                Column(
                    Modifier.fillMaxWidth()
                        .background(Color(0xFFFFEDCE), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    Text(
                        ui.error ?: "Assignments may be out of date",
                        color = Forest,
                        fontSize = 13.sp,
                    )
                    TextButton(model::refresh) { Text("Refresh") }
                }
            }
        if (journeys.isEmpty())
            item("empty") {
                Column(
                    Modifier.fillMaxWidth().padding(22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    if (ui.loading) CircularProgressIndicator(Modifier.size(28.dp))
                    Text(
                        if (ui.loading) "Loading assignments…"
                        else if (ui.error != null) "Assignments unavailable"
                        else if (ui.tripsMode == TripsMode.DROP_OFF) "No drop-off assignments"
                        else "No assigned collections",
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
            }
        items(journeys, key = { it.id }) { journey ->
            TripsCard(
                journey,
                workspace!!.profile.id,
                ui.nav.eta ?: journey.fixtureEta,
                now,
                ui.stale,
            ) {
                model.openRoute(journey)
            }
        }
    }
}

@Composable
private fun TripsSummary(mode: TripsMode, count: Int, loading: Boolean) {
    val drop = mode == TripsMode.DROP_OFF
    val accent = if (drop) DropBlue else DeepGreen
    Surface(color = if (drop) DropTint else PickTint, shape = RoundedCornerShape(14.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DriverIcon(if (drop) Glyph.TRUCK else Glyph.PERSON, Modifier.size(24.dp), accent)
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text(
                    if (drop) "Deliver Therapists (Drop-off)" else "Collect Therapists (Pick-up)",
                    color = Forest,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 18.sp,
                )
                Text(
                    if (drop) "Pick up therapists and deliver to customers"
                    else "After service, to their next authorized stop",
                    color = Forest,
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(
                if (loading) "…" else "$count ${if (count == 1) "Trip" else "Trips"}",
                color = accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier.border(1.dp, accent.copy(alpha = .4f), RoundedCornerShape(18.dp))
                        .padding(8.dp),
            )
        }
    }
}

@Composable
private fun TripsCard(
    journey: TripsJourney,
    driver: String,
    estimate: TripsRoadEta?,
    now: Instant,
    stale: Boolean,
    open: () -> Unit,
) {
    val drop = journey.mode == TripsMode.DROP_OFF
    val tint = if (drop) DropTint else PickTint
    val accent = if (drop) DropBlue else DeepGreen
    val eta = NativeTripsPolicy.eta(journey, estimate, now)
    val next = NativeTripsPolicy.nextStop(journey)
    val route = NativeTripsPolicy.route(journey, driver)
    val waiting =
        journey.passengers.any {
            it.id in (next?.passengers ?: emptySet()) && it.service == ServiceReadiness.IN_PROGRESS
        }
    Surface(
        Modifier.fillMaxWidth().testTag("journey-${journey.id}"),
        color = Color.White,
        shape = RoundedCornerShape(19.dp),
        shadowElevation = 2.dp,
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                StatusPill(journey.mode.badge, tint, accent)
                Row(
                    Modifier.weight(1f).padding(start = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.End,
                ) {
                    DriverIcon(Glyph.CALENDAR, Modifier.size(15.dp), Muted)
                    Text(
                        journey.scheduled,
                        color = Forest,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 5.dp).weight(1f, fill = false),
                        textAlign = androidx.compose.ui.text.style.TextAlign.End,
                    )
                }
            }
            Spacer(Modifier.height(9.dp))
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f).padding(end = 8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(32.dp).background(PickTint, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            DriverIcon(Glyph.PERSON, Modifier.size(23.dp), Forest)
                        }
                        Column(Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(
                                journey.passengers.joinToString(" & ") { it.name },
                                color = Forest,
                                fontSize = 16.sp,
                                lineHeight = 20.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            val count = journey.passengers.size
                            Text(
                                "$count ${if (count == 1) "Therapist" else "Therapists (Pooled)"}",
                                color = Muted,
                                fontSize = 12.sp,
                                lineHeight = 16.sp,
                            )
                        }
                    }
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Top) {
                        DriverIcon(Glyph.PIN, Modifier.size(16.dp), Color(0xFF805B17))
                        Text(
                            "${journey.origin} → ${journey.destination}",
                            color = Forest,
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(start = 6.dp),
                        )
                    }
                }
                Column(
                    Modifier.widthIn(min = 90.dp, max = 110.dp)
                        .background(tint, RoundedCornerShape(12.dp))
                        .padding(9.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        if (drop) "Time to Drop" else "Time to Pick",
                        color = accent,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.sp,
                        lineHeight = 14.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Text(
                        eta.time,
                        color = accent,
                        fontWeight = FontWeight.Bold,
                        fontSize = if (eta.reason == null && eta.distance != null) 23.sp else 13.sp,
                        lineHeight = if (eta.distance != null) 27.sp else 17.sp,
                        modifier = Modifier.padding(top = 3.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    eta.distance?.let {
                        Text("($it)", color = accent, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                    eta.reason?.let {
                        Text(it, color = accent, fontSize = 10.sp, lineHeight = 13.sp)
                    }
                }
            }
            Surface(
                color = if (waiting && !drop) Color(0xFFFFF0CF) else PickTint,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 9.dp),
            ) {
                Row(
                    Modifier.padding(horizontal = 9.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DriverIcon(
                        if (waiting && !drop) Glyph.CALENDAR
                        else if (next == null) Glyph.CHECK else Glyph.ARROW,
                        Modifier.size(16.dp),
                        if (waiting && !drop) Color(0xFF795114) else DeepGreen,
                    )
                    Text(
                        NativeTripsPolicy.banner(journey, now),
                        color = if (waiting && !drop) Color(0xFF795114) else DeepGreen,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 7.dp),
                    )
                }
            }
            val destinations =
                journey.stops.filter {
                    it.role == StopRole.CUSTOMER_DROP || it.role == StopRole.THERAPIST_COLLECTION
                }
            if (destinations.size > 1) {
                destinations.forEach { stop ->
                    val names =
                        journey.passengers
                            .filter { it.id in stop.passengers }
                            .joinToString { it.name }
                    Text(
                        "$names · ${stop.label} · ${if (stop.progress == StopProgress.CONFIRMED) "Confirmed" else "Pending"}",
                        color = Forest,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
                val etaTarget = destinations.firstOrNull { it.progress != StopProgress.CONFIRMED }
                etaTarget?.let {
                    Text(
                        "Travel estimate to: ${it.label}",
                        color = accent,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }
            JourneyProgress(NativeTripsPolicy.steps(journey))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (route != null)
                    Button(
                        open,
                        enabled = !stale,
                        shape = RoundedCornerShape(15.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        modifier =
                            Modifier.heightIn(min = 48.dp)
                                .testTag("route-${journey.id}")
                                .semantics {
                                    contentDescription =
                                        "Open ${journey.mode.title} route for ${journey.passengers.joinToString { it.name }}"
                                },
                    ) {
                        Text(
                            "Open Route",
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        DriverIcon(
                            Glyph.CHEVRON,
                            Modifier.padding(start = 8.dp).size(15.dp),
                            Color.White,
                        )
                    }
                else
                    Text(
                        if (waiting && !drop) "Awaiting service readiness"
                        else "Route awaits dispatch verification",
                        fontSize = 11.sp,
                        color = Muted,
                        modifier = Modifier.padding(top = 8.dp),
                    )
            }
        }
    }
}

@Composable
private fun JourneyProgress(steps: List<TripsStep>) {
    Column(
        Modifier.fillMaxWidth().padding(top = 11.dp).semantics(mergeDescendants = true) {
            contentDescription =
                steps.joinToString(", ") {
                    "${it.title}: ${if (it.done) "confirmed" else if (it.current) "current" else "pending"}"
                }
        }
    ) {
        Canvas(Modifier.fillMaxWidth().height(21.dp).clearAndSetSemantics {}) {
            val gap = size.width / steps.size
            steps.forEachIndexed { index, step ->
                val x = gap * (index + .5f)
                if (index < steps.lastIndex)
                    drawLine(
                        if (step.done && steps[index + 1].done) DeepGreen else Color(0xFFB3B9B4),
                        Offset(x, size.height / 2),
                        Offset(x + gap, size.height / 2),
                        2.dp.toPx(),
                    )
                drawCircle(Color.White, 8.dp.toPx(), Offset(x, size.height / 2))
                drawCircle(
                    if (step.done || step.current) DeepGreen else Color(0xFFA6ADA8),
                    8.dp.toPx(),
                    Offset(x, size.height / 2),
                    style = Stroke(2.dp.toPx()),
                )
                if (step.done) {
                    drawCircle(DeepGreen, 7.dp.toPx(), Offset(x, size.height / 2))
                    val check =
                        Path().apply {
                            moveTo(x - 3.dp.toPx(), size.height / 2)
                            lineTo(x - .5.dp.toPx(), size.height / 2 + 2.dp.toPx())
                            lineTo(x + 3.5.dp.toPx(), size.height / 2 - 3.dp.toPx())
                        }
                    drawPath(
                        check,
                        Color.White,
                        style = Stroke(1.5.dp.toPx(), cap = StrokeCap.Round),
                    )
                } else if (step.current)
                    drawCircle(PickTint, 5.dp.toPx(), Offset(x, size.height / 2))
            }
        }
        Row(Modifier.fillMaxWidth().clearAndSetSemantics {}) {
            steps.forEach { step ->
                Text(
                    step.title,
                    color = Forest,
                    fontSize = 9.sp,
                    lineHeight = 12.sp,
                    fontWeight =
                        if (step.done || step.current) FontWeight.Bold else FontWeight.Medium,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.weight(1f).padding(horizontal = 1.dp),
                )
            }
        }
    }
}
