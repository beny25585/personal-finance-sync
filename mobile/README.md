# Android application setup

The Android application uses Vue 3, TypeScript, Vite, and Capacitor. Its interface runs in Capacitor's Android WebView, with local assets and translations. The current source includes Dashboard, Connections, Transactions, Settings, and an empty transaction-detail sheet. The Vue components port the existing KolShek mobile layout rather than introduce a separate visual design. The existing React web application and Bun backend are unchanged.

This milestone is an unloaded interface. Following the original dashboard's empty layout, it shows a standalone empty state instead of metric cards, balances, charts, or recent records. There are no synthetic financial records, known-zero balances/counts, bank connections, API requests, or synchronization actions. Filters change only local interface state; filtering real records awaits the data connection. The detail route opens an empty sheet over the inert transaction page.

**APK workflow:** finish and review a meaningful source milestone first, then ask the user before creating another APK. Web builds, browser checks, and screenshots do not produce an APK. The current mobile UI has not been assembled or launched on Android; the previously built 0.2.0 APK still contains the earlier startup/language screen.

## Fidelity to the original

The reference is the existing implementation in `src/web/app/`, including its mobile layout, rather than the older `DESIGN_SYSTEM.md` description.

| Original source | Vue adaptation |
| --- | --- |
| `components/layout/app-shell.tsx` | `src/App.vue` and `styles.css`: content starts without a branded mobile header; 16px phone padding, 20px top spacing |
| `components/layout/mobile-nav.tsx` | `src/components/MobileNav.vue`: original tab order/icons, 56px bar, active text color, More bottom sheet and inline theme controls |
| `components/shared/page-header.tsx` | 20px/600 heading, 13px muted description |
| `components/shared/empty-state.tsx` | `src/components/EmptyState.vue`: standalone state, bare 48px icon, 18px title, 14px description, 48px vertical spacing |
| `pages/dashboard-page.tsx` empty branch | `src/views/OverviewView.vue`: Dashboard heading, empty state, link to Connections |
| `pages/providers-page.tsx` | `src/views/AccountsView.vue`: Connections heading/description, Unplug icon, standalone unloaded state |
| `components/transactions/filter-panel.tsx` | `src/views/TransactionsView.vue`: active chips, Clear All, search/Filters row, then From, To, Provider, Category, Status, Amount Range |
| `components/transactions/transaction-detail.tsx` | `src/views/TransactionDetailView.vue`: modal sheet at the reading direction's trailing edge, original no-selection fallback |
| `globals.css` | `src/kolshek-tokens.css`: copied light/dark custom properties, with reference tests against the original file |

Intentional adaptations and limits:

- Vue replaces React for the mobile interface. Backend hooks, authentication effects, data fetching, navigation counts, sync, and export actions are not copied into this disconnected preview.
- Dashboard and Transactions are available bottom tabs. Spending and Categories retain their original positions but are explicitly disabled; they have no invented routes or financial content. More opens Connections and the local Settings page. The remaining original pages are not ported in this milestone.
- Localized Settings and Hebrew/RTL support are additions requested for the Android app. Theme controls also appear in More, as in the original. The phone navigation remains available on wider previews; a desktop sidebar is not part of this Android milestone.
- Unloaded descriptions replace original wording such as “No accounts found” because no account lookup has occurred. Provider/category selectors stay disabled until actual lists can be loaded. The detail URL is an empty-state adapter until rows exist.
- Touch controls use at least 48px targets and physical Android safe-area insets. Native dialogs provide focus trapping, Escape dismissal, and modal semantics without adding a UI framework. The declared Inter/system font stack matches the original; no font download is configured, so actual glyph rendering depends on device fonts.

## Prerequisites

| Component | Version |
| --- | --- |
| Vue | 3.5.44 |
| Vue I18n | 11.4.17 |
| Vue Router | 4.6.4 |
| Lucide Vue (`@lucide/vue`) | 1.66.0 |
| Capacitor core, CLI, Android | 8.6.0 |
| JDK | 21 |
| Android compile/target SDK | 36 |
| Android minimum SDK | 24, Android 7.0 |
| Android Gradle Plugin | 8.13.0 |
| Gradle wrapper | 8.14.3 |

The Node.js engine range is `^22.18.0 || >=24.12.0`: Node 22.18+ within the 22.x series, or Node 24.12+ and newer major versions. Use the application-local npm dependencies and lockfile, separate from the repository root's Bun setup.

Vue Router is MIT-licensed; the maintained `@lucide/vue` package is ISC-licensed. Both permit commercial use subject to their license terms and notices. Icons are bundled rather than fetched. Hash-based routes work within the local Capacitor bundle without a routing server.

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

The language selector in Settings updates text, document title, `lang`, and `dir` immediately: Hebrew uses RTL and English uses LTR. An explicit selection is saved under the non-sensitive localStorage key `personal-finance-sync.locale`. If storage is blocked, the selector still works for the session. Layout uses logical alignment and spacing for both directions, with physical screen-safe insets.

## Appearance and navigation

Settings offers System, Light, and Dark modes. System is the default and follows live device-theme changes. Only an explicit selection writes `personal-finance-sync.theme`; automatic detection is not persisted. Storage errors keep both language and theme controls usable for the current session. These two UI preferences are the only application values saved locally by this shell.

Dashboard and Transactions navigate directly; More provides Connections and Settings, plus the original Light/Dark/System theme controls. The selected tab remains highlighted on its detail route, browser back works, and unknown routes return to Dashboard. Canonical routes are `/dashboard` and `/providers`; the earlier `/overview` and `/accounts` URLs redirect to them. Content leaves room for the bottom navigation. A keyboard skip link focuses the main content without changing the hash route.

`npm test` runs Node's built-in tests for language/theme selection, persistence failures, and translation-key parity. Browser checks exercise navigation, unloaded states, local search/filter controls, direction switching, themes, and persistence after reload:

```bash
npm run build
npm run test:browser
```

Browser checks require Chromium and the existing root `puppeteer-core` dependency (install the backend dependencies with Bun). Set `CHROME_PATH` if Chromium is not at `/usr/bin/chromium`. Only in a container unable to use Chromium's sandbox, the local empty-UI test accepts `BROWSER_NO_SANDBOX=1`; this does not alter Android or bank-scraper settings. The test serves only local bundled assets and rejects fetch/XHR/API calls and external page requests.

## Sync and build Android

Run these packaging steps only after the user has approved a new APK for the completed milestone.

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

For the subsequent UI-shell source milestone, TypeScript and the Vite production build passed, together with 29 Node tests and 12 Chromium browser tests. Browser checks covered both languages, all four tabs, back navigation, unknown routes, empty detail handling, local search/status/reset controls, a hash-safe keyboard skip link, storage failures, explicit preference persistence, and live system-theme changes. The checks rejected external requests and service calls. Local 390×844 screenshots were also inspected. No Android sync, Gradle assembly, APK creation, or device verification was performed for this milestone; those steps await approval for the next APK.

For the source-fidelity revision, TypeScript and the Vite build passed with 31 Node tests and 15 Chromium browser tests. The added reference tests compare both copied theme-token sets with the existing KolShek source. Browser checks cover the original tab order, explicitly disabled unavailable tabs, standalone Dashboard layout at 320px/390px in both languages, canonical/legacy routes, full filter order/reset, native detail dismissal, and More focus, backdrop/Escape dismissal, scroll restoration, and shared theme state. Network guards remain enabled.

The original React web bundle also built successfully. Its mobile empty layout was captured from a local static preview, with every service request intercepted offline and no finance backend running, for comparison with the Vue preview. This verifies visual reference and local interface behavior only. The source-fidelity revision has not been packaged into an APK or tested on Android.
