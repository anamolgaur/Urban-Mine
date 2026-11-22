# Urban Mine for Android

A small Android app (Trusted Web Activity) that opens https://urban-mine-api.onrender.com full screen.
It has no code of its own: every change pushed to Render shows up in the app too. Phones without Chrome use a built-in WebView.

Build (needs the Android SDK and the signing key, which is NOT in this repo):

    export ANDROID_HOME=/path/to/android-sdk
    export UM_KEYSTORE=/path/to/urbanmine.keystore UM_KEYSTORE_PASSWORD=...
    gradle assembleRelease
    cp app/build/outputs/apk/release/app-release.apk ../web/public/downloads/urban-mine.apk

Keep the keystore safe: Android only accepts updates signed with the same key.
The key's SHA-256 fingerprint is published at /.well-known/assetlinks.json by the server, which is what removes the browser bar.
