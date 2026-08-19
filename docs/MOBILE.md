# Building the mobile app (iOS / Android)

openGym ships in two flavors from the same codebase:

| | **Self-hosted** (this repo's default) | **Mobile app** (`Vite` mobile mode) |
|---|---|---|
| Runs | in any browser, against your own server | in an Expo native shell on iPhone / Android |
| Accounts | passkey sign-in, one profile per person | none — the phone *is* the account |
| Data | synced to your server, readable on desktop | stays on the device (file in the app's private storage) |
| Reminders | Web Push from your server | native local notifications, no server involved |
| Exercise media | served by your server (`img/`, `gif/`) | loaded from the jsDelivr CDN |

The mobile flavor never talks to a backend: no sign-in screen, no sync, no telemetry. The
existing Vite UI is flattened into one HTML asset and rendered by an Expo WebView. Native
requests from that UI are handled by `apps/mobile/App.js`:

- `expo-file-system` mirrors `opengym-state.json` in private app storage.
- `expo-notifications` schedules workout-day reminders.
- `expo-sharing` sends JSON backups to the OS share sheet.

## Prerequisites

- Node 22.13+ for Expo SDK 57 (the web app itself still supports Node 20.19+).
- pnpm 10+
- **Android:** Android Studio and its SDK; Java 21 for Gradle.
- **iOS:** a Mac with Xcode 26.4+ and CocoaPods. A free Apple ID is enough to run the app
  on your own iPhone; paid membership is only needed for store distribution.

## Build and run

From the repository root:

```sh
pnpm install
pnpm build:mobile

# Development server / Expo Go or a development build
pnpm --filter opengym-mobile start

# Native builds (prebuild creates apps/mobile/android and apps/mobile/ios as ignored output)
pnpm --filter opengym-mobile android
pnpm --filter opengym-mobile ios       # macOS only
```

`pnpm build:mobile` builds the `apps/web` mobile flavor and writes the generated WebView asset
to `apps/mobile/assets/opengym.html`. That file is intentionally ignored: rerun the command
after changing the web UI. The Expo package's `start`, `android`, and `ios` scripts prepare it
automatically.

The mobile bundle uses the pinned exercise CDN, while ordinary `pnpm build` continues to build
the self-hosted browser bundle. There is no native sync step or checked-in native project.

## App icons and native configuration

`apps/mobile/app.json` points Expo at the shared `apps/web/public/icon-512.png` asset and keeps
the package identifiers used by the previous release:

- Android: `ch.duartesantos.opengym`
- iOS: `ch.duartesantos.opengym`

Expo generates native projects on demand with `expo prebuild`; generated `android/` and `ios/`
directories under `apps/mobile` must not be committed.

## Distribution

The project remains deliberately store-neutral. For a local Android artifact, use the generated
native project or an EAS build profile. For example, after installing/configuring EAS:

```sh
pnpm dlx eas-cli build --platform android
pnpm dlx eas-cli build --platform ios
```

Apple still requires signing for iPhone installation. A free Apple ID can run a local development
build with the usual signing limits; store distribution requires the appropriate Apple account.
