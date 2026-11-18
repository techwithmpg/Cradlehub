package com.mpgtechnologies.cradlehub.driver

import android.content.Context
import java.net.HttpCookie
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.*
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

internal class NativeAuthExpired : Exception("Sign in again")

internal class NativeSignInFailure(message: String) : Exception(message)

internal object NativeTargetPolicy {
    fun allowed(
        target: String,
        api: String,
        supabase: String,
        key: String,
        ownerPhone: Boolean = false,
    ): Boolean = runCatching {
        val urls = listOf(URI(api), URI(supabase))
        (target == "TEST" || (target == "PRODUCTION" && ownerPhone)) &&
            urls.all {
                it.scheme == "https" &&
                    it.host != null &&
                    it.userInfo == null &&
                    it.query == null &&
                    it.fragment == null &&
                    (it.path.isNullOrEmpty() || it.path == "/") &&
                    it.port in listOf(-1, 443) &&
                    !it.host.lowercase().endsWith(".invalid") &&
                    (target == "PRODUCTION" ||
                        it.host.lowercase() !in
                            setOf(
                                "www.cradlewellnessliving.com",
                                "cradlewellnessliving.com",
                                "lsrbwqhvzjfpiabeolkv.supabase.co",
                            ))
            } &&
            (target != "PRODUCTION" ||
                (urls[0].host.equals("www.cradlewellnessliving.com", true) &&
                    urls[1].host.equals("lsrbwqhvzjfpiabeolkv.supabase.co", true))) &&
            publicKey(key)
    }
        .getOrDefault(false)

    fun publicKey(key: String): Boolean = runCatching {
        if (key.startsWith("sb_publishable_") && key.length > 30) return true
        if (key.startsWith("sb_secret_") || key.split('.').size != 3) return false
        JSONObject(
                String(java.util.Base64.getUrlDecoder().decode(key.split('.')[1]), Charsets.UTF_8)
            )
            .optString("role") == "anon"
    }
        .getOrDefault(false)
}

/**
 * Native client for EXISTING password auth, PostgREST/RLS reads and reviewed cookie APIs. No new
 * server endpoint, privileged key, local status writer or WebView is introduced.
 */
internal class NativeDriverBackend(context: Context) {
    private fun normalizeOrigin(raw: String): String {
        val uri = URI(raw)
        return "${uri.scheme}://${uri.host.lowercase()}" +
            (if (uri.port in listOf(-1, 443)) "" else ":${uri.port}")
    }

    private val store = NativeSessionStore(context.applicationContext)
    private val api = normalizeOrigin(BuildConfig.NATIVE_API_ORIGIN)
    private val supabase = normalizeOrigin(BuildConfig.NATIVE_SUPABASE_URL)
    private val publicKey = BuildConfig.NATIVE_PUBLIC_KEY
    private val signature = "$api|$supabase"
    private var persisted =
        store.read()?.takeIf { it.optString("target") == signature }
            ?: JSONObject().put("target", signature)
    private var session: JSONObject? = persisted.optJSONObject("session")
    private var serverNow: Instant? = null
    val configured
        get() =
            NativeTargetPolicy.allowed(
                BuildConfig.NATIVE_TARGET,
                api,
                supabase,
                publicKey,
                BuildConfig.NATIVE_OWNER_PHONE,
            )

    val hasSession
        get() = session != null

    private val cookieKey
        get() = "sb-${URI(supabase).host.lowercase().substringBefore('.')}-auth-token"

    private fun save() {
        persisted.put("session", session ?: JSONObject.NULL)
        store.write(persisted)
    }

    private fun requireTarget() {
        check(configured) { "Connection not configured" }
    }

    @Synchronized
    fun signIn(email: String, password: String) {
        requireTarget()
        require(email.length <= 320 && password.length <= 4096)
        val reply =
            request(
                supabase + "/auth/v1/token?grant_type=password",
                JSONObject().put("email", email.trim()).put("password", password),
                auth = false,
            )
        if (reply.status !in 200..299)
            throw NativeSignInFailure(
                when (reply.body.optString("error_code", reply.body.optString("code"))) {
                    "invalid_credentials" -> "Email or password was not accepted."
                    "email_not_confirmed" -> "Confirm your email before signing in."
                    "over_request_rate_limit",
                    "over_email_send_rate_limit" -> "Too many attempts. Wait and try again."
                    else -> "Sign-in was not accepted. Try again."
                }
            )
        try {
            acceptSession(reply.body)
        } catch (error: Exception) {
            if (BuildConfig.DEBUG)
                android.util.Log.w(
                    "CradleDriverAuth",
                    "session_storage_failed type=${error.javaClass.simpleName}",
                )
            throw NativeSignInFailure(
                "Secure session storage is unavailable. Restart the app and try again."
            )
        }
        try {
            verifiedUser()
        } catch (error: Exception) {
            if (BuildConfig.DEBUG)
                android.util.Log.w(
                    "CradleDriverAuth",
                    "user_verification_failed type=${error.javaClass.simpleName}",
                )
            throw NativeSignInFailure(
                "Account verification failed. Check your connection and try again."
            )
        }
    }

    fun checkConnection() {
        request(supabase + "/auth/v1/settings", null, auth = false)
    }

    fun fetchTripPlans(): List<TripsJourney>? =
        try {
            val reply = request(api + "/api/staff/driver/journeys", null, web = true)
            if (reply.status == 401) {
                clear()
                throw NativeAuthExpired()
            }
            if (reply.status == 200 && reply.body.optBoolean("ok")) {
                NativeTripsPolicy.parseTripPlans(reply.body.optJSONArray("tripPlans"))
            } else null
        } catch (error: Exception) {
            if (error is NativeAuthExpired) throw error
            null
        }

    private fun acceptSession(value: JSONObject) {
        require(
            value.getString("access_token").length > 40 &&
                value.getString("refresh_token").isNotBlank()
        )
        if (!value.has("expires_at"))
            value.put("expires_at", Instant.now().epochSecond + value.getLong("expires_in"))
        session = value
        save()
    }

    @Synchronized
    private fun token(): String {
        requireTarget()
        val current = session ?: throw NativeAuthExpired()
        if (current.optLong("expires_at", 0) <= Instant.now().epochSecond + 60) {
            val reply =
                request(
                    supabase + "/auth/v1/token?grant_type=refresh_token",
                    JSONObject().put("refresh_token", current.getString("refresh_token")),
                    auth = false,
                )
            if (reply.status == 400 || reply.status == 401) {
                clear()
                throw NativeAuthExpired()
            }
            if (reply.status !in 200..299) throw Exception("Connection unavailable")
            acceptSession(reply.body)
        }
        return session!!.getString("access_token")
    }

    private fun verifiedUser(): JSONObject {
        val reply = request(supabase + "/auth/v1/user", null, bearer = token())
        if (reply.status == 401) {
            clear()
            throw NativeAuthExpired()
        }
        check(reply.status == 200) { "Account unavailable" }
        require(DriverTripPolicy.validId(reply.body.getString("id")))
        return reply.body
    }

    private fun read(path: String): JSONArray {
        val reply = request(supabase + "/rest/v1/" + path, null, bearer = token())
        if (reply.status == 401) {
            clear()
            throw NativeAuthExpired()
        }
        check(reply.status == 200) { "Unable to refresh account data" }
        return reply.array ?: throw Exception("Invalid server response")
    }

    private fun rpc(name: String, body: JSONObject = JSONObject()): DriverHttp.Reply =
        request(supabase + "/rest/v1/rpc/" + name, body, bearer = token()).let {
            DriverHttp.Reply(it.status, it.body)
        }

    fun workspace(): DriverWorkspace {
        val user = verifiedUser()
        val staff =
            read(
                "staff?select=id,full_name,nickname,branch_id,system_role,staff_type,is_active,avatar_url,phone&archived_at=is.null&merged_into_staff_id=is.null&auth_user_id=eq.${user.getString("id")}&is_active=eq.true&limit=2"
            )
        require(staff.length() == 1) { "Driver account required" }
        val s = staff.getJSONObject(0)
        val role = s.optString("system_role")
        val type = s.optString("staff_type")
        require(
            (role == "driver" || type == "driver") &&
                role !in
                    setOf(
                        "owner",
                        "manager",
                        "assistant_manager",
                        "store_manager",
                        "digital_marketer",
                    ) &&
                type != "managerial"
        ) {
            "Driver account required"
        }
        val id = s.getString("id")
        val branchId = s.getString("branch_id")
        require(DriverTripPolicy.validId(id) && DriverTripPolicy.validId(branchId))
        val branch =
            read("branches?select=name,phone&is_active=eq.true&id=eq.$branchId&limit=1")
                .optJSONObject(0) ?: throw Exception("Assigned branch unavailable")
        val profile =
            DriverProfile(
                id,
                s.nullableText("nickname") ?: s.getString("full_name"),
                branchId,
                branch.getString("name"),
                s.nullableText("avatar_url"),
                branch.nullableText("phone"),
                user.nullableText("email"),
            )
        val today =
            (serverNow ?: throw Exception("Server time unavailable"))
                .atZone(ZoneId.of("Asia/Manila"))
                .toLocalDate()
        val failures = mutableSetOf<String>()
        var partial: String? = null
        var parsedTripPlans: List<TripsJourney>? = null
        val trips =
            try {
                val journeys = call("/api/staff/driver/journeys", null)
                if (journeys.status == 401) throw NativeAuthExpired()
                if (
                    NativeDriverCompatibility.legacyRead(
                        journeys.status,
                        journeys.body.optString("code"),
                    )
                ) {
                    parsedTripPlans = emptyList()
                    val rows =
                        read(
                            "bookings?select=id,driver_id,branch_id,delivery_type,status,booking_date,start_time,booking_progress_status,metadata,customers(full_name),therapist:staff!staff_id(full_name,nickname),branches(name)&driver_id=eq.$id&branch_id=eq.$branchId&delivery_type=eq.home_service&status=in.(confirmed,in_progress)&booking_date=gte.${today.minusDays(30)}&booking_date=lte.${today.plusDays(14)}&order=booking_date.asc,start_time.asc&limit=200"
                        )
                    check(rows.length() < 200) { "Trip list requires a narrower dispatch scope" }
                    (0 until rows.length())
                        .map { DriverTripPolicy.parseLegacy(rows.getJSONObject(it), id, branchId) }
                        .toMutableList()
                } else {
                    check(journeys.status == 200 && journeys.body.optBoolean("ok"))
                    parsedTripPlans =
                        NativeTripsPolicy.parseTripPlans(journeys.body.optJSONArray("tripPlans"))
                    val rows = journeys.body.getJSONArray("journeys")
                    (0 until rows.length())
                        .map { DriverTripPolicy.parse(rows.getJSONObject(it)) }
                        .toMutableList()
                }
            } catch (error: Exception) {
                if (error is NativeAuthExpired) throw error
                failures.add("trips")
                partial = "Trips unavailable"
                mutableListOf<DriverTrip>()
            }
        val attendance = runCatching {
            read(
                "staff_shift_checkins?select=shift_date,status,checked_in_at,checked_out_at,clock_out_confirmation_required,provisional_clock_out_at&is_test=eq.false&staff_id=eq.$id&branch_id=eq.$branchId&order=checked_in_at.desc&limit=30"
            )
        }
            .getOrElse {
                if (it is NativeAuthExpired) throw it
                failures.add("attendance")
                partial = partial ?: "Attendance unavailable"
                JSONArray()
            }
        val last = attendance.optJSONObject(0)
        val shift =
            when {
                last == null && "attendance" in failures -> "Unavailable"
                last == null -> "Off duty"
                last.optBoolean("clock_out_confirmation_required") ||
                    last.nullableText("provisional_clock_out_at") != null ->
                    "Clock-out needs review"
                last.optString("status") == "checked_in" && last.isNull("checked_out_at") ->
                    "On duty"
                else -> "Off duty"
            }
        val history = runCatching {
            read(
                "bookings?select=id,booking_date,start_time,booking_progress_status,customers(full_name),branches(name)&driver_id=eq.$id&branch_id=eq.$branchId&delivery_type=eq.home_service&status=eq.completed&booking_date=gte.${today.minusDays(30)}&order=booking_date.desc,start_time.desc&limit=100"
            )
        }
            .getOrElse {
                if (it is NativeAuthExpired) throw it
                failures.add("history")
                partial = partial ?: "History unavailable"
                JSONArray()
            }
        val openIds = trips.map { it.id }.toSet()
        for (i in 0 until history.length()) {
            val row = history.getJSONObject(i)
            if (row.getString("id") in openIds) continue
            val customer =
                row.optJSONObject("customers")?.nullableText("full_name") ?: "Service record"
            trips.add(
                DriverTrip(
                    row.getString("id"),
                    0,
                    "service_history",
                    null,
                    customer,
                    "",
                    LocalDate.parse(row.getString("booking_date")),
                    row.getString("start_time"),
                    row.optJSONObject("branches")?.optString("name") ?: profile.branch,
                    "Service completed",
                    serviceHistory = true,
                )
            )
        }
        val notices = runCatching {
            read(
                "workspace_notifications?select=id,title,body,entity_id,entity_type&recipient_staff_id=eq.$id&target_workspace=eq.driver&order=created_at.desc&limit=50"
            )
        }
            .getOrElse {
                if (it is NativeAuthExpired) throw it
                failures.add("notices")
                partial = partial ?: "Notifications unavailable"
                JSONArray()
            }
        val noticeList =
            (0 until notices.length()).map {
                val n = notices.getJSONObject(it)
                DriverNotice(
                    n.getString("id"),
                    n.optString("title"),
                    n.optString("body"),
                    if (n.optString("entity_type") == "booking") n.nullableText("entity_id")
                    else null,
                )
            }
        val records =
            (0 until attendance.length()).map {
                val a = attendance.getJSONObject(it)
                AttendanceRecord(
                    a.optString("shift_date"),
                    if (a.optBoolean("clock_out_confirmation_required")) "Review clock-out"
                    else if (a.isNull("checked_out_at")) "Checked in" else "Checked out",
                    a.nullableText("checked_in_at"),
                    a.nullableText("checked_out_at"),
                )
            }
        return DriverWorkspace(
            profile,
            trips,
            shift,
            records,
            noticeList,
            Instant.now(),
            today,
            partial,
            failures,
            parsedTripPlans,
        )
    }

    @Synchronized
    fun call(path: String, payload: JSONObject?): DriverHttp.Reply {
        require(path.startsWith("/api/staff/driver/") || path == "/api/attendance/public-scan")
        require(!path.contains("..") && !path.contains("#"))
        token()
        val reply = request(api + path, payload, web = true)
        if (reply.status == 401) {
            clear()
            throw NativeAuthExpired()
        }
        return DriverHttp.Reply(reply.status, reply.body)
    }

    fun validateScan(raw: String) = NativeQrPolicy.publicCode(raw, api)

    fun scan(raw: String, requestId: String, location: JSONObject? = null): JSONObject {
        val code = NativeQrPolicy.publicCode(raw, api)
        val reply =
            call(
                "/api/attendance/public-scan",
                JSONObject()
                    .put("publicCode", code)
                    .put("requestId", requestId)
                    .put("location", location ?: JSONObject.NULL),
            )
        check(reply.status in 200..299) { "Scan not confirmed" }
        return reply.body
    }

    fun registerDevice(token: String, enabled: Boolean): Boolean {
        if (!hasSession || !configured) return false
        val install =
            synchronized(this) {
                persisted.optString("installation").ifBlank {
                    UUID.randomUUID().toString().also {
                        persisted.put("installation", it)
                        save()
                    }
                }
            }
        val reply =
            call(
                "/api/staff/driver/native-device",
                JSONObject()
                    .put("installationId", install)
                    .put("token", token)
                    .put("enabled", enabled),
            )
        return reply.status == 200 && reply.body.optBoolean("ok")
    }

    fun signOut(): Boolean {
        var revoked = false
        try {
            if (hasSession && configured) {
                runCatching { rpc("driver_native_revoke_session") }
                val reply = request(supabase + "/auth/v1/logout", JSONObject(), bearer = token())
                revoked = reply.status in 200..299
            }
        } finally {
            clear()
        }
        return revoked
    }

    @Synchronized
    fun clear() {
        session = null
        persisted = JSONObject().put("target", signature)
        store.clear()
    }

    fun avatarAllowed(raw: String): Boolean = runCatching {
        val u = URI(raw)
        u.scheme == "https" &&
            u.host in setOf(URI(supabase).host, URI(api).host) &&
            u.userInfo == null
    }
        .getOrDefault(false)

    private data class Wire(val status: Int, val body: JSONObject, val array: JSONArray? = null)

    private fun request(
        url: String,
        body: JSONObject?,
        auth: Boolean = true,
        bearer: String? = null,
        web: Boolean = false,
    ): Wire {
        requireTarget()
        val uri = URI(url)
        require(
            uri.scheme == "https" &&
                uri.host in setOf(URI(api).host, URI(supabase).host) &&
                uri.userInfo == null
        )
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.useCaches = false
            connection.setRequestProperty(
                "User-Agent",
                "CradleHubDriverAndroid/3.0 (Android ${android.os.Build.VERSION.RELEASE})",
            )
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            if (web) {
                connection.setRequestProperty("Origin", api)
                val ssr =
                    NativeSsrSession.cookies(
                        cookieKey,
                        (session ?: throw NativeAuthExpired()).toString(),
                    )
                val jar = persisted.optJSONArray("cookies") ?: JSONArray()
                val device =
                    (0 until jar.length())
                        .mapNotNull { index ->
                            val entry = jar.optJSONObject(index) ?: return@mapNotNull null
                            if (entry.optLong("expiresAt", 0) <= System.currentTimeMillis())
                                return@mapNotNull null
                            runCatching { HttpCookie.parse(entry.getString("raw")).first() }
                                .getOrNull()
                        }
                        .filter {
                            !it.name.startsWith("sb-") && uri.path.startsWith(it.path ?: "/")
                        }
                        .joinToString("; ") { it.name + "=" + it.value }
                connection.setRequestProperty(
                    "Cookie",
                    ssr + (if (device.isBlank()) "" else "; $device"),
                )
            } else {
                connection.setRequestProperty("apikey", publicKey)
                if (auth || bearer != null)
                    connection.setRequestProperty("Authorization", "Bearer " + (bearer ?: token()))
            }
            if (body != null) {
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                require(bytes.size < 16384)
                connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            if (BuildConfig.DEBUG)
                android.util.Log.i(
                    "CradleDriverHttp",
                    "response channel=${if (web) "web" else if (uri.path.startsWith("/auth/")) "auth" else "data"} status=$status",
                )
            connection
                .getHeaderFieldDate("Date", 0)
                .takeIf { it > 0 }
                ?.let { serverNow = Instant.ofEpochMilli(it) }
            if (web) {
                val existing = persisted.optJSONArray("cookies") ?: JSONArray()
                val cookies = mutableMapOf<String, JSONObject>()
                for (i in 0 until existing.length()) {
                    val entry = existing.optJSONObject(i) ?: continue
                    runCatching { HttpCookie.parse(entry.getString("raw")).first() }
                        .getOrNull()
                        ?.let {
                            if (entry.optLong("expiresAt", 0) > System.currentTimeMillis())
                                cookies[it.name] = entry
                        }
                }
                connection.headerFields
                    .filterKeys { it?.equals("Set-Cookie", true) == true }
                    .values
                    .flatten()
                    .forEach { raw ->
                        runCatching { HttpCookie.parse(raw).first() }
                            .getOrNull()
                            ?.let { c ->
                                if (
                                    !c.name.startsWith("sb-") &&
                                        (c.domain == null || c.domain.trimStart('.') == uri.host)
                                ) {
                                    if (c.maxAge == 0L) cookies.remove(c.name)
                                    else
                                        cookies[c.name] =
                                            JSONObject()
                                                .put("raw", raw)
                                                .put(
                                                    "expiresAt",
                                                    if (c.maxAge < 0) Long.MAX_VALUE
                                                    else
                                                        System.currentTimeMillis() +
                                                            c.maxAge.coerceAtMost(31536000L) * 1000,
                                                )
                                }
                            }
                    }
                persisted.put("cookies", JSONArray(cookies.values.toList()))
                save()
            }
            val input = if (status >= 400) connection.errorStream else connection.inputStream
            val text =
                input?.use {
                    val bytes = it.readBytesBounded(1048576)
                    String(bytes, Charsets.UTF_8)
                } ?: "{}"
            return if (text.trimStart().startsWith("[")) Wire(status, JSONObject(), JSONArray(text))
            else
                Wire(
                    status,
                    when {
                        text.isBlank() || text == "null" -> JSONObject()
                        text.trimStart().startsWith("{") -> JSONObject(text)
                        status !in 200..299 &&
                            !connection.contentType.orEmpty().contains("json", true) -> JSONObject()
                        else -> JSONObject().put("value", org.json.JSONTokener(text).nextValue())
                    },
                )
        } catch (error: Exception) {
            if (BuildConfig.DEBUG)
                android.util.Log.w(
                    "CradleDriverHttp",
                    "request_failed channel=${if (web) "web" else if (uri.path.startsWith("/auth/")) "auth" else "data"} type=${error.javaClass.simpleName}",
                )
            throw error
        } finally {
            connection.disconnect()
        }
    }
}
