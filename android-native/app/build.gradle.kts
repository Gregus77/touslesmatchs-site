
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.touslesmatchs.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.touslesmatchs.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (project.findProperty("TLM_VERSION_CODE") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("TLM_VERSION_NAME") as String?) ?: "1.0.6"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.17.0"))
    implementation("com.google.firebase:firebase-messaging")
}
