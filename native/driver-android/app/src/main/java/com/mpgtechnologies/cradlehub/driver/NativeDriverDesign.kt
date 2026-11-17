package com.mpgtechnologies.cradlehub.driver

import android.graphics.BitmapFactory
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal val Forest = Color(0xFF163A2B)
internal val DeepGreen = Color(0xFF075038)
internal val Cream = Color(0xFFF7F3EB)
internal val Gold = Color(0xFFC8A96B)
internal val Muted = Color(0xFF65746B)
internal val Pale = Color(0xFFE7F1E6)

internal enum class Glyph {
    CALENDAR,
    TRUCK,
    QR,
    MAP,
    MORE,
    BELL,
    BRANCH,
    PIN,
    CHEVRON,
    ARROW,
    PERSON,
    HEADSET,
    LOGOUT,
    CHECK,
    CAMERA,
    REFRESH,
    VOICE,
    LOCATE,
}

@Composable
internal fun DriverTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme =
            lightColorScheme(
                primary = DeepGreen,
                onPrimary = Color.White,
                background = Cream,
                surface = Color.White,
                onSurface = Forest,
                secondary = Gold,
            ),
        typography = Typography(),
        content = content,
    )
}

@Composable
internal fun DriverIcon(
    glyph: Glyph,
    modifier: Modifier = Modifier.size(24.dp),
    color: Color = Forest,
) {
    Canvas(modifier) {
        val scale = size.minDimension / 24f
        withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
            val stroke = Stroke(1.65f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            fun line(x: Float, y: Float, x2: Float, y2: Float) =
                drawLine(color, Offset(x, y), Offset(x2, y2), 1.65f, StrokeCap.Round)
            fun box(x: Float, y: Float, w: Float, h: Float, r: Float = 2f) =
                drawRoundRect(color, Offset(x, y), Size(w, h), CornerRadius(r), style = stroke)
            fun circle(x: Float, y: Float, r: Float) =
                drawCircle(color, r, Offset(x, y), style = stroke)
            fun path(vararg points: Pair<Float, Float>) {
                val p = Path()
                points.forEachIndexed { i, (x, y) ->
                    if (i == 0) p.moveTo(x, y) else p.lineTo(x, y)
                }
                drawPath(p, color, style = stroke)
            }
            when (glyph) {
                Glyph.CALENDAR -> {
                    box(3f, 5f, 18f, 16f)
                    line(3f, 10f, 21f, 10f)
                    line(8f, 3f, 8f, 7f)
                    line(16f, 3f, 16f, 7f)
                }
                Glyph.TRUCK -> {
                    box(2f, 6f, 12f, 12f)
                    path(14f to 10f, 19f to 10f, 22f to 14f, 22f to 18f, 20f to 18f)
                    circle(6f, 18f, 2f)
                    circle(18f, 18f, 2f)
                }
                Glyph.QR -> {
                    box(3f, 3f, 6f, 6f, 1f)
                    box(15f, 3f, 6f, 6f, 1f)
                    box(3f, 15f, 6f, 6f, 1f)
                    line(14f, 13f, 14f, 17f)
                    path(18f to 13f, 21f to 13f, 21f to 17f, 18f to 17f, 18f to 21f, 14f to 21f)
                    line(21f, 20f, 21f, 21f)
                }
                Glyph.MAP -> {
                    path(
                        3f to 5f,
                        9f to 3f,
                        15f to 6f,
                        21f to 3f,
                        21f to 19f,
                        15f to 22f,
                        9f to 19f,
                        3f to 21f,
                        3f to 5f,
                    )
                    line(9f, 3f, 9f, 19f)
                    line(15f, 6f, 15f, 22f)
                }
                Glyph.MORE -> {
                    for (x in listOf(5f, 12f, 19f)) drawCircle(color, 1.8f, Offset(x, 12f))
                }
                Glyph.BELL -> {
                    val p =
                        Path().apply {
                            moveTo(4f, 17f)
                            quadraticTo(7f, 14f, 7f, 9f)
                            cubicTo(7f, 2f, 17f, 2f, 17f, 9f)
                            quadraticTo(17f, 14f, 20f, 17f)
                            close()
                        }
                    drawPath(p, color, style = stroke)
                    line(10f, 21f, 14f, 21f)
                }
                Glyph.BRANCH -> {
                    box(5f, 8f, 14f, 13f, 0f)
                    path(3f to 8f, 12f to 3f, 21f to 8f)
                    box(10f, 15f, 4f, 6f, 0f)
                    line(8f, 11f, 8f, 12f)
                    line(16f, 11f, 16f, 12f)
                }
                Glyph.PIN -> {
                    val p =
                        Path().apply {
                            moveTo(12f, 22f)
                            cubicTo(8f, 17f, 4f, 13f, 4f, 9f)
                            cubicTo(4f, -1f, 20f, -1f, 20f, 9f)
                            cubicTo(20f, 13f, 16f, 17f, 12f, 22f)
                        }
                    drawPath(p, color, style = stroke)
                    circle(12f, 8f, 2.5f)
                }
                Glyph.CHEVRON -> path(9f to 5f, 16f to 12f, 9f to 19f)
                Glyph.ARROW -> {
                    line(3f, 12f, 21f, 12f)
                    path(15f to 6f, 21f to 12f, 15f to 18f)
                }
                Glyph.PERSON -> {
                    circle(12f, 7f, 4f)
                    val p =
                        Path().apply {
                            moveTo(3f, 22f)
                            cubicTo(3f, 11f, 21f, 11f, 21f, 22f)
                            close()
                        }
                    drawPath(p, color, style = stroke)
                }
                Glyph.HEADSET -> {
                    val p =
                        Path().apply {
                            moveTo(3f, 14f)
                            cubicTo(0f, 0f, 24f, 0f, 21f, 14f)
                        }
                    drawPath(p, color, style = stroke)
                    box(2f, 11f, 4f, 8f)
                    box(18f, 11f, 4f, 8f)
                    path(20f to 20f, 17f to 23f, 13f to 23f)
                }
                Glyph.LOGOUT -> {
                    path(9f to 3f, 3f to 3f, 3f to 21f, 9f to 21f)
                    line(9f, 12f, 22f, 12f)
                    path(16f to 6f, 22f to 12f, 16f to 18f)
                }
                Glyph.CHECK -> path(4f to 12f, 10f to 18f, 21f to 6f)
                Glyph.CAMERA -> {
                    box(2f, 6f, 20f, 15f)
                    circle(12f, 13f, 4f)
                    path(7f to 6f, 9f to 3f, 15f to 3f, 17f to 6f)
                }
                Glyph.REFRESH -> {
                    drawArc(color, 40f, 290f, false, Offset(3f, 3f), Size(18f, 18f), style = stroke)
                    path(21f to 3f, 21f to 9f, 15f to 9f)
                }
                Glyph.VOICE -> {
                    path(3f to 9f, 7f to 9f, 12f to 4f, 12f to 20f, 7f to 15f, 3f to 15f, 3f to 9f)
                    drawArc(
                        color,
                        -60f,
                        120f,
                        false,
                        Offset(11f, 6f),
                        Size(10f, 12f),
                        style = stroke,
                    )
                }
                Glyph.LOCATE -> {
                    circle(12f, 12f, 7f)
                    circle(12f, 12f, 2f)
                    line(12f, 1f, 12f, 5f)
                    line(12f, 19f, 12f, 23f)
                    line(1f, 12f, 5f, 12f)
                    line(19f, 12f, 23f, 12f)
                }
            }
        }
    }
}

@Composable
internal fun BrandLeaves(modifier: Modifier) {
    Canvas(modifier) {
        val path =
            Path().apply {
                moveTo(size.width * .65f, 0f)
                quadraticTo(size.width * .45f, size.height * .7f, size.width, size.height * .45f)
                lineTo(size.width, 0f)
                close()
            }
        drawPath(path, Gold.copy(alpha = .12f))
        val wave =
            Path().apply {
                moveTo(size.width * .55f, size.height)
                cubicTo(
                    size.width * .65f,
                    size.height * .35f,
                    size.width * .9f,
                    size.height * .8f,
                    size.width,
                    size.height * .25f,
                )
                lineTo(size.width, size.height)
                close()
            }
        drawPath(wave, Color.White.copy(alpha = .055f))
    }
}

@Composable
internal fun ProfileAvatar(
    profile: DriverProfile?,
    modifier: Modifier = Modifier.size(54.dp),
    allow: (String) -> Boolean = { false },
) {
    var bitmap by remember(profile?.avatar) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(profile?.avatar) {
        val raw = profile?.avatar
        if (raw != null && allow(raw))
            bitmap =
                withContext(Dispatchers.IO) {
                    runCatching {
                        val c = URL(raw).openConnection() as HttpURLConnection
                        try {
                            c.instanceFollowRedirects = false
                            c.connectTimeout = 5000
                            c.readTimeout = 5000
                            if (c.responseCode != 200) return@runCatching null
                            val bytes = c.inputStream.use { it.readBytesBounded(2097152) }
                            BitmapFactory.decodeByteArray(
                                bytes,
                                0,
                                bytes.size,
                                BitmapFactory.Options().apply { inSampleSize = 2 },
                            )
                        } finally {
                            c.disconnect()
                        }
                    }
                        .getOrNull()
                }
    }
    Box(
        modifier
            .clip(CircleShape)
            .background(Pale)
            .border(1.dp, Color.White.copy(alpha = .6f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null)
            Image(
                bitmap!!.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        else
            Text(
                profile
                    ?.name
                    ?.split(" ")
                    ?.take(2)
                    ?.mapNotNull { it.firstOrNull() }
                    ?.joinToString("") ?: "",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = Forest,
            )
    }
}

internal fun java.io.InputStream.readBytesBounded(max: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (true) {
        val count = read(buffer)
        if (count < 0) break
        out.write(buffer, 0, count)
        require(out.size() <= max)
    }
    return out.toByteArray()
}

@Composable
internal fun DriverCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 3.dp,
    ) {
        Column(content = content)
    }
}

@Composable
internal fun ActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    outlined: Boolean = false,
) {
    if (outlined)
        OutlinedButton(
            onClick,
            modifier.heightIn(min = 48.dp),
            enabled = enabled,
            shape = RoundedCornerShape(22.dp),
            border = BorderStroke(1.dp, DeepGreen),
        ) {
            Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    else
        Button(
            onClick,
            modifier.heightIn(min = 48.dp),
            enabled = enabled,
            shape = RoundedCornerShape(22.dp),
        ) {
            Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
}

@Composable
internal fun StatusPill(label: String, background: Color = Pale, color: Color = Forest) {
    Text(
        label,
        color = color,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier.clip(RoundedCornerShape(24.dp))
                .background(background)
                .padding(horizontal = 12.dp, vertical = 4.dp),
        maxLines = 2,
    )
}

@Composable
internal fun IconAction(label: String, glyph: Glyph, onClick: () -> Unit, color: Color = Forest) {
    IconButton(onClick, modifier = Modifier.size(48.dp).semantics { contentDescription = label }) {
        DriverIcon(glyph, color = color)
    }
}

@Composable
internal fun LineItem(glyph: Glyph, text: String, color: Color = Forest, sub: String? = null) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        DriverIcon(glyph, Modifier.size(21.dp), color)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text,
                color = color,
                fontSize = 14.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (!sub.isNullOrBlank())
                Text(
                    sub,
                    color = if (color == Color.White) Color.White.copy(alpha = .78f) else Muted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                )
        }
    }
}
