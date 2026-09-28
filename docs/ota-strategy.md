# OTA Strategy Audit — مُرشد S7

## Audit result before changes

At the audit time the official project had Expo SDK `~57.0.25`, React Native `0.86.3`, Android package `com.murshid.s7`, Expo slug `murshid-s7`, app version `0.1.0`, no `eas.json`, no `expo-updates` dependency, no `runtimeVersion`, no EAS `projectId`, and no `updates.url`. Therefore it was **not EAS Update-ready** before this phase.

## Changes made in this phase

- Added SDK-compatible `expo-updates`.
- Added `runtimeVersion: { policy: "appVersion" }` to `app.json`.
- Added `eas.json` with `development`, `preview`, and `production` build profiles and matching channels.
- Added the GitHub → test → EAS Update workflow to README.
- Documented the OTA/native boundary, runtime compatibility, rollback and recovery.

## Runtime version strategy

`appVersion` is the runtime boundary. A binary built from app version `0.1.0` receives updates whose runtime version is `0.1.0`. When a native dependency, Android permission, Expo/RN SDK, WebView native setting, native asset/configuration, package ID, or other native contract changes, increment `expo.version` and build a new binary. JavaScript-only changes keep the same app version and can target the existing runtime.

This policy is deliberately conservative. It prevents an update compiled against a different native contract from being offered to an incompatible binary. Do not manually force a runtime value to make a native change look OTA-compatible.

## Channels and profiles

- `development`: development client and internal developer testing.
- `preview`: internal distribution for a selected test group.
- `production`: approved public release.

Do not publish directly to production. A production update requires a compatible production binary, successful checks, preview validation, and explicit owner approval.

## Current readiness

The source is now **locally prepared but not production-ready**. It still needs `eas init` / project association, `eas update:configure` to create the real `updates.url` and project ID, an Expo account, at least one development/preview/production build, and a real Android-device check. No production build or update was run in this phase.

## OTA-compatible changes

React/TypeScript code, screens, components, navigation logic, business logic, copy, remote-content fallback logic, and bundled assets can generally be delivered by OTA when they do not alter the native runtime and remain within the binary's supported capabilities.

## Build-required changes

A new APK/AAB is required for new or changed native dependencies, Android permissions, package/application ID, adaptive icon/splash configuration, WebView native configuration, Expo/RN SDK upgrades, native config plugins, AndroidManifest/Gradle changes, native storage/MediaStore/background behavior, or a runtime version change.

## Safe workflow outside Manus

```bash
git clone https://github.com/seiferfan077-cmyk/Morshed_s7.git
cd Morshed_s7
npm ci
npx expo-doctor
npx tsc --noEmit
npx expo start --tunnel
# test on the development/preview binary
git add .
git commit -m "feat: describe change"
git push origin main
npx eas update --channel preview --message "preview: tested change"
# after review only
npx eas update --channel production --message "production: approved change"
```

EAS credentials remain outside GitHub. A CI workflow may be added later, but it must use a protected `EXPO_TOKEN`; the mobile bundle must never contain that token.

## Rollback/recovery

Keep every update associated with its commit SHA and message. Pause or stop a rollout when telemetry shows a problem. Republish the last known-good update or use the EAS rollback mechanism for the affected channel according to the current EAS CLI/platform behavior. If the update cannot be downloaded or applied, the binary should retain its embedded/previous bundle. Native regressions require a new binary; rollback does not turn native code into OTA code.

## External gates

The owner must create or associate the EAS project, confirm the Expo account and signing policy, generate the first development/preview/production binaries, and approve the first production update. Firebase, Admin Backend, and EAS secrets are not committed or fabricated by this repository.
