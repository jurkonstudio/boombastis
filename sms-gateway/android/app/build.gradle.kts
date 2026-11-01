plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// URL dan anon key dibaca dari config.js di root repo (nilai publik yang sama dengan situs).
val cfgJs = rootProject.file("../../config.js")
fun cfg(key: String): String {
    if (!cfgJs.exists()) return ""
    val v = Regex(key + """\s*:\s*'([^']*)'""").find(cfgJs.readText())?.groupValues?.get(1) ?: ""
    return if (v.startsWith("ISI-")) "" else v
}

android {
    namespace = "id.jurkon.smsgateway"
    compileSdk = 34

    defaultConfig {
        applicationId = "id.jurkon.smsgateway"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.3"
        buildConfigField("String", "SB_URL", "\"" + cfg("url") + "\"")
        buildConfigField("String", "SB_ANON", "\"" + cfg("key") + "\"")
    }

    // Tanda tangan release: dibaca dari env (diisi oleh GitHub Actions dari Secrets).
    // Tanpa env ini, build lokal tetap jalan seperti biasa (debug).
    val ksFile = System.getenv("KEYSTORE_FILE")
    if (ksFile != null && file(ksFile).exists()) {
        signingConfigs {
            create("release") {
                storeFile = file(ksFile)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
        buildTypes {
            getByName("release") {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    lint {
        checkReleaseBuilds = false
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
