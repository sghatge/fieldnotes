plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android { namespace="com.fieldnotes.privatework"; compileSdk=35; defaultConfig { applicationId="com.fieldnotes.privatework"; minSdk=26; targetSdk=35; versionCode=2; versionName="0.2.0" } }
dependencies {
    // Bundled Latin OCR model: runs offline immediately after install.
    implementation("com.google.mlkit:text-recognition:16.0.1")
}
