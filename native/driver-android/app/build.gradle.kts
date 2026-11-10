plugins {
  id("com.android.application")
}

// This module is buildable as an SDK foundation before Firebase app
// registration. Firebase Messaging is inactive until the real Android
// google-services.json is supplied by the owner.
if (file("google-services.json").exists()) {
  apply(plugin = "com.google.gms.google-services")
}

android {
  namespace = "com.mpgtechnologies.cradlehub.driver"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.mpgtechnologies.cradlehub.driver"
    minSdk = 24
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0-preview"
    manifestPlaceholders["CRADLE_NAVIGATION_API_KEY"] =
      providers.gradleProperty("CRADLE_NAVIGATION_API_KEY").orElse("").get()
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    isCoreLibraryDesugaringEnabled = true
  }

  buildTypes {
    getByName("debug") {
      // Only an explicit build flag can select the local development server.
      // Normal APK builds and every release use the existing HTTPS origin.
      val debugOrigin = providers.gradleProperty("CRADLE_DRIVER_DEBUG_ORIGIN")
        .orElse("https://www.cradlewellnessliving.com").get()
      require(debugOrigin in setOf(
        "https://www.cradlewellnessliving.com",
        "http://localhost:7100"
      )) { "Unsupported Driver debug origin. Only local USB test port 7100 is allowed." }
      buildConfigField("String", "DRIVER_WEB_ORIGIN", "\"$debugOrigin\"")
    }
    getByName("release") {
      buildConfigField("String", "DRIVER_WEB_ORIGIN", "\"https://www.cradlewellnessliving.com\"")
      isMinifyEnabled = false // enable after SDK/consumer rules + native acceptance
    }
  }

  buildFeatures { buildConfig = true }
}

dependencies {
  implementation("com.google.android.libraries.navigation:navigation:8.1.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("androidx.core:core:1.17.0")
  implementation(platform("com.google.firebase:firebase-bom:35.1.0"))
  implementation("com.google.firebase:firebase-messaging")
  coreLibraryDesugaring("com.android.tools:desugar_jdk_libs_nio:2.1.5")
  testImplementation("junit:junit:4.13.2")
}
