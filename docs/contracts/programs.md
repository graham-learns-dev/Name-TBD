# Programming-Logic Agent — Template Schema & V1 Programs

**Owns:** program JSON schema, the 4–6 static v1 templates, week-advance rule.
**Must not:** any AI/auto-progression (V2), any runtime generation. V1 is data, not logic.

## Schema

Deviations from the original sketch, with reasons:
- `intensity` as fraction of 1RM assumed a known 1RM — beginners don't have one. Prescriptions
  use **either** `intensity_pct` (of training max) **or** `rpe_target`, per exercise per week.
  Templates for beginners use RPE; intermediate templates may use percentages after the user
  enters a training max.
- Weeks are explicit objects (not `week_1` keys) so week count is data-driven.
- `progression_note` is display text only — no logic reads it in v1.

```json
{
  "schema_version": "1.0",
  "program_id": "beginner_full_body_3d",
  "name": "Full Body Foundations",
  "description": "3 days/week, RPE-based, for lifters in their first year.",
  "level": "beginner",
  "days_per_week": 3,
  "weeks": 4,
  "deload_week": 4,
  "is_free": true,
  "sessions": [
    {
      "day": 1,
      "name": "Full Body A",
      "exercises": [
        {
          "lift": "squat",
          "trackable": true,
          "prescriptions": [
            { "week": 1, "sets": 3, "reps": 5, "rpe_target": 7 },
            { "week": 2, "sets": 3, "reps": 5, "rpe_target": 7.5 },
            { "week": 3, "sets": 4, "reps": 5, "rpe_target": 8 },
            { "week": 4, "sets": 2, "reps": 5, "rpe_target": 6, "deload": true }
          ],
          "progression_note": "Add 2.5 kg when all sets hit target RPE or lower."
        },
        {
          "lift": "romanian_deadlift",
          "trackable": false,
          "prescriptions": [ { "week": 1, "sets": 3, "reps": 8, "rpe_target": 7 } ]
        }
      ]
    }
  ]
}
```

- `trackable: true` marks the three competition lifts — only these get the record-video
  affordance in SetLogger. Accessories are loggable (weight/reps) but never form-checked.
  This keeps the CV scope honest: squat/bench/deadlift only.
- `lift` values for trackable exercises must be exactly `squat | bench | deadlift`
  (matches CV/rule/backend enums). Accessory names are free-form display strings.

## V1 template lineup (5 programs)

| program_id | Level | Days | Weeks | Free? |
|---|---|---|---|---|
| beginner_full_body_3d | beginner | 3 | 4 | ✅ |
| beginner_upper_lower | beginner | 4 | 4 | ✅ |
| int_upper_lower | intermediate | 4 | 6 | paid |
| int_sbd_focus | intermediate | 4 | 6 | paid |
| int_full_body_3d | intermediate | 3 | 6 | paid |

Two free programs is deliberate: enough to make the free tier real, few enough that
"more programs" is a concrete upgrade reason.

## Week advancement (the only "logic" in v1)

Client-side rule, no server compute: when the user completes the last session of the
current week (all trackable exercises have ≥1 logged set), UI offers "Start week N+1" →
`PATCH /user_programs`. After the final week: "Restart program" (v1) — auto-progressed
re-run is V2.

## Deliverables checklist

- [ ] JSON Schema file + validation in CI
- [ ] 5 template JSONs authored and reviewed by someone who actually lifts
- [ ] Seed script loading templates into the `programs` table
