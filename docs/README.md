# [APP_NAME] — V1 Contract Pack

Working name pending. Placeholder `[APP_NAME]` used in specs; watermark asset is a swap-in.

## What this is

The integration contracts for the six V1 workstreams. Each file is the input/output
contract one "agent" (workstream) owns. Nothing ships to a downstream consumer
until it matches these schemas.

| Contract | Owner | Consumed by |
|---|---|---|
| [cv-keypoints.md](contracts/cv-keypoints.md) | CV/Pose | Rule-Engine |
| [rule-engine.md](contracts/rule-engine.md) | Rule-Engine | Clip-Gen, Mobile UI |
| [clip-generation.md](contracts/clip-generation.md) | Clip-Gen | Mobile UI (share sheet) |
| [mobile-ui.md](contracts/mobile-ui.md) | Mobile UI | Backend (logged sets) |
| [backend.md](contracts/backend.md) | Backend | Mobile UI, Programming-Logic |
| [programs.md](contracts/programs.md) | Programming-Logic | Backend (storage), Mobile UI (display) |

## Non-negotiables (from product spec)

- Pose estimation on-device only. No video leaves the phone unless the user shares.
- Rule logic is deterministic thresholds. No ML classification, no custom models.
- Watermark on free-tier clips is a **feature** (acquisition loop), not a limitation.
- V1 scope: form checker + set logging + static program templates. Anything else is V2.
