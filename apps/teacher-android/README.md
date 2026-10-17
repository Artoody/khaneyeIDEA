# Teacher Android APK

Capacitor shell around the teacher web panel (`/fa/teacher` on staging/production).

## Install (ready APK)

`apps/teacher-android/dist/teacher-debug.apk` — sideload on Android (allow unknown sources).

- App label: دبیر خانه ایده  
- Opens: `https://khaneyeidea-production.up.railway.app/fa/teacher`  
- Brand splash + launcher icons included

## Rebuild

```bash
pnpm install --filter @khaneyeidea/teacher-android
cd apps/teacher-android
pnpm apk
# → dist/teacher-debug.apk
```

Host override: `set TEACHER_APP_URL=https://your-host/fa/teacher` then `pnpm apk`.

## Notifications

The APK is a real installable app icon (separate from Chrome). Web Push inside Android WebView is still limited compared with Chrome/PWA.

For reliable native push next: Firebase Cloud Messaging + `@capacitor/push-notifications` + store device tokens on the server.
