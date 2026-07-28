# Clip-Generation Agent — Overlay & Export Contract

**Owns:** annotated-clip rendering, watermarking, 9:16 export.
**Inputs:** original video file, CV keypoint JSON (for overlay positions), Rule-Engine flag JSON.
**Output:** local MP4, 1080×1920, ready for the OS share sheet.
**Must not:** recompute or reinterpret pose data — draw exactly what `viz` directives say.

## Rendering stack — DECIDED 2026-07-28: native composition

- iOS: AVFoundation — `AVMutableVideoComposition` + Core Animation overlay layer.
- Android: Media3 Transformer with an OpenGL/Canvas overlay effect.
- **No ffmpeg anywhere in the pipeline.** (The spec's original suggestion, ffmpeg-kit,
  was retired and its binaries pulled in early 2025; vendored ffmpeg was considered and
  rejected for license/maintenance burden.)

## Output spec

- 1080×1920 (9:16), H.264 + AAC, ≤ 15 s, target ≤ 12 Mbps.
- Source video is center-cropped/scaled to 9:16. Keypoint pixel coords are transformed by
  the same crop matrix — Clip-Gen owns this transform (CV coords are in source space).
- Playback structure: full rep at 1×; if any `high`/`medium` flag exists, follow with a
  2 s slow-mo replay of ±500 ms around the worst flag's `timestamp_ms`.

## Overlay layers (bottom → top)

1. **Skeleton** (optional, on by default): lines between the 14 contract keypoints, 60% white.
2. **Viz directives** from flags: `angle` arcs, `line`, `path` trace, `marker` — colors:
   `warning` = amber #FFB020, `fault` = red #FF4438, `neutral` = white.
3. **Flag caption**: worst flag's `description` text, bottom third, appears at flag time.
4. **Stats bar** (if set data provided by UI): `225 lb × 5 @ RPE 8` + date, top corner.
5. **Watermark** (free tier): `[APP_NAME]` logo lockup, bottom-right, 8% height, 90% opacity,
   present on **every frame**. Paid tier (`entitlement.watermark_free == true` passed in by
   UI from backend): watermark omitted. The watermark is the acquisition loop — it is not
   optional on free tier and there is no debug flag to disable it in release builds.

## Input contract

```json
{
  "video_uri": "file://...",
  "keypoint_json": { "...": "cv-keypoints.md schema" },
  "flag_json": { "...": "rule-engine.md schema" },
  "set_stats": { "weight": 102.5, "unit": "kg", "reps": 5, "rpe": 8, "date": "2026-07-28" },
  "entitlement": { "watermark_free": false },
  "options": { "skeleton": true, "slow_mo_replay": true }
}
```

`set_stats` and both JSONs are pass-through data — Clip-Gen validates schema versions match
and fails loudly on mismatch rather than rendering wrong overlays.

## Performance budget

End-to-end (analysis done → MP4 on disk) ≤ 6 s for a 8 s clip on mid-range hardware.
This is the long pole in the "log set → see clip ≤ 10 s" success criterion — budget:
CV ~3 s, rules <100 ms, render ~6 s, UI slack ~1 s.

## Deliverables checklist

- [ ] Render pipeline PoC on both platforms with a static overlay before wiring real data
- [ ] Golden-frame tests: render fixture flag JSON → compare key frames against approved PNGs
- [ ] Verify share sheet → Instagram Reels accepts the file (aspect, codec, duration)
