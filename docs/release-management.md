# Release Management and Monitoring

## Implemented client-side foundation

- Hub repository can create a proposal as `draft`.
- Admin-authorized repository can transition proposal status and append an audit log.
- `classifyUpdate()` separates Dynamic, OTA, and Native changes.
- `evaluateReleaseHealth()` calculates failure rate and recommends continue/pause/rollback.
- The mobile client never publishes EAS directly.

## Required secure Backend

The next server-side component must expose authenticated endpoints such as:

- `POST /admin/proposals/:id/submit`
- `POST /admin/proposals/:id/approve`
- `POST /admin/releases/preview`
- `POST /admin/releases/stop`
- `POST /admin/releases/rollback`

Each endpoint must validate Firebase ID token, verify `admin` custom claim, enforce allowed state transitions, use an idempotency key, write `hubAuditLogs`, and call EAS only from the server. `EXPO_TOKEN` and Firebase Admin credentials never enter the APK.

## Channels

- `development`: internal developer testing.
- `preview`: selected tester group / staged rollout.
- `production`: approved general release.

Native changes do not use OTA. They increment native build metadata and go through APK/AAB or iOS build flow.

## Monitoring policy

A release should pause when failure rate reaches 10% and rollback when it reaches 25% or any event has an incompatible runtime version. These are initial policy defaults and must be reviewed before production. The client can report events, but the Backend owns the decision and release mutation.

## Still requires owner action

EAS project creation, `runtimeVersion`, channel credentials, Firebase Auth/Firestore activation, admin custom claims, Backend deployment, and first production approval are external gates. This repository deliberately does not fabricate success for any of them.
