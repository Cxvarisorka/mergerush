# Merge Rush — Mobile Build and Release Checklist

Status (2026-11-23): Capacitor 8.6.2 is integrated, and the Android and iOS native projects
are generated and committed. **No native binary has been built or run yet.** This
environment cannot build iOS (needs macOS and Xcode) and has no Android emulator (no KVM).
An Android build needs the Android SDK, whose license must be accepted by you; see
"Building Android" below.

## What is in place

| Item | State |
|---|---|
| `capacitor.config.ts` | `webDir: 'dist'`, app name, background colour; **placeholder** `appId: com.mergerush.game` (Q24) |
| `android/` | Capacitor 8 project, minSdk 24, compile/target SDK 36, portrait-locked activity |
| `ios/` | Capacitor 8 project with Swift Package Manager, iOS 15.0 minimum, iPhone portrait-only |
| Plugins | `@capacitor/preferences` (saves), `@capacitor/haptics`, `@capacitor/app` (Android back button) |
| Storage | Preferences on native (OS-backed, not evictable like WebView localStorage); localStorage on web |
| Haptics | native impact/notification styles; Vibration API on web (no-op on iOS Safari) |
| Back button | closes an open dismissible panel, otherwise minimises the app |
| Offline | the game makes no network requests (e2e-tested on the web build); assets are bundled |
| Native glue | unit-tested with mocked Capacitor plugins (`tests/platform/native.test.ts`) |

## Requirements (Capacitor 8)

- Node 22+, Android Studio 2025.2.1+ with JDK 21, Android SDK platform 36.
- Xcode 26+ on macOS for iOS; deployment target iOS 15.

## Building Android

```bash
npm ci
```

```bash
npm run cap:sync
```

```bash
npx cap open android
```

Or from the command line, with `ANDROID_HOME` pointing at an SDK whose licenses you have
accepted (`sdkmanager --licenses`):

```bash
npm run android:build
```

The debug APK lands in `android/app/build/outputs/apk/debug/`.

## Building iOS (macOS)

```bash
npm ci
```

```bash
npm run cap:sync
```

```bash
npx cap open ios
```

Then select a team for signing in Xcode and run on a device.

## Device verification (to do on real hardware)

For each of: one low-end Android (about 3 GB RAM), one recent Android, one older iPhone,
one recent iPhone.

- [ ] Fresh install, airplane mode on, first launch: game loads and a full game is playable.
- [ ] Force-quit mid-game and relaunch: same board, score and queue.
- [ ] Device restart: best score and settings kept.
- [ ] Notch / Dynamic Island / gesture bar: HUD and board inside safe areas.
- [ ] Touch accuracy at board edges and corners; drag preview follows the finger.
- [ ] Sound starts after the first touch; silent switch (iOS) respected; sound toggle works.
- [ ] Haptics felt on merges and chains; vibration toggle works.
- [ ] Android back button: closes help/settings/confirm panels, then minimises.
- [ ] Background the app during a chain animation; resume shows the correct final board.
- [ ] Smooth animation during long chains on the low-end device (target p95 frame ≤ 16.7 ms).
- [ ] Cold start ≤ 3 s on the low-end device.
- [ ] Install build N, play, install build N+1: game and best score kept.

## Store readiness (owner decisions needed)

- [ ] Final app id and display name (Q24); update `capacitor.config.ts`, then `npx cap sync`.
- [ ] App icons and splash (not yet made; Q22).
- [ ] Developer accounts (Q23); signing keys kept outside the repository.
- [ ] Version numbers: `versionCode`/`versionName` in `android/app/build.gradle`, marketing
      and build version in Xcode.
- [ ] Privacy: the app collects no data, has no ads, analytics or network access (Q25, Q26).
- [ ] Screenshots, descriptions, age rating.
- [ ] Upload to the Play internal testing track and TestFlight.
