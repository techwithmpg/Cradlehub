plugins {
  id("com.android.application")
}

// Existing Android companion; do not add a second Driver PWA or backend.
// Firebase Messaging remains inactive until the owner supplies google-services.json.
if (file("google-services.json").exists()) {
  apply(plugin = "com.google.gms.google-services")
}

// Controlled TEST pilot: its own installable package and independently signed
// key. No production URL/credentials are ever the default for this variant.
val pilotWebOrigin = providers.gradleProperty("CRADLE_PILOT_WEB_ORIGIN").orNull?.trim().orEmpty()
val pilotKeyFile = providers.gradleProperty("CRADLE_PILOT_KEYSTORE_PATH").orNull?.trim().orEmpty()
val pilotStorePassword = providers.gradleProperty("CRADLE_PILOT_STORE_PASSWORD").orNull.orEmpty()
val pilotKeyAlias = providers.gradleProperty("CRADLE_PILOT_KEY_ALIAS").orNull.orEmpty()
val pilotKeyPassword = providers.gradleProperty("CRADLE_PILOT_KEY_PASSWORD").orNull.orEmpty()
val pilotVersion = providers.gradleProperty("CRADLE_PILOT_VERSION_CODE").orNull?.toIntOrNull()
val pilotSigningReady = listOf(pilotKeyFile, pilotStorePassword, pilotKeyAlias, pilotKeyPassword)
  .all { it.isNotBlank() }

fun isApprovedTestOrigin(raw: String): Boolean = try {
  val uri = java.net.URI(raw)
  val host = uri.host?.lowercase().orEmpty()
  uri.scheme == "https" &&
    host.contains(".") &&
    host != "www.cradlewellnessliving.com" &&
    host != "cradlewellnessliving.com" &&
    host != "localhost" &&
    !host.endsWith(".invalid") &&
    !host.endsWith(".local") &&
    !host.endsWith(".test") &&
    uri.userInfo == null &&
    uri.port == -1 &&
    (uri.path.isNullOrEmpty() || uri.path == "/") &&
    uri.query == null && uri.fragment == null
} catch (_: Exception) { false }

android {
  namespace = "com.mpgtechnologies.cradlehub.driver"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.mpgtechnologies.cradlehub.driver"
    minSdk = 24
    targetSdk = 36
    versionCode = pilotVersion ?: 1
    versionName = "0.1.0-preview"
    // Default/release builds retain the accepted main production origin.
    // Only the separately signed ".pilot" variant uses an isolated TEST URL.
    buildConfigField("String", "DRIVER_WEB_ORIGIN", "\"https://www.cradlewellnessliving.com\"")
    manifestPlaceholders["CRADLE_NAVIGATION_API_KEY"] =
      providers.gradleProperty("CRADLE_NAVIGATION_API_KEY").orElse("").get()
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    isCoreLibraryDesugaringEnabled = true
  }

  signingConfigs {
    create("pilot") {
      if (pilotSigningReady) {
        storeFile = file(pilotKeyFile)
        storePassword = pilotStorePassword
        keyAlias = pilotKeyAlias
        keyPassword = pilotKeyPassword
      }
    }
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false // preserve accepted native baseline
    }
    create("pilot") {
      initWith(getByName("release"))
      // Separate package prevents accidental overwrite of future driver release.
      applicationIdSuffix = ".pilot"
      versionNameSuffix = "-pilot"
      resValue("string", "app_name", "CradleHub Driver Pilot")
      val origin = pilotWebOrigin.ifBlank { "https://pilot.invalid" }
      buildConfigField("String", "DRIVER_WEB_ORIGIN", "\"$origin\"")
      if (pilotSigningReady) signingConfig = signingConfigs.getByName("pilot")
    }
  }

  buildFeatures { buildConfig = true }
}

// Fail before packaging any pilot APK without all review-gated inputs.
// Unit/compile checks can still build the isolated pilot source without secrets.
val validateDriverPilot = tasks.register("validateDriverPilot") {
  doLast {
    check(isApprovedTestOrigin(pilotWebOrigin)) {
      "Pilot APK requires an approved non-production HTTPS origin."
    }
    check(pilotSigningReady && file(pilotKeyFile).isFile) {
      "Pilot APK requires a persistent signing key and all four signing properties."
    }
    check(!providers.gradleProperty("CRADLE_NAVIGATION_API_KEY").orNull.isNullOrBlank()) {
      "Pilot APK requires an Android-restricted Navigation SDK API key."
    }
    check(pilotVersion != null && pilotVersion > 0) {
      "Pilot APK requires a positive per-build version code."
    }
  }
}
tasks.matching { it.name == "packagePilot" || it.name == "assemblePilot" }
  .configureEach { dependsOn(validateDriverPilot) }

dependencies {
  implementation("com.google.android.libraries.navigation:navigation:8.1.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("androidx.core:core:1.17.0")
  implementation(platform("com.google.firebase:firebase-bom:35.1.0"))
  implementation("com.google.firebase:firebase-messaging")
  coreLibraryDesugaring("com.android.tools:desugar_jdk_libs_nio:2.1.5")
  testImplementation("junit:junit:4.13.2")
}
