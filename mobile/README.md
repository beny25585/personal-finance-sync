# Android application setup

The Android foundation uses Vue 3, TypeScript, Vite, and Capacitor. Its startup screen and language selector run in Capacitor's Android WebView, with web assets and translations bundled in the APK. There is no Ionic UI framework, Expo, or React Native dependency. No financial screens, API connection, banking credentials, or synchronization are included. The existing Bun backend is unchanged.

## Prerequisites

| Component | Version |
| --- | --- |
| Vue | 3.5.44 |
| Vue I18n | 11.4.17 |
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
npm test
npm run build
```

`npm run build` runs the TypeScript check and Vite build, writing the web bundle to `dist/`. Dependency lifecycle scripts remain disabled unless separately reviewed. Optional browser development uses `npm run dev`, which binds to the local machine only.

## Hebrew and English

Vue I18n supplies interface translations from `src/i18n/locales/en.json` and `he.json`. All current Vue interface strings use translation keys. This translates the interface, not bank descriptions or other provider data.

At startup, a valid saved `en`/`he` choice takes precedence over device languages. Otherwise, the first supported device preference is used, including regional variants and the legacy Hebrew `iw` code. Unsupported preferences fall back to English. Automatic detection is not saved as an explicit choice.

The language selector updates text, document title, `lang`, and `dir` immediately: Hebrew uses RTL and English uses LTR. An explicit selection is saved under the non-sensitive localStorage key `personal-finance-sync.locale`. If storage is blocked, the selector still works for the session. Layout uses logical alignment and spacing for both directions.

`npm test` runs Node's built-in tests for language selection, persistence failures, and translation-key parity. Browser checks exercise the built UI, direction switching, and persistence after reload:

```bash
npm run build
npm run test:browser
```

Browser checks require Chromium and the existing root `puppeteer-core` dependency (install the backend dependencies with Bun). Set `CHROME_PATH` if Chromium is not at `/usr/bin/chromium`. Only in a container unable to use Chromium's sandbox, the local synthetic-UI test accepts `BROWSER_NO_SANDBOX=1`; this does not alter Android or bank-scraper settings. The test serves only local bundled assets and blocks external page requests.

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

Compilation, APK inspection, and launching on a device are separate verification steps. The user reported that the initial 0.1.0 startup screen opened on their phone. The updated bilingual controls have not yet been verified on an Android device. This setup does not establish bank connectivity or an application-to-server connection.

## Verified in the development environment

On 2026-11-02, the Vue TypeScript check, Vite production build, and Android `assembleDebug` completed successfully. APK signature verification passed, and every file from `dist/` was verified byte-for-byte inside the APK. Its packaged Capacitor configuration has no remote `server.url`.

The startup screen also rendered without JavaScript errors in Chromium at a 390×844 viewport. That was a web-preview smoke check, not an Android device/emulator launch.

For version 0.2.0, all 17 language-policy tests and 4 browser i18n tests passed. TypeScript, the Vite build, Android assembly, APK signature, and bundled-asset checks also passed. Android versionCode is 2 so this development build can update the initial preview without changing its application ID.
