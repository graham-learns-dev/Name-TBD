# Mobile UI Agent — Screens, Navigation, UX Flow

**Owns:** all screens, navigation, camera capture UX, share flow.
**Consumes:** flag JSON (Form Issues card), program schema (workout display), clip MP4 (share).
**Produces:** logged-set payloads to Backend.
**Must not:** contain CV, rule, or rendering logic — orchestrate the pipeline via module APIs.

## Stack

React Native (one codebase; CV + clip render are native modules behind JS interfaces).
Navigation: React Navigation, native stack.

## Navigation tree

```
Root
├─ Auth stack (signed out)
│  ├─ Welcome
│  ├─ SignIn (email / Apple / Google)
│  └─ Onboarding: goal + experience → program assignment
└─ Main tabs (signed in)
   ├─ Today (default)        — workout of the day from active program
   │   └─ SetLogger (modal)  — the core loop, below
   ├─ Program                — current program overview, week view, switch program
   └─ Profile                — units, history list, upgrade, sign out
```

## The core loop: SetLogger

Speed is the whole game — logging a set with no video must take **≤ 4 taps**.

```
Today screen shows next prescribed set (lift, target sets×reps, target intensity)
 → [Log set] opens SetLogger with lift + weight prefilled from program/last session
 → user adjusts weight/reps, picks RPE (single-row 6–10 selector, optional)
 → [Save]  ──────────────► set logged, back to Today            (no-video path)
 → [Save + record] ──────► Camera screen                        (video path)
```

Camera screen:
1. **Angle guide overlay** per lift (front-45 for squat, side for deadlift/bench) —
   silhouette + one line of instruction ("Film from the side, whole body in frame").
   This is load-bearing: rules are only valid from the prescribed angle.
2. Record (5–10 s cap) → auto-stop → Analyzing spinner (CV + rules run)
3. If `view_check == fail`: "Couldn't read this angle — re-film from the side" + retake.
4. Results screen:
   - Annotated clip player (Clip-Gen output)
   - **Form Issues card**: rep quality score (0–100 ring), flags listed worst-first as
     `severity chip + description`. Zero flags → "Clean rep ✓".
   - Primary CTA: **[Share]** (OS share sheet). Secondary: [Save to history], [Retake].

Total time budget signup-excluded: record → share ≤ 15 s of user-perceived work.

## Logged-set payload (UI → Backend)

```json
{
  "set_id": "uuid-client-generated",
  "logged_at": "2026-07-28T18:32:11Z",
  "program_id": "beginner_upper_lower",
  "program_week": 2,
  "lift": "squat",
  "weight": 102.5,
  "weight_unit": "kg",
  "reps": 5,
  "rpe": 8,
  "had_video": true,
  "rep_quality_score": 0.72,
  "flag_summary": ["knee_valgus:medium"]
}
```

Note what's **not** in it: no video, no keypoints, no frames. Only score + flag names leave
the device, and only if the user has progress tracking on (default on, disclosed at onboarding).
Client-generated `set_id` + offline queue → logging works in a basement gym; sync when online.

## Upgrade surface (v1: two touchpoints only)

1. Share/results screen: small "Remove watermark" link under the clip.
2. Program tab: locked program templates show paywall on tap.
No interstitials, no timers. The free tier must feel generous — it's the growth engine.

## Deliverables checklist

- [ ] Clickable flow prototype: signup → first workout → log → record → results → share
- [ ] Empty/error states: camera denied, analysis failed, view_check fail, offline
- [ ] Tap-count audit of SetLogger against the ≤ 4 taps target
