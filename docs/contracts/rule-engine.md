# Rule-Engine Agent — Threshold Logic & Flag Contract

**Owns:** per-lift deterministic rules, severity mapping, rep quality score, rep segmentation.
**Inputs:** CV keypoint JSON (see [cv-keypoints.md](cv-keypoints.md)) + lift type.
**Consumers:** Clip-Gen (visualization directives), Mobile UI (Form Issues card).
**Must not:** render anything or touch video.

## Rep segmentation (prerequisite for every rule)

A 5–10 s clip is assumed to contain **one rep** (product spec), but users will film racking
and setup. Segment the rep before evaluating:

- Track bar_px.y (or hip y for squat) over time. Rep = local extremum between two plateaus.
- Squat/bench: descent → bottom (max y) → ascent. Deadlift: floor → lockout (min bar y) → (down).
- Rules evaluate only frames inside the segmented rep. If no rep detected → single flag
  `{"issue": "no_rep_detected", "severity": "info"}` and stop.

## V1 rules and thresholds

All angles computed from **world landmarks**. Left/right averaged when both ≥0.5 confidence;
single side used otherwise. Thresholds are launch values — tuned against fixture clips,
80% accuracy target, edge cases accepted.

### Squat (view: front_45)

| Rule | Measurement | Flag when | Evaluated at |
|---|---|---|---|
| `insufficient_depth` | hip-crease y vs knee y (world) | hip fails to descend below knee at bottom frame | bottom frame |
| `knee_valgus` | frontal-plane angle: knee deviation from hip–ankle line | > 12° medial for ≥3 consecutive sampled frames | ascent phase |

### Deadlift (view: side)

| Rule | Measurement | Flag when | Evaluated at |
|---|---|---|---|
| `back_rounding` | angle(shoulder–hip line vs hip–knee line), delta from setup frame | delta > 15° during pull | floor → knee-pass |
| `bar_drift` | horizontal distance bar_px to vertical line through mid-foot (heel–toe midpoint), normalized by shin length in px | > 0.35 × shin length | any pull frame |

### Bench (view: side)

| Rule | Measurement | Flag when | Evaluated at |
|---|---|---|---|
| `bar_path_deviation` | horizontal range of bar_px across the rep, normalized by forearm length in px | > 0.5 × forearm length | full rep |

> `elbow_flare` is **cut from v1** — it needs an overhead/front view that conflicts with the
> side view bar-path needs. See supervisor notes. Do not implement.

## Severity mapping (uniform across rules)

Let `m = measured / threshold` (how far past the line):

- `low`: 1.0 ≤ m < 1.25 — technical deviation, note it
- `medium`: 1.25 ≤ m < 1.75 — meaningful fault, lead the Form Issues card with it
- `high`: m ≥ 1.75, or any `insufficient_depth` (binary rule) — headline the clip overlay

`info` severity is reserved for non-faults (`no_rep_detected`, `low_confidence_skipped`).

## Rep quality score

`rep_quality_score = max(0, 1 − Σ penalty)` with penalty per flag: low 0.05, medium 0.15,
high 0.30. Clean rep = 1.0. Display as 0–100 in UI.

## Output schema

```json
{
  "schema_version": "1.0",
  "clip_id": "uuid",
  "lift": "squat",
  "rep": { "start_ms": 800, "bottom_ms": 2100, "end_ms": 3600 },
  "rep_quality_score": 0.72,
  "flags": [
    {
      "issue": "knee_valgus",
      "severity": "medium",
      "frame_index": 42,
      "timestamp_ms": 1400,
      "measured": 15.1,
      "threshold": 12.0,
      "unit": "deg",
      "description": "Knees caving inward on the way up",
      "viz": {
        "type": "angle",
        "keypoints": ["left_hip", "left_knee", "left_ankle"],
        "style": "warning"
      }
    }
  ],
  "skipped_rules": [
    { "issue": "bar_drift", "reason": "low_confidence" }
  ]
}
```

- `viz` is the **only** thing Clip-Gen may draw from a flag. Types: `angle` (three keypoints,
  arc drawn at middle one), `line` (two keypoints), `path` (trace `bar_px` across rep),
  `marker` (single keypoint circle). `style`: `warning` (amber) | `fault` (red) | `neutral`.
- `description` is the human-readable string shown verbatim in UI and on the clip. Plain
  language, no jargon, ≤ 60 chars. Coaching *advice* (how to fix it) is V2 — descriptions
  state what happened only.
- `timestamp_ms` mandatory on every flag — Clip-Gen seeks by time.

## Deliverables checklist

- [ ] Pure-function implementation: `(keypointJson, lift) → flagJson`, no I/O, unit-testable
- [ ] Golden tests against the 6 CV fixture clips (clean fixtures produce zero flags)
- [ ] Threshold constants in one config file, not scattered in code (tuning will happen)
