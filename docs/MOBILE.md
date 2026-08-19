# Building the mobile app (iOS / Android)

openGym's mobile app is a fully native React Native application powered by Expo. It shares the
exercise catalogue and backup format with the browser app, but it does not load the browser app,
use a WebView, or require a backend.

## Prerequisites

- Node 22.13+ for Expo SDK 57
- pnpm 10+
- **Android:** Android Studio, its SDK, and Java 21
- **iOS:** macOS with Xcode 26.4+ and CocoaPods

## Build and run

From the repository root:

```sh
pnpm install
pnpm --filter opengym-mobile typecheck

# Development server / Expo Go or a development build
pnpm --filter opengym-mobile start

# Native builds (prebuild creates ignored android/ and ios directories)
pnpm --filter opengym-mobile android
pnpm --filter opengym-mobile ios       # macOS only
```

The app is standalone: no account, no sync, and no server. Workout state is stored in the app's
private file directory, native reminders use local notifications, and backups use the operating
system share sheet.

## Native architecture

- `apps/mobile/App.tsx` provides the native app shell and tab navigation.
- `apps/mobile/src/core.ts` owns the mobile state model, exercise catalogue adapter, starter plans,
  and workout calculations.
- `apps/mobile/src/services.ts` owns file persistence, reminders, and backup sharing.
- `apps/mobile/src/ui.tsx` is the source-owned native design system used by the screens.
- `apps/mobile/src/screens.tsx` contains the Home, Plan, Train, History, Library, Stats, and
  Settings screens.

The exercise catalogue remains shared with `apps/web`; Metro watches the workspace so there is one
source of truth for exercise data.

## Native configuration

`apps/mobile/app.json` points Expo at the shared app icon and keeps the package identifiers used by
the previous release:

- Android: `ch.duartesantos.opengym`
- iOS: `ch.duartesantos.opengym`

Expo generates native projects on demand with `expo prebuild`; generated `android/` and `ios/`
directories under `apps/mobile` must not be committed.

## Distribution

The project remains deliberately store-neutral. For a local Android artifact, use the generated
native project or an EAS build profile:

```sh
pnpm dlx eas-cli build --platform android
pnpm dlx eas-cli build --platform ios
```
