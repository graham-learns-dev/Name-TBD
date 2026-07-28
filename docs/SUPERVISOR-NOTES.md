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

1. CV/Pose agent — **DONE, interim implementation shipped and verified end-to-end.**
   Camera capture ([app/src/screens/CameraScreen.tsx](../app/src/screens/CameraScreen.tsx)):
   real `expo-camera` recording with a per-lift angle guide (front-45 for squat, side
   for deadlift/bench, matching the contract table), 8s auto-stop, works in Expo Go —
   no native module needed for capture itself.

   **Pose backend decision (escalated to Graham, decided 2026-07-28):** the target
   MediaPipe native module needs a custom EAS development build, which needs an Apple
   Developer Program account ($99/year) to install on his own iPhone, plus a slower
   cloud-build iteration loop instead of instant Expo Go reload. Graham chose the
   free-today alternative: **BlazePose via TensorFlow.js's `tfjs` runtime**
   (`@tensorflow-models/pose-detection`), which runs inside Expo Go (only official
   `expo-gl`, no custom native code). BlazePose is literally the same model MediaPipe
   Pose uses, so its 33-landmark + `keypoints3D` output maps onto the existing
   `ClipKeypoints` schema with **zero rule-engine changes** — this was the deciding
   factor over MoveNet, which lacks 3D world landmarks and heel/foot-index points
   (would have broken `bar_drift` and forced a rules.ts rewrite around 2D-only angle
   math). Full writeup: [docs/contracts/cv-keypoints.md](contracts/cv-keypoints.md).

   Implementation: `app/src/lib/poseModel.ts` (lazy detector singleton, loads once per
   app session), `app/src/lib/poseMapping.ts` (pure mapping, zero device/native
   dependencies, unit-tested — 9 tests including a full round-trip through the real
   `evaluate()`), `app/src/lib/poseEstimation.ts` (I/O: 8 evenly-spaced still frames
   via `expo-video-thumbnails` → `decodeJpeg` → BlazePose inference per frame).
   `ResultsScreen` now runs this for real on every recording, with a loading spinner,
   an error state with a "try demo data instead" escape hatch, and a `view_check`-fail
   message — the rotating demo clips are now purely a fallback, not the primary path.

   **Real bundler issues hit and fixed** (would have blocked Graham's first test):
   `@tensorflow-models/pose-detection`'s `create_detector.js` unconditionally imports
   *all* supported model backends (BlazePose-mediapipe, PoseNet, MoveNet) regardless of
   which one is actually used at runtime — Metro resolves every `require()` statically,
   so three unused optional peers (`@mediapipe/pose`, `react-native-fs`,
   `@tensorflow/tfjs-backend-webgpu`) had to be installed just to satisfy the bundler,
   never called at runtime. `react-native-fs` is unmaintained, so it's explicitly
   excluded from `expo-doctor`'s React Native Directory check
   (`app/package.json`'s `expo.doctor.reactNativeDirectoryCheck.exclude`) with this
   note as the reason. Verified via `npx expo export --platform ios` (1001 modules,
   6.43MB bundle, resolves clean) both before and after — this is now the standard
   pre-handoff check before telling Graham to re-scan.

   **Known interim limitations** (documented, not silently accepted): 12 frames per
   clip instead of the contract's 10 FPS target (JS/WebGL inference is too slow per
   frame to sample densely — coarser rep segmentation, may miss the exact worst-fault
   frame); `view_check` is a crude detection-rate heuristic, not the shoulder-width
   check the contract specifies; `frame_index` is a sample index, not a source-video
   frame index (no consumer depends on this yet — Clip-Gen doesn't exist).

   **Round 1 on-device test (2026-07-28) found a real bug, not a model problem.**
   Graham's first squat came back "couldn't detect a rep." Root cause: the fixed 8s
   recording window included several seconds of him walking from the record button to
   the rack, so the actual rep motion fell near/past the end of the sampled window.
   Two fixes attempted in sequence:
   1. *Shortened the recording window (8s → 6s)* — wrong direction, made it worse
      (his stated setup time alone was ~4s). Reverted immediately, before shipping.
   2. *Pre-record countdown (5s "get ready" before the clock starts)* — correct fix,
      built and verified (tsc/jest/expo-doctor/bundle all clean), but not yet tested
      on-device before Graham proposed something better.

   **Shipped instead: rolling-buffer capture.** Graham's idea, and a clear UX upgrade
   over a countdown — record continuously in the background from the moment the
   camera's ready, no forced schedule, tap "Got it!" whenever the rep is actually
   done. Implementation detail and the one real unverified risk (back-to-back
   `recordAsync()` reliability on real hardware) are in
   [docs/contracts/cv-keypoints.md](contracts/cv-keypoints.md) under "Capture flow:
   rolling buffer, not tap-to-record." New pure/tested surface:
   `resolveSegmentSample` + `totalSegmentsDurationMs` in `poseMapping.ts` (9 new
   tests, 27 total in the app now). **Known gap this creates:** the recorded output is
   now several segment files, not one video — fine for pose sampling (each sample is
   an independent still frame) but Clip-Gen will need real video concatenation later,
   which doesn't exist yet.

   **Round 2 on-device test (2026-07-28) confirmed the flagged risk, twice over.**
   First symptom: the "Got it!" button looked inert after a squat, with zero feedback.
   Root cause #1 — the capture loop was gated on `onCameraReady` firing, an unverified
   signal; if it doesn't fire promptly on Graham's hardware, the loop never starts at
   all and the buffer silently stays empty forever. Fixed: loop now starts on
   permission-granted alone, with a live status line ("Starting camera…" / "Getting
   ready…" / "Buffering — X.Xs ready") so the actual state is visible instead of an
   ambiguous disabled button.

   With that fixed, round 2b surfaced the real headline finding: after tapping "Got
   it!", the screen hung on "Wrapping up…" for **2-3 minutes** — `recordAsync()` never
   resolved at all, not even honoring its own `maxDuration: 3` cap. This is exactly
   the "one real unverified risk" flagged before ever testing this design (back-to-
   back `recordAsync()` calls on real hardware) — now confirmed, not hypothetical.

   **Fix: every `recordAsync()` call now races against a hard timeout**
   (`SEGMENT_TIMEOUT_MS`, maxDuration + 3s grace), for every segment, not just the
   final one — if the native call doesn't resolve in time, that attempt is treated as
   failed and the loop retries (or gives up gracefully after 5 in a row). A second,
   looser timeout (`FINISH_TIMEOUT_MS`) guards the "Got it!" → next-screen transition
   specifically as defense in depth. A `settledRef` guard ensures only one of these
   paths ever actually navigates, in case both fire. **Nothing in this screen can hang
   indefinitely anymore, regardless of what the camera does** — worst case is now a
   bounded ~8s per attempt, not an unbounded wait.

   Also fixed in the same pass: a genuinely broken `retry()` (was calling `setState`
   with an unchanged value hoping to force a re-render — React just no-ops that;
   replaced with an `attempt` counter in the effect's dependency array).

   **Contingency if this keeps happening:** if `recordAsync()` times out on *every*
   attempt even with retries (buffer never fills, always lands in the error state),
   that points to something more fundamentally wrong with rapid repeated recording
   calls on this device/OS combination — not something more client-side patching can
   fix. Fallback plan: the pre-record-countdown design (single `recordAsync()` call
   per attempt, built and verified in round 1, superseded before shipping — see above)
   is far less likely to hit whatever native state this triggers, since it never calls
   `recordAsync()` back-to-back. Worth resurrecting if round 3 still fails.

   **Not yet done:** confirmation that the timeout fix actually resolves the hang on
   Graham's phone (does the buffer now visibly climb, does "Got it!" resolve within
   ~8s even in the worst case) — the very next thing to check. Also still pending: the
   6 golden fixture clips, and eventually the native MediaPipe swap once/if an Apple
   Developer account is in the picture.
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
5. UI shell + SetLogger — **DONE, first pass; rebuilt on Expo (2026-07-28).**
   [/app](../app/) started as a bare React Native CLI project, then was **converted to
   an Expo (SDK 57) app** the same day — Graham has no Mac and no Android Studio yet,
   and Expo Go lets him run the app on his iPhone directly (scan a QR code) with zero
   native toolchain. Same screens, same logic; only the scaffolding changed.
   - Full v1 navigation: Welcome → Onboarding (program pick) → tabs (Today / Program /
     Profile) with SetLogger + Results as modals.
   - SetLogger follows the ≤4-tap contract: weight steppers, rep steppers, RPE chips,
     prefill from last set of the same lift.
   - **The real rule engine runs in-app**: Results screen calls `evaluate()` from
     `@formcheck/rule-engine` (linked via file: dep). Camera isn't built yet, so it runs
     on bundled demo clips that rotate through clean / valgus / high-squat scenarios —
     the full log → analyze → results → history loop works end to end, live on-device
     via Expo Go.
   - Program templates bundle straight from /programs JSONs (single source of truth).
   - 7 app-level jest tests green (`jest-expo` preset); `tsc --noEmit` clean.
   - Not yet wired: camera/CV (needs a custom native module — see below), clip-gen,
     Supabase auth + sync (state is in-memory; shapes already match the contracts so the
     swap is additive).

   **Path to production without a Mac:** EAS Build (Expo's cloud build service) can
   produce App Store / TestFlight binaries, including ones with custom native code,
   entirely from Windows — no Mac required for the whole v1 timeline. A Mac becomes
   genuinely useful once we want full local control over native iOS debugging; it is
   not a blocker. Graham's plan: ship on EAS, buy a Mac later when it makes sense.

   **Consequence for the CV workstream:** Expo Go itself can't load a custom MediaPipe
   native module — that requires an EAS "development build" instead (still built in
   Expo's cloud, still no Mac needed, just a slower iterate loop than Expo Go's instant
   QR-code reload). Noting this now so it isn't a surprise when CV work starts.

   **Pinned to SDK 54, not latest (2026-07-28).** Scaffolded first on SDK 57, but
   Graham's installed Expo Go only supports SDK 54 (Expo Go tracks one SDK at a time;
   App Store listing lagging the newest SDK is normal, not a broken install). Downgraded
   via `npx expo install expo@^54.0.0` + `expo install --fix` + clean reinstall
   (react 19.1.0, react-native 0.81.5, expo-camera ~17.0.10, jest-expo ~54.0.17, etc.).
   `npx expo-doctor`: 18/18 checks pass. Tests and tsc still green post-downgrade.
   Revisit the SDK version whenever Expo Go's supported SDK moves — check via the
   Profile tab in the app before assuming "latest" will work.

   **Missing monorepo Metro config caught by the first real bundle (2026-07-28).** The
   clean reinstall during the SDK downgrade was fine, but this Expo project never had
   the `watchFolders`/`nodeModulesPaths` config the old bare-RN scaffold had — so Metro
   couldn't see the `@formcheck/rule-engine` symlink outside `app/`, and the very first
   on-device bundle failed (`Unable to resolve module @formcheck/rule-engine`). Added
   `app/metro.config.js` per [Expo's monorepo guide](https://docs.expo.dev/guides/monorepos/).
   Verified with `npx expo export --platform ios` (857 modules, resolves clean) before
   sending Graham back to re-scan.

   **Verified end-to-end on Graham's iPhone via Expo Go (2026-07-28).** Full loop
   confirmed live on-device: onboarding → program pick → Today → log set (no video) →
   history; log set → form check (rotating demo clips: clean / valgus / high-squat /
   both) → score ring + flag cards → save → history; unit toggle; program week view.
   This is the first real device confirmation of the whole v1 UI shell, not just tests.
6. Program JSONs — **2 of 5 done** ([programs/](programs/), free tier:
   `beginner_full_body_3d`, `beginner_upper_lower`), contract-validated via
   `programs/validate.mjs`. Paid three follow the same shape once a lifter reviews these.

Cross-agent payload schemas are now formal artifacts in [schemas/](schemas/)
(`cv-keypoints.schema.json`, `rule-flags.schema.json`, JSON Schema 2020-12) — the
CI-enforceable versions of the contracts, ready for ajv once the app repo exists.

## Environment note — resolved 2026-07-28

The repo lives at `C:\dev\formcheck` (outside OneDrive, deliberately — node_modules +
sync don't mix), pushed to GitHub (`graham-learns-dev/Name-TBD`, rename when the app
name lands). This `/docs` folder is now the source of truth for contracts; the original
OneDrive drafts are superseded.

## Standing review rules for all workstreams

- Every cross-agent payload carries `schema_version`; consumers fail loudly on mismatch.
- No contract change ships without updating the contract file in this pack first.
- "We could add AI for X" → the answer is no for v1. Deterministic thresholds are a
  feature: explainable flags on a shared clip beat opaque scores.
- The watermark is the acquisition engine. Any proposal that weakens it on free tier
  gets rejected here before it travels.
