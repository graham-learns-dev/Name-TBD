# Supervisor Notes — Integration Review, Round 1

Date: 2026-07-28. Status: contract pack drafted; issues below were caught during
cross-review before any implementation started.

## Caught: schema/spec mismatches fixed in the contracts

1. **MediaPipe cannot see the barbell.** Three of the six rules in the product spec
   ("bar drift", "bar path deviation", squat bar reference) assumed bar position, which
   pose estimation does not provide. Fixed: CV contract defines an explicit `bar_proxy`
   (wrist midpoint; shoulder midpoint for squat). Real bar detection is V2. Accuracy of
   bar-path rules is proxy-limited — acceptable under the 80% target, but marketing copy
   should say "bar path estimate."

2. **Normalized coordinates would have corrupted every angle.** MediaPipe's default
   output is aspect-ratio-distorted for angle math on 9:16 video. Fixed: rules compute
   angles from world landmarks; pixel coords exist only for drawing overlays.

3. **Camera angle was unspecified but every rule depends on it.** Depth needs a side-ish
   view, valgus needs a front-ish view, bench path needs side. Fixed: one prescribed
   angle per lift (squat front-45, deadlift side, bench side), UI angle-guide overlay,
   and a CV `view_check` so we refuse to score unreadable footage instead of emitting
   garbage flags. Garbage flags on shared clips would be brand damage, not just a bug.

4. **Frame index alone was an insufficient join key.** Rule-engine flagged frames;
   clip-gen seeks by time; CV samples at a different rate than source FPS. Fixed:
   `timestamp_ms` is mandatory alongside `frame_index` in both CV and flag schemas.

5. **ffmpeg-kit is dead.** The spec's suggested clip library was retired and its binaries
   pulled (early 2025). Clip-gen contract recommends native composition
   (AVFoundation / Media3) instead. See escalation below.

## Scope cuts (rejected creep / impossible-in-v1)

- **`elbow_flare` (bench) cut from v1.** It needs a front/overhead camera, which conflicts
  with the side view that bar-path needs. One camera, one angle, per clip. V2 can revisit.
- **`intensity` as %1RM replaced with RPE-or-percentage** in program schema — beginners
  (the target user) don't have a 1RM. This is a data fix, not a feature add.
- Clip server-side storage: deferred entirely. Share sheet from local file covers v1.
- Reaffirmed V2 fence: no coaching cues in flag descriptions (state the fault, don't
  coach), no auto-progression (week advance is a manual client-side rule), no analytics.

## Decision log

- **2026-07-28 — Clip rendering: native composition approved** (AVFoundation on iOS,
  Media3 Transformer on Android). No ffmpeg anywhere in the pipeline. Clip-Gen
  workstream is unblocked.
- **2026-07-28 — App name: deliberately TBD.** All contracts keep the `[APP_NAME]`
  placeholder; watermark lockup is a swap-in asset. Not a blocker for any workstream
  except final store assets — revisit before TestFlight/beta.

## Open escalations

1. **RN wrapper vs. thin native module for MediaPipe.** Benchmark decides (≥5 FPS
   effective on iPhone 12 / Pixel 6 class), but if the RN wrapper misses the bar, the
   native-module fallback adds meaningful iOS+Android work. Flagging now so it isn't a
   surprise; no decision needed until the benchmark runs.

## Build order (dependency-driven) — status 2026-07-28

1. CV fixtures + keypoint extraction benchmark — **next up** (needs device + RN scaffold;
   resolves the remaining MediaPipe escalation)
2. Rule engine as pure functions — **DONE, first pass.**
   [packages/rule-engine/](packages/rule-engine/) — zero-dependency TypeScript, all five
   v1 rules + rep segmentation + severity/scoring, 13 tests green (`npm test`, Node ≥ 23).
   Synthetic parametric fixtures for now; swap in real golden keypoint clips when CV lands.
   Late catch folded into contracts: CV landmark set grew 14 → 16 (`foot_index` needed
   for the bar_drift midfoot reference).
3. Clip-gen render PoC — **unblocked** (native composition approved), not started
4. Backend schema + auth — **DONE, first pass.** [backend/](backend/):
   `migrations/001_init.sql` (tables, RLS, entitlements view, cascade-on-delete from
   auth.users), `openapi.yaml`, edge-function stubs (`iap-validate` fails closed until
   real receipt verification lands; `delete-account` complete), and
   `seed/generate_seed_sql.mjs` (validates templates, emits idempotent seed SQL —
   `programs_seed.sql` generated). Remaining: real IAP verification + a Supabase project
   to apply it to.
5. UI shell + SetLogger — not started, wires modules as they land
6. Program JSONs — **2 of 5 done** ([programs/](programs/), free tier:
   `beginner_full_body_3d`, `beginner_upper_lower`), contract-validated via
   `programs/validate.mjs`. Paid three follow the same shape once a lifter reviews these.

Cross-agent payload schemas are now formal artifacts in [schemas/](schemas/)
(`cv-keypoints.schema.json`, `rule-flags.schema.json`, JSON Schema 2020-12) — the
CI-enforceable versions of the contracts, ready for ajv once the app repo exists.

## Environment note before the RN scaffold

This planning workspace lives in OneDrive, which fights `node_modules` (sync churn,
file locks) and is not a git repo. The React Native app repo should be created
**outside OneDrive** (e.g. `C:\dev\formcheck`) and under git from day one; this folder
stays the contract/spec source of truth until then, at which point the pack moves into
the repo as `/docs`.

## Standing review rules for all workstreams

- Every cross-agent payload carries `schema_version`; consumers fail loudly on mismatch.
- No contract change ships without updating the contract file in this pack first.
- "We could add AI for X" → the answer is no for v1. Deterministic thresholds are a
  feature: explainable flags on a shared clip beat opaque scores.
- The watermark is the acquisition engine. Any proposal that weakens it on free tier
  gets rejected here before it travels.
