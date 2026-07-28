# CV/Pose Agent — Keypoint Extraction Contract

**Owns:** MediaPipe Pose integration, frame sampling, coordinate normalization, camera-angle metadata.
**Consumer:** Rule-Engine (zero transformation — it reads this JSON as-is).
**Must not:** apply any thresholds or emit flags.

## Stack

- MediaPipe Pose Landmarker (Tasks API), `pose_landmarker_full` model, on-device.
- React Native binding: `react-native-mediapipe` (or a thin native module wrapping the
  iOS/Android Tasks SDKs if the RN wrapper underperforms — benchmark first, see notes).
- Target: process a 5–10 s clip at **10 FPS sampled** (not every frame). 30 FPS source →
  sample every 3rd frame. Keeps analysis under ~3 s on a mid-range phone.

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

- [ ] Native module benchmark: ≥5 FPS effective on iPhone 12 / Pixel 6 class hardware
- [ ] Schema validator (JSON Schema file) checked into repo, CI-enforced on fixtures
- [ ] 6 fixture clips (2 per lift: one clean, one with a known fault) with golden keypoint output
