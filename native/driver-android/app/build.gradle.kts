plugins {
  id("com.android.application")
}

// This module preserves the existing Google Navigation SDK foundation. The
// Android Staff shell uses the same role-aware Web routes and server logic.
if (file("google-services.json").exists()) {
  apply(plugin = "com.google.gms.google-services")
}

val staffOrigin = providers.gradleProperty("CRADLE_STAFF_ORIGIN")
  .orElse("https://www.cradlewellnessliving.com").get()
require(Regex("^https://[A-Za-z0-9.-]+(?::443)?$").matches(staffOrigin)) {
  "CRADLE_STAFF_ORIGIN must be one explicit HTTPS origin (no path or credentials)."
}

android {
  namespace = "com.mpgtechnologies.cradlehub.driver"
  compileSdk = 36

  defaultConfig {
    // Existing provisional package ID retained to avoid silently breaking
    // native Navigation SDK / Firebase / signing configuration.
    applicationId = "com.mpgtechnologies.cradlehub.driver"
    minSdk = 24
    targetSdk = 36
    versionCode = 2
    versionName = "0.2.0-staff-shell-review"
    manifestPlaceholders["CRADLE_NAVIGATION_API_KEY"] =
      providers.gradleProperty("CRADLE_NAVIGATION_API_KEY").orElse("").get()
    buildConfigField("String", "STAFF_ORIGIN", "\"$staffOrigin\"")
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    isCoreLibraryDesugaringEnabled = true
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false // release needs independent device/security acceptance
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
