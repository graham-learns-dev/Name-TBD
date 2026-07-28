# Form-Check — V1 Fitness App

A mobile app combining free form-checking (AI video analysis of powerlifting form) with paid training programs.

## Monorepo structure

```
formcheck/
├── app/                — Expo (React Native) app, own node_modules
├── docs/               — contract pack + supervisor notes
├── packages/
│   └── rule-engine/    — deterministic form-check rules (TypeScript, pure functions)
├── backend/            — Supabase SQL + edge functions
├── programs/           — training program templates (JSON)
├── schemas/            — JSON Schema for cross-service contracts
└── package.json        — root config (workspaces: packages/*)
```

## Quick start

Rule-engine tests (no install needed, Node ≥ 23):
```bash
cd packages/rule-engine
npm test
```

App (install once, then test / run):
```bash
cd app
npm install
npm test
```

## Running the app

**No Mac required for day-to-day development.** The app runs via Expo:

```bash
cd app
npx expo start
```

Scan the printed QR code with the **Expo Go** app (free, App Store / Play Store) on
your phone. Live reload — code changes appear on the phone in seconds.

**Path to the App Store without owning a Mac:** [EAS Build](https://docs.expo.dev/build/introduction/)
runs the iOS build on Expo's cloud infrastructure and can submit straight to
TestFlight/App Store. A physical Mac becomes optional, useful for full native-code
control once we're past MVP, not a hard requirement.

**Known limitation:** on-device pose estimation (MediaPipe) needs a custom native
module, which Expo Go can't load. When that workstream lands, testing moves from
Expo Go to an EAS-built "development client" (still no Mac needed — EAS builds it in
the cloud) or a Mac if/when Graham has one. Everything else — logging, programs,
navigation, and the rule engine itself — works fully in Expo Go today.

## Development

Each package is a distinct workstream:

- **mobile** — React Native app, main user interface
- **rule-engine** — form-check thresholds and flag generation
- **backend** — Postgres schema, auth, APIs (Supabase)
- **programs** — training templates and progression logic

See `/docs` for V1 design contracts and integration specs.

## V1 Scope

- [ ] App installs and captures video on iOS/Android
- [ ] Pose extraction at 5+ FPS (MediaPipe, on-device)
- [ ] Rule flagging (depth, valgus, back rounding, bar drift, bench path)
- [ ] Clip export with watermark (9:16 Reels format)
- [ ] User can log a set → see form check → share within 10 s
- [ ] Shared clips link back to app (user acquisition)
- [ ] Program templates load and display workouts
- [ ] Backend stores user data and auth works
- [ ] No crashes on happy path

## V2 Deferred

Auto-progression, analytics dashboard, coaching cues, AI program personalization, web app.
