plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The Android app wraps the same web app the website serves (src/outputs/app).
// It is copied in at build time so the two can never drift apart again; only the
// Android-specific bridge lives in src/main/assets/www/native-bridge.js.
val webAppDir = rootProject.file("../src/outputs/app")
val generatedWebAssets = layout.buildDirectory.dir("generated/webapp")

val syncWebApp by tasks.registering(Sync::class) {
    description = "Copies the shared Fieldnotes web app into the Android assets."
    from(webAppDir) {
        include("app.js", "index.html")
        filesMatching("index.html") {
            filter { line ->
                line
                    // Load the Android bridge right after the shared app.
                    .replace(
                        "<script src=\"app.js\"></script>",
                        "<script src=\"app.js\"></script><script src=\"native-bridge.js\"></script>"
                    )
                    // Web-only: no service worker, manifest or favicon inside the APK.
                    .replace(Regex("<script>if\\('serviceWorker'in navigator\\)[^<]*</script>"), "")
                    .replace("<link rel=\"manifest\" href=\"../manifest.webmanifest\">", "")
                    .replace("<link rel=\"icon\" href=\"../icon.svg\">", "")
            }
        }
    }
    into(generatedWebAssets.map { it.dir("www") })
    doLast {
        val html = generatedWebAssets.get().file("www/index.html").asFile
        check(html.exists()) { "Web app not found at $webAppDir" }
        check(html.readText().contains("native-bridge.js")) {
            "index.html changed: could not inject native-bridge.js. Update syncWebApp in app/build.gradle.kts."
        }
    }
}

android {
    namespace = "com.fieldnotes.privatework"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fieldnotes.privatework"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
    }

    sourceSets["main"].assets.srcDir(generatedWebAssets)

    // Java and Kotlin must target the same JVM version, or compileDebugKotlin fails.
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(syncWebApp) }

dependencies {
    // Bundled Latin OCR model: runs offline immediately after install.
    implementation("com.google.mlkit:text-recognition:16.0.1")
}
