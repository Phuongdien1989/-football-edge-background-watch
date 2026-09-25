# Football Edge iOS Release Readiness (N1.1)

This document prepares the iOS native release path without changing the production PWA or enabling signed distribution before Apple Developer Program enrollment is approved.

## Current verified state

- Bundle ID: `vn.footballedge.app`
- Capacitor iOS project generation: PASS
- Capacitor PushNotifications plugin: present
- APNs registration callbacks bridged in `AppDelegate.swift`: PASS
- Unsigned iOS Simulator build: PASS
- Native Push client distinguishes APNs `sandbox` vs `production`
- Production web/PWA remains independent and unchanged

## Apple-side prerequisites after enrollment approval

1. Confirm/register App ID `vn.footballedge.app`.
2. Enable the Push Notifications capability for that App ID.
3. Create an APNs Auth Key (`.p8`). Record Key ID and Team ID. The private key download is one-time; store it securely and never commit it to Git.
4. Create Apple Distribution signing material and an App Store provisioning profile for `vn.footballedge.app`.

## Cloudflare Worker APNs configuration

`worker_notify_v132_native.js` expects these exact values:

- `APNS_KEY_ID` — secret/value
- `APNS_TEAM_ID` — secret/value
- `APNS_PRIVATE_KEY` — secret containing the `.p8` private key text
- `APNS_BUNDLE_ID=vn.footballedge.app`
- `APNS_ENV=sandbox` for development-device tokens
- `APNS_ENV=production` for TestFlight/App Store device tokens

Do not expose the `.p8` private key in chat, source control, screenshots, or logs.

## GitHub signing secrets planned for signed IPA CI

- `APPLE_TEAM_ID`
- `IOS_DIST_CERT_P12_B64`
- `IOS_DIST_CERT_PASSWORD`
- `IOS_PROVISIONING_PROFILE_B64`

These names are placeholders for the release workflow only. No secret values belong in the repository.

## Push entitlement

For TestFlight/App Store release builds, use `native/ios-release/App.production.entitlements` with:

`aps-environment = production`

Development/device builds must use the development entitlement and sandbox APNs environment instead.

## Release gate

Do not build or upload a signed TestFlight IPA until:

- Apple Developer Program membership is active.
- App ID and Push Notifications capability are confirmed.
- Signing certificate/profile are available.
- APNs Key ID, Team ID, and `.p8` key are securely installed as secrets.
- Unsigned CI remains green.

After those gates pass, the next stage is signed archive -> IPA -> TestFlight -> real-iPhone APNs end-to-end validation.
