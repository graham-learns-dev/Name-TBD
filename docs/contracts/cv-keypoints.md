# CV/Pose Agent — Keypoint Extraction Contract

**Owns:** MediaPipe Pose integration, frame sampling, coordinate normalization, camera-angle metadata.
**Consumer:** Rule-Engine (zero transformation — it reads this JSON as-is).
**Must not:** apply any thresholds or emit flags.

## Stack

**Target (V1 final):** MediaPipe Pose Landmarker (Tasks API), `pose_landmarker_full`
model, on-device, via a native module. Requires a custom EAS development build (Expo
Go can't load custom native code).

**Interim implementation (shipped 2026-07-28, see SUPERVISOR-NOTES.md):**
BlazePose running through TensorFlow.js's `tfjs` runtime
(`@tensorflow-models/pose-detection`, `SupportedModels.BlazePose`, `runtime: 'tfjs'`,
`modelType: 'full'`). Chosen because it runs inside **Expo Go** — official `expo-gl`
module only, no custom native code — so Graham can test on his iPhone today without an
Apple Developer account or EAS builds. BlazePose is the *same model* MediaPipe Pose
uses internally, so its 33-landmark output (including `keypoints3D`, hip-centered and
roughly metric) maps onto this exact schema with no rule-engine changes. Swapping to
native MediaPipe later is a backend swap behind this same contract, not a rewrite.
Implementation: `app/src/lib/poseModel.ts` (detector bootstrap), `app/src/lib/
poseMapping.ts` (pure, unit-tested mapping), `app/src/lib/poseEstimation.ts` (I/O:
frame extraction + inference).

- Frame extraction: **still frames via `expo-video-thumbnails`**, not a real frame
  decoder — `getThumbnailAsync(uri, { time })` at N evenly-spaced timestamps.
- Sampling: **8 evenly-spaced frames per clip**, not 10 FPS. Each BlazePose-tfjs
  inference on a phone GPU via WebGL takes on the order of hundreds of ms to ~1s with
  no native acceleration; sampling densely would make analysis too slow. This is a
  real, deliberate accuracy tradeoff (coarser rep segmentation, less precise
  worst-frame detection) versus the target native pipeline — revisit the count once
  Graham reports actual on-device timing.
- `view_check` heuristic is simplified: `pass`/`warn`/`fail` from the fraction of
  sampled frames with any detected pose at all (≥80% / 50–80% / <50%), not the
  shoulder-width-ratio check originally specified — that needs calibration data this
  interim pipeline doesn't have yet.
- `frame_index` is the sample index (0..7), not an index into the source video's frame
  sequence — there's no full frame decode in this pipeline. `timestamp_ms` remains the
  authoritative field for any future consumer, per the existing note below.

## Coordinate spaces — the part everyone gets wrong

MediaPipe returns **normalized** image coordinates (x, y ∈ [0,1] relative to frame width/height).
Angles computed directly from normalized coords are distorted by aspect ratio (a 9:16 frame
stretches y by ~1.78× relative to x). Therefore:

- CV agent emits **pixel coordinates** (normalized × frame dimensions) as the primary values.
- CV agent also passes through MediaPipe **world landmarks** (meters, hip-centered, 3D) —
  Rule-Engine computes all joint angles from world landmarks, and uses pixel coords only
  for positions the Clip-Gen overlay needs.

## Bar position

MediaPipe Pose does not see the barbell. **V1 bar proxy = midpoint of left/right wrist
keypoints.** This is accurate for deadlift and bench (hands on bar), approximate for
squat (bar is on the back; use midpoint of shoulders instead for squat). The proxy choice
is encoded in the output (`bar_proxy` field) so Rule-Engine doesn't have to guess.
Dedicated bar detection (e.g., plate circle detection) is V2.

## Required camera angle (input contract from UI)

Rules are only valid from the angle they were designed for. The UI prompts the user to
film from the prescribed angle per lift; CV agent records what was requested and performs
a sanity check (see `view_check`).

| Lift | Prescribed angle | Why |
|---|---|---|
| squat | **45° front-quarter**, full body in frame | compromise: depth readable, valgus readable |
| deadlift | **side (90°)**, full body | back angle + sagittal bar drift |
| bench | **side (90°)**, head-to-hips visible | bar path; (elbow flare cut from v1 — see supervisor notes) |

`view_check`: compare shoulder-width-to-hip-width pixel ratio and left/right landmark
visibility scores against expected ranges for the prescribed angle. Emit `pass | warn | fail`.
On `fail`, UI shows "re-film from the side" instead of running rules on garbage.

## Output schema (per clip)

```json
{
  "schema_version": "1.0",
  "clip_id": "uuid",
  "lift": "squat | bench | deadlift",
  "prescribed_view": "front_45 | side",
  "view_check": "pass | warn | fail",
  "source": {
    "width_px": 1080,
    "height_px": 1920,
    "fps": 30,
    "duration_ms": 6400
  },
  "sampling": { "sampled_fps": 10, "frame_stride": 3 },
  "bar_proxy": "wrist_midpoint | shoulder_midpoint",
  "frames": [
    {
      "frame_index": 42,
      "timestamp_ms": 1400,
      "keypoints_px": {
        "left_hip":  { "x": 540.2, "y": 601.1, "confidence": 0.95 },
        "left_knee": { "x": 551.0, "y": 1152.7, "confidence": 0.92 }
      },
      "keypoints_world": {
        "left_hip":  { "x": -0.09, "y": 0.00, "z": 0.02, "confidence": 0.95 },
        "left_knee": { "x": -0.10, "y": 0.41, "z": 0.05, "confidence": 0.92 }
      },
      "bar_px": { "x": 545.5, "y": 410.0, "confidence": 0.90 }
    }
  ]
}
```

- `frame_index` is the index in the **source** video (so Clip-Gen can seek), not the
  sample index. `timestamp_ms` always included — Clip-Gen seeks by time, not frame.
- Keypoint set: the 16 landmarks rules actually use — shoulders, elbows, wrists, hips,
  knees, ankles, heels, foot_index (toes; needed for the midfoot reference in
  `bar_drift`). Don't ship all 33; it doubles payload size for nothing.
- `confidence` below **0.5** on a landmark a rule needs → Rule-Engine skips that rule for
  that frame rather than flagging on noise. (Threshold lives here in the contract so both
  sides agree.)

## Deliverables checklist

- [x] Schema validator (JSON Schema file) checked into repo — [schemas/cv-keypoints.schema.json](../../schemas/cv-keypoints.schema.json)
- [x] Interim producer implementation (BlazePose-tfjs) shipped and wired into the app,
      unit-tested end-to-end through `evaluate()` — see `app/__tests__/poseMapping.test.ts`
- [ ] On-device timing benchmark on Graham's iPhone (interim BlazePose-tfjs pipeline —
      not the ≥5 FPS native-module target, just "is 8-frame analysis fast enough to be
      usable")
- [ ] Native module benchmark: ≥5 FPS effective on iPhone 12 / Pixel 6 class hardware
      (target pipeline, needs EAS dev client — deferred, see SUPERVISOR-NOTES.md)
- [ ] 6 fixture clips (2 per lift: one clean, one with a known fault) with golden keypoint output
