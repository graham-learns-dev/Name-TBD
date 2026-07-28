# @formcheck/mobile

React Native app for iOS and Android.

## Structure

- `src/screens/` — all UI screens (auth, today, program, profile)
- `src/navigation/` — React Navigation setup
- `src/api/` — Supabase client + API calls
- `src/types/` — TypeScript types (mirrors backend schemas)
- `src/hooks/` — custom hooks (useAuth, useCurrentSet, etc.)
- `ios/` — native code / Xcode project
- `android/` — native code / Android Studio project

## Setup

```bash
npm install
npm run ios    # or npm run android
```

The app integrates:
- `@formcheck/rule-engine` for form checking
- `@formcheck/clip-gen` (v1) for clip rendering
- Supabase Auth for login
- Supabase Realtime for sets (v2)

## Status

V1 scope: set logging + optional video form-check + program display.
