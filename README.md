# Form-Check — V1 Fitness App

A mobile app combining free form-checking (AI video analysis of powerlifting form) with paid training programs.

## Monorepo structure

```
formcheck/
├── docs/               — contract pack + supervisor notes
├── packages/
│   ├── mobile/         — React Native app (iOS/Android)
│   └── rule-engine/    — deterministic form-check rules (TypeScript, pure functions)
├── backend/            — Supabase SQL + edge functions
├── programs/           — training program templates (JSON)
├── schemas/            — JSON Schema for cross-service contracts
└── package.json        — root monorepo config
```

## Quick start

Install dependencies:
```bash
npm install
```

Run tests:
```bash
npm test
```

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
