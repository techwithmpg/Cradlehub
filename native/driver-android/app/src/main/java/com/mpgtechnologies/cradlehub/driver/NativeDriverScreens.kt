package com.mpgtechnologies.cradlehub.driver

import android.view.View
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.LifecycleOwner
import java.time.LocalDate
import kotlinx.coroutines.delay

@Composable
internal fun NativeDriverApp(
    model: NativeDriverModel,
    map: View,
    owner: LifecycleOwner,
    cameraAllowed: Boolean,
    requestCamera: () -> Unit,
    scan: (String) -> Unit,
    start: () -> Unit,
    end: () -> Unit,
    voice: () -> Unit,
    recenter: () -> Unit,
    dial: (String) -> Unit,
) {
    val ui = model.ui
    val navigationScreen = ui.tab == DriverTab.MAP && ui.secondary == null
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    LaunchedEffect(ui.scanOk) {
        if (ui.scanOk == true)
            haptic.performHapticFeedback(
                androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress
            )
    }
    LaunchedEffect(ui.workspace != null) {
        if (ui.workspace != null) withFrameNanos { DriverPerformance.firstFrame() }
    }
    LaunchedEffect(ui.tab) {
        if (ui.tab == DriverTab.MAP) model.openMap?.invoke()
        withFrameNanos {
            DriverPerformance.end("tab_switch")
            if (ui.tab == DriverTab.MAP) DriverPerformance.end("trip_tap_to_native_map")
        }
    }
    LaunchedEffect(model) {
        while (true) {
            delay(30000)
            model.tick()
        }
    }
    DriverTheme {
        Column(
            Modifier.fillMaxSize().background(Forest).windowInsetsPadding(WindowInsets.statusBars)
        ) {
            if (!model.signedIn) {
                NativeLogin(ui, model::login)
                return@Column
            }
            if (ui.tab == DriverTab.TRIPS && ui.secondary == null)
                TripsHeader(ui.tripsMode, model::tripsMode) { model.showSecondary("Notifications") }
            else if (!navigationScreen)
                NativeHeader(
                    ui,
                    model.backend::avatarAllowed,
                    { model.showSecondary("Notifications") },
                )
            Box(
                Modifier.weight(1f)
                    .fillMaxWidth()
                    .clip(
                        RoundedCornerShape(
                            topStart = if (navigationScreen) 0.dp else 28.dp,
                            topEnd = if (navigationScreen) 0.dp else 28.dp,
                        )
                    )
                    .background(Cream)
            ) {
                Column(Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { map },
                        update = {
                            it.visibility =
                                if (ui.tab == DriverTab.MAP && ui.secondary == null) View.VISIBLE
                                else View.INVISIBLE
                        },
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    )
                    if (ui.tab == DriverTab.MAP && ui.secondary == null && ui.selectedId != null)
                        NavigationFooter(model, start, end, voice, recenter)
                }
                if (ui.secondary != null) SecondaryScreen(model, dial)
                else
                    when (ui.tab) {
                        DriverTab.TODAY -> TodayScreen(model)
                        DriverTab.TRIPS -> NativeTripsScreen(model)
                        DriverTab.SCAN ->
                            ScanScreen(model, owner, cameraAllowed, requestCamera, scan)
                        DriverTab.MORE -> MoreScreen(model)
                        DriverTab.MAP ->
                            if (ui.selectedId == null)
                                Box(
                                    Modifier.align(Alignment.TopCenter).padding(12.dp),
                                    contentAlignment = Alignment.TopCenter,
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(18.dp),
                                        color = Color.White,
                                        shadowElevation = 3.dp,
                                    ) {
                                        ActionButton(
                                            "View trips",
                                            { model.selectTab(DriverTab.TRIPS) },
                                            Modifier.padding(6.dp),
                                        )
                                    }
                                }
                    }
            }
            DriverBottomBar(ui.tab, model::selectTab)
        }
    }
}

@Composable
private fun NativeHeader(ui: NativeDriverUi, allow: (String) -> Boolean, notices: () -> Unit) {
    val profile = ui.workspace?.profile
    val compact = ui.tab == DriverTab.MAP && ui.secondary == null
    Box(
        Modifier.fillMaxWidth()
            .heightIn(min = if (compact) 48.dp else 126.dp)
            .background(Brush.linearGradient(listOf(Forest, DeepGreen)))
    ) {
        BrandLeaves(Modifier.matchParentSize())
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 16.dp)) {
            Text(
                if (BuildConfig.NATIVE_UI_FIXTURE) "CRADLEHUB DRIVER · UI TEST"
                else "CRADLEHUB DRIVER",
                fontSize = 12.sp,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFE8D39C),
            )
            if (!compact) {
                Spacer(Modifier.height(17.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val title =
                        ui.secondary
                            ?: when (ui.tab) {
                                DriverTab.TODAY ->
                                    "Good ${if(java.time.LocalTime.now().hour<12)"morning" else "day"}, ${profile?.name?.substringBefore(' ')?:"Driver"}"
                                DriverTab.TRIPS -> "Trips"
                                DriverTab.SCAN -> "Scan"
                                DriverTab.MORE -> profile?.name ?: "Driver"
                                else -> "Map"
                            }
                    if (ui.tab != DriverTab.TRIPS && ui.secondary == null) {
                        ProfileAvatar(profile, Modifier.size(54.dp), allow)
                        Spacer(Modifier.width(14.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            title,
                            color = Color.White,
                            fontSize = if (ui.tab == DriverTab.TRIPS) 30.sp else 23.sp,
                            lineHeight = 27.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (
                            ui.tab in listOf(DriverTab.TODAY, DriverTab.MORE) &&
                                ui.secondary == null
                        )
                            Row(
                                Modifier.padding(top = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                DriverIcon(Glyph.BRANCH, Modifier.size(16.dp), Pale)
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    profile?.branch ?: "Branch unavailable",
                                    color = Pale,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                    }
                    if (ui.tab == DriverTab.MORE && ui.workspace != null && ui.secondary == null)
                        StatusPill(ui.workspace.shift)
                    else IconAction("Notifications", Glyph.BELL, notices, Color.White)
                }
            }
        }
    }
}

@Composable
private fun DriverBottomBar(selected: DriverTab, onSelect: (DriverTab) -> Unit) {
    val largeType = androidx.compose.ui.platform.LocalDensity.current.fontScale >= 1.5f
    Box(Modifier.fillMaxWidth().shadow(8.dp, clip = false).background(Color.White)) {
        Row(
            Modifier.fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .height(if (largeType) 88.dp else 76.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DriverTab.entries.forEach { tab ->
                val active = selected == tab
                val glyph =
                    when (tab) {
                        DriverTab.TODAY -> Glyph.CALENDAR
                        DriverTab.TRIPS -> Glyph.TRUCK
                        DriverTab.SCAN -> Glyph.QR
                        DriverTab.MAP -> Glyph.MAP
                        DriverTab.MORE -> Glyph.MORE
                    }
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                    if (tab == DriverTab.SCAN)
                        Surface(
                            onClick = { onSelect(tab) },
                            modifier =
                                Modifier.offset(y = (-14).dp).size(76.dp).semantics {
                                    contentDescription = "Scan"
                                    role = Role.Tab
                                    this.selected = active
                                },
                            shape = CircleShape,
                            color = DeepGreen,
                            border = BorderStroke(4.dp, Cream),
                            shadowElevation = 6.dp,
                        ) {
                            Column(
                                Modifier.fillMaxSize(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                DriverIcon(glyph, Modifier.size(27.dp), Color.White)
                                Text(
                                    "Scan",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    else
                        Column(
                            Modifier.fillMaxSize()
                                .selectable(active, role = Role.Tab, onClick = { onSelect(tab) })
                                .padding(top = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            DriverIcon(
                                glyph,
                                Modifier.size(24.dp),
                                if (active) DeepGreen else Muted,
                            )
                            Text(
                                tab.title,
                                fontSize = 11.sp,
                                color = if (active) DeepGreen else Muted,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                            if (active)
                                Box(
                                    Modifier.padding(top = 7.dp)
                                        .width(24.dp)
                                        .height(3.dp)
                                        .clip(CircleShape)
                                        .background(DeepGreen)
                                )
                        }
                }
            }
        }
    }
}

@Composable
private fun StateBanner(ui: NativeDriverUi, retry: () -> Unit) {
    if (ui.busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = DeepGreen)
    if (ui.stale || ui.error != null)
        Row(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFF8E8C7))
                .padding(start = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (ui.stale) "Offline or stale" else ui.error ?: "Unavailable",
                color = Forest,
                fontSize = 12.sp,
                modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
            )
            IconAction("Refresh", Glyph.REFRESH, retry)
        }
}

@Composable
private fun EmptyOrLoading(ui: NativeDriverUi, text: String, retry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 34.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (ui.loading) CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 2.dp)
        else {
            Text(
                if (ui.error != null) "Assignments unavailable" else text,
                color = Muted,
                fontSize = 15.sp,
            )
            if (ui.error != null) ActionButton("Retry", retry, Modifier.padding(top = 16.dp))
        }
    }
}

@Composable
private fun TodayScreen(model: NativeDriverModel) {
    val ui = model.ui
    val workspace = ui.workspace
    val today = workspace?.today ?: LocalDate.now()
    val next = workspace?.let { DriverTripPolicy.next(it.trips, it.today) }
    val rest =
        workspace?.let {
            DriverTripPolicy.filtered(it.trips, TripFilter.ACTIVE, it.today).filter { trip ->
                trip.id != next?.id
            }
        } ?: emptyList()
    LazyColumn(
        Modifier.fillMaxSize().background(Cream),
        contentPadding = PaddingValues(16.dp, 20.dp, 16.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        if (ui.busy || ui.stale || ui.error != null) item { StateBanner(ui, model::refresh) }
        item {
            DriverCard {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(46.dp).clip(CircleShape).background(Pale),
                        contentAlignment = Alignment.Center,
                    ) {
                        DriverIcon(Glyph.TRUCK, Modifier.size(27.dp))
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "SHIFT STATUS",
                            color = Muted,
                            fontSize = 10.sp,
                            letterSpacing = 1.3.sp,
                        )
                        Text(
                            workspace?.shift ?: "Unavailable",
                            color = Forest,
                            fontSize = 23.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                    }
                    if (workspace?.shift == "On duty")
                        DriverIcon(Glyph.CHECK, Modifier.size(25.dp), DeepGreen)
                }
            }
        }
        if (next != null) item { NextTripCard(next, today) { model.selectTrip(next.id) } }
        else item { EmptyOrLoading(ui, "No trips ready", model::refresh) }
        if (rest.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Today’s trips",
                        fontSize = 21.sp,
                        color = Forest,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    StatusPill(
                        "${rest.size} ${if(rest.size==1)"trip" else "trips"}",
                        Color(0xFFF7E3B8),
                    )
                }
            }
            itemsIndexed(rest, key = { _, trip -> trip.id }) { index, trip ->
                DriverCard(
                    Modifier.clickable(
                        role = Role.Button,
                        onClickLabel = "Open navigation for ${trip.customer}",
                    ) {
                        model.selectTrip(trip.id)
                    }
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(30.dp).clip(CircleShape).background(Pale),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${index+1}", fontWeight = FontWeight.SemiBold, color = Forest)
                        }
                        Spacer(Modifier.width(16.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                trip.customer,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                "${trip.scheduled(today)} · ${trip.label}",
                                fontSize = 12.sp,
                                color = Muted,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                        DriverIcon(Glyph.CHEVRON, Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun NextTripCard(trip: DriverTrip, today: LocalDate, onClick: () -> Unit) {
    DriverCard(
        Modifier.clickable(
            role = Role.Button,
            onClickLabel = "Open native navigation for ${trip.customer}",
            onClick = onClick,
        )
    ) {
        Box(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(Forest, DeepGreen)))
        ) {
            BrandLeaves(Modifier.matchParentSize())
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "NEXT TRIP",
                        color = Color(0xFFE8D39C),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.5.sp,
                        modifier = Modifier.weight(1f),
                    )
                    StatusPill(trip.label)
                }
                Text(
                    trip.customer,
                    color = Color.White,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp),
                    lineHeight = 29.sp,
                    maxLines = 2,
                )
            }
        }
        Column(Modifier.padding(16.dp)) {
            LineItem(Glyph.CALENDAR, trip.scheduled(today))
            HorizontalDivider(color = Cream)
            LineItem(
                Glyph.BRANCH,
                trip.pickup,
                sub = if (trip.leg == "collection") "Therapist collection" else "Therapist pickup",
            )
            HorizontalDivider(color = Cream)
            LineItem(Glyph.PIN, trip.destination)
            Row(
                Modifier.padding(top = 12.dp)
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(DeepGreen),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Open trip",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                )
                Spacer(Modifier.width(12.dp))
                DriverIcon(Glyph.ARROW, Modifier.size(21.dp), Color.White)
            }
        }
    }
}

@Composable
private fun ScanScreen(
    model: NativeDriverModel,
    owner: LifecycleOwner,
    allowed: Boolean,
    requestCamera: () -> Unit,
    scan: (String) -> Unit,
) {
    val ui = model.ui
    Column(
        Modifier.fillMaxSize().background(Cream).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Box(
            Modifier.weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(26.dp))
                .background(Color(0xFF202C25))
        ) {
            if (allowed && ui.scanOk == null && !ui.scanBusy)
                NativeQrCamera(owner, scan, model::cameraError)
            Canvas(Modifier.fillMaxSize().padding(horizontal = 50.dp, vertical = 86.dp)) {
                val s = 26.dp.toPx()
                val stroke = Stroke(5.dp.toPx(), cap = StrokeCap.Round)
                val p = Path()
                for ((x, y, dx, dy) in
                    listOf(
                        listOf(0f, 0f, 1f, 1f),
                        listOf(size.width, 0f, -1f, 1f),
                        listOf(0f, size.height, 1f, -1f),
                        listOf(size.width, size.height, -1f, -1f),
                    )) {
                    p.moveTo(x + dx * s, y)
                    p.lineTo(x, y)
                    p.lineTo(x, y + dy * s)
                }
                drawPath(p, Color.White, style = stroke)
            }
            Column(
                Modifier.align(Alignment.BottomCenter).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    if (ui.scanBusy) "Confirming scan"
                    else if (ui.scanOk != null) ui.scanStatus
                    else if (allowed) "Scan branch QR" else "Allow camera to scan",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                if (!allowed)
                    ActionButton("Allow camera", requestCamera, Modifier.padding(top = 12.dp))
                if (ui.scanOk != null)
                    ActionButton("Scan again", model::scanAgain, Modifier.padding(top = 12.dp))
            }
        }
        DriverCard {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(CircleShape).background(Pale),
                    contentAlignment = Alignment.Center,
                ) {
                    DriverIcon(Glyph.QR)
                }
                Text(
                    if (allowed) ui.scanStatus else "Camera permission needed",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Forest,
                    modifier =
                        Modifier.weight(1f).padding(horizontal = 16.dp).semantics {
                            liveRegion = LiveRegionMode.Polite
                        },
                )
                if (ui.scanOk == true) DriverIcon(Glyph.CHECK)
            }
        }
        Spacer(Modifier.height(6.dp))
    }
}

@Composable
private fun MoreScreen(model: NativeDriverModel) {
    val rows =
        listOf(
            "My Profile" to Glyph.PERSON,
            "Attendance & Shift" to Glyph.CALENDAR,
            "Trip History" to Glyph.PIN,
            "Notifications" to Glyph.BELL,
            "Support" to Glyph.HEADSET,
            "Logout" to Glyph.LOGOUT,
        )
    LazyColumn(
        Modifier.fillMaxSize().background(Cream),
        contentPadding = PaddingValues(16.dp, 20.dp, 16.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(rows) { (name, glyph) ->
            DriverCard(
                Modifier.clickable(role = Role.Button) {
                    when (name) {
                        "Logout" -> model.logout()
                        "Trip History" -> model.showSecondary("Trip History")
                        else -> model.showSecondary(name)
                    }
                }
            ) {
                Row(
                    Modifier.heightIn(min = 66.dp).padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(42.dp).clip(CircleShape).background(Pale),
                        contentAlignment = Alignment.Center,
                    ) {
                        DriverIcon(glyph)
                    }
                    Text(
                        name,
                        color = Forest,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                    )
                    DriverIcon(Glyph.CHEVRON, Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun SecondaryScreen(model: NativeDriverModel, dial: (String) -> Unit) {
    val ui = model.ui
    val w = ui.workspace
    val title = ui.secondary ?: ""
    LazyColumn(
        Modifier.fillMaxSize().background(Cream),
        contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TextButton(model::closeSecondary) { Text("‹ Back", color = DeepGreen) } }
        when (title) {
            "My Profile" -> {
                item {
                    DriverCard {
                        Column(Modifier.padding(20.dp)) {
                            ProfileAvatar(
                                w?.profile,
                                Modifier.size(70.dp),
                                model.backend::avatarAllowed,
                            )
                            Text(
                                w?.profile?.name ?: "Unavailable",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 16.dp),
                            )
                            LineItem(Glyph.BRANCH, w?.profile?.branch ?: "Unavailable")
                            Text(w?.profile?.email ?: "", fontSize = 14.sp, color = Muted)
                        }
                    }
                }
            }
            "Attendance & Shift" -> {
                item {
                    Text(w?.shift ?: "Unavailable", fontSize = 25.sp, fontWeight = FontWeight.Bold)
                }
                if ("attendance" in (w?.failures ?: emptySet()))
                    item {
                        Text("Attendance unavailable", color = Muted)
                    }
                items(w?.attendance ?: emptyList()) { a ->
                    DriverCard {
                        Column(Modifier.padding(16.dp)) {
                            Text(a.day, fontWeight = FontWeight.SemiBold)
                            Text(
                                a.state,
                                color = DeepGreen,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                            Text(
                                listOfNotNull(a.arrival, a.departure).joinToString(" → "),
                                color = Muted,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
            "Notifications" -> {
                if (w?.notices.isNullOrEmpty())
                    item {
                        Text(
                            if ("notices" in (w?.failures ?: emptySet()))
                                "Notifications unavailable"
                            else "No notifications",
                            color = Muted,
                        )
                    }
                items(w?.notices ?: emptyList()) { notice ->
                    DriverCard(
                        Modifier.clickable(enabled = notice.bookingId != null) {
                            notice.bookingId?.let(model::selectTrip)
                        }
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(notice.title, fontWeight = FontWeight.SemiBold)
                            Text(
                                notice.body,
                                color = Muted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                    }
                }
            }
            "Trip History" -> {
                val records =
                    DriverTripPolicy.filtered(
                        w?.trips ?: emptyList(),
                        TripFilter.COMPLETED,
                        w?.today ?: LocalDate.now(),
                    )
                if (records.isEmpty())
                    item {
                        Text(
                            if ("history" in (w?.failures ?: emptySet()))
                                "Service history unavailable"
                            else "No service records",
                            color = Muted,
                        )
                    }
                items(records, key = { it.id }) { record ->
                    DriverCard {
                        Column(Modifier.padding(16.dp)) {
                            Text(record.customer, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text(record.label, color = DeepGreen)
                            LineItem(Glyph.PERSON, record.therapist)
                            Text(record.scheduled(w!!.today), color = Muted, fontSize = 12.sp)
                        }
                    }
                }
            }
            "Trip details" -> {
                val trip = w?.trips?.firstOrNull { it.id == ui.selectedId }
                if (trip != null)
                    item {
                        DriverCard {
                            Column(Modifier.padding(20.dp)) {
                                Text(trip.customer, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                                LineItem(Glyph.PERSON, trip.therapist)
                                LineItem(Glyph.CALENDAR, trip.scheduled(w!!.today))
                                LineItem(Glyph.BRANCH, trip.pickup)
                                LineItem(Glyph.PIN, trip.destination)
                            }
                        }
                    }
            }
            "Support" -> {
                item {
                    DriverCard {
                        Column(Modifier.padding(20.dp)) {
                            Text(
                                w?.profile?.branch ?: "Your branch",
                                fontSize = 23.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                if (ui.stale) "Connection unavailable" else "Connected",
                                color = Muted,
                                modifier = Modifier.padding(top = 12.dp),
                            )
                            w?.profile?.phone?.let { phone ->
                                ActionButton(
                                    "Call branch",
                                    { dial(phone) },
                                    Modifier.padding(top = 16.dp),
                                )
                            }
                            ActionButton(
                                "Refresh connection",
                                model::refresh,
                                Modifier.padding(top = 16.dp),
                                outlined = true,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NavigationFooter(
    model: NativeDriverModel,
    start: () -> Unit,
    end: () -> Unit,
    voice: () -> Unit,
    recenter: () -> Unit,
) {
    val ui = model.ui
    val retry =
        ui.selectedId != null &&
            !ui.nav.loading &&
            !ui.nav.enabled &&
            !ui.nav.guiding &&
            ui.nav.stage !in setOf("customer_arrived", "service_active", "complete", "review")
    val trip = ui.workspace?.trips?.firstOrNull { it.id == ui.selectedId }
    Surface(
        color = Cream,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        shadowElevation = 5.dp,
    ) {
        Column(Modifier.padding(16.dp, 12.dp, 16.dp, 22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                DriverIcon(Glyph.PIN, Modifier.size(24.dp))
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    trip?.let {
                        Text(
                            if (
                                ui.nav.stage?.substringBefore('_') in
                                    setOf("collection", "return") ||
                                    (ui.nav.stage == null &&
                                        it.leg in setOf("collection", "return"))
                            )
                                "PICK-UP"
                            else "DROP-OFF",
                            color = DeepGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 3.dp),
                        )
                    }
                    Text(
                        trip?.destination ?: "Assigned destination",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        ui.nav.status,
                        color = Muted,
                        fontSize = 11.sp,
                        modifier =
                            Modifier.padding(top = 3.dp).semantics {
                                liveRegion = LiveRegionMode.Polite
                            },
                        maxLines = 3,
                    )
                }
                if (ui.nav.routeReady) {
                    IconAction("Recenter", Glyph.LOCATE, recenter)
                    IconAction("Toggle voice guidance", Glyph.VOICE, voice)
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ActionButton(
                    "Trip details",
                    { model.showSecondary("Trip details") },
                    Modifier.weight(1f),
                    enabled = trip != null,
                    outlined = true,
                )
                ActionButton(
                    if (ui.nav.guiding) "End route"
                    else
                        when {
                            ui.nav.stage == "service_active" -> "In service"
                            ui.nav.stage == "customer_arrived" -> "Awaiting service"
                            ui.nav.stage == "complete" -> "Completed"
                            ui.nav.stage == "review" -> "Review required"
                            retry -> "Retry"
                            ui.nav.loading -> "Loading…"
                            ui.nav.action.contains("Allow", true) -> "Allow location"
                            ui.nav.action.contains("on board", true) -> "On board"
                            ui.nav.action.contains("collected", true) -> "Collected"
                            ui.nav.action.contains("drop-off", true) -> "Drop off"
                            ui.nav.action.contains("Resume", true) -> "Resume"
                            else -> "Start"
                        },
                    if (ui.nav.guiding) end
                    else if (retry)
                        ({
                            ui.selectedId?.let(model::selectTrip)
                            Unit
                        })
                    else start,
                    Modifier.weight(1f),
                    enabled = ui.nav.guiding || ui.nav.enabled || retry,
                )
            }
        }
    }
}

@Composable
private fun NativeLogin(ui: NativeDriverUi, login: (String, String) -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize()
            .background(Cream)
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "CRADLEHUB DRIVER",
            color = Forest,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 2.sp,
        )
        Text(
            "Sign in",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Forest,
            modifier = Modifier.padding(top = 20.dp, bottom = 24.dp),
        )
        OutlinedTextField(
            email,
            { email = it },
            Modifier.fillMaxWidth(),
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions =
                androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Email),
            shape = RoundedCornerShape(16.dp),
        )
        OutlinedTextField(
            password,
            { password = it },
            Modifier.fillMaxWidth().padding(top = 14.dp),
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            shape = RoundedCornerShape(16.dp),
        )
        if (ui.error != null)
            Text(
                ui.error,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier =
                    Modifier.padding(top = 12.dp).semantics { liveRegion = LiveRegionMode.Polite },
            )
        ActionButton(
            if (ui.busy) "Signing in…" else "Sign in",
            {
                val value = password
                password = ""
                login(email, value)
            },
            Modifier.fillMaxWidth().padding(top = 24.dp),
            enabled = !ui.busy && email.isNotBlank() && password.isNotBlank(),
        )
    }
}
