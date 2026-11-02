# Android application setup

Stage 1 adds an Android application using Vue 3, TypeScript, Vite, and Capacitor. The minimal startup screen runs in Capacitor's Android WebView, with its web assets bundled in the APK. There is no Ionic UI framework, Expo, or React Native dependency. No financial screens, API connection, banking credentials, or synchronization are included. The existing Bun backend is unchanged.

## Prerequisites

| Component | Version |
| --- | --- |
| Vue | 3.5.44 |
| Capacitor core, CLI, Android | 8.6.0 |
| JDK | 21 |
| Android compile/target SDK | 36 |
| Android minimum SDK | 24, Android 7.0 |
| Android Gradle Plugin | 8.13.0 |
| Gradle wrapper | 8.14.3 |

The Node.js engine range is `^22.18.0 || >=24.12.0`: Node 22.18+ within the 22.x series, or Node 24.12+ and newer major versions. Use the application-local npm dependencies and lockfile, separate from the repository root's Bun setup.

Install Android Studio or Android command-line tools, the Android SDK 36 platform, and platform tools. Review the required SDK licenses during installation. Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the SDK directory; make `adb` available on your PATH. Keep machine-specific SDK paths and `android/local.properties` out of Git.

## Install and check

Run from `mobile/`:

```bash
npm ci --ignore-scripts
npm run typecheck
npm run build
```

`npm run build` runs the TypeScript check and Vite build, writing the web bundle to `dist/`. Dependency lifecycle scripts remain disabled unless separately reviewed. Optional browser development uses `npm run dev`, which binds to the local machine only.

## Sync and build Android

Copy the current web bundle and native dependency configuration into Android:

```bash
npm run android:sync
```

To build an installable development APK:

```bash
npm run apk
```

The APK command runs the web build and Capacitor sync before Gradle's `assembleDebug`. Its output path is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The application ID is `com.personalfinancesync.preview`. The debug APK contains the synchronized local web assets and does not require a running Vite server. `capacitor.config.ts` uses `webDir: 'dist'` without a remote `server.url`; this is not a hosted-page wrapper or a configured connection to the finance backend.

The Android tools use their local debug signing key outside Git. This is development signing only; no production signing key, store account, or deployment is configured. Keystores, APKs, dependencies, SDK paths, copied web assets, and generated native build output are ignored by Git.

With a connected and authorized Android device, install locally using:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Compilation, APK inspection, and launching on a device are separate verification steps. Native device launch has not yet been verified. This setup does not establish bank connectivity or an application-to-server connection.

## Verified in the development environment

On 2026-11-02, the Vue TypeScript check, Vite production build, and Android `assembleDebug` completed successfully. APK signature verification passed, and every file from `dist/` was verified byte-for-byte inside the APK. Its packaged Capacitor configuration has no remote `server.url`.

The startup screen also rendered without JavaScript errors in Chromium at a 390×844 viewport. That was a web-preview smoke check, not an Android device/emulator launch.
