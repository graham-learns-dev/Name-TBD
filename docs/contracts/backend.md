# Backend Agent — Auth, Data Model, API

**Owns:** auth, persistence, entitlements, program template serving.
**Must not:** run any CV/rule/render compute. CRUD only.

## Stack

**Supabase** (single recommendation, not a menu): Auth (email/Apple/Google), Postgres,
Row Level Security, Storage. Rationale: one vendor, RLS gives per-user data isolation for
free, and v1 backend is thin enough that rolling custom infra buys nothing. REST via
PostgREST + a handful of edge functions; no GraphQL in v1.

## Data model (Postgres)

```sql
-- users: managed by Supabase Auth (auth.users). App profile:
profiles (
  user_id uuid PK REFERENCES auth.users,
  display_name text,
  experience text CHECK (experience IN ('beginner','intermediate','advanced')),
  goal text,
  weight_unit text DEFAULT 'kg',
  progress_tracking boolean DEFAULT true,
  created_at timestamptz
)

subscriptions (
  user_id uuid PK REFERENCES profiles,
  tier text CHECK (tier IN ('free','paid')) DEFAULT 'free',
  store text CHECK (store IN ('apple','google')),
  original_transaction_id text,      -- receipt validation key
  expires_at timestamptz
)

programs (               -- static v1 templates, seeded from Programming-Logic JSON
  program_id text PK,
  name text,
  definition jsonb,      -- exact schema: contracts/programs.md
  is_free boolean,
  schema_version text
)

user_programs (
  user_id uuid REFERENCES profiles,
  program_id text REFERENCES programs,
  started_at timestamptz,
  current_week int,
  active boolean,
  PRIMARY KEY (user_id, program_id, started_at)
)

logged_sets (            -- exact payload: contracts/mobile-ui.md
  set_id uuid PK,        -- client-generated (offline-first, idempotent upsert)
  user_id uuid REFERENCES profiles,
  logged_at timestamptz,
  program_id text,
  program_week int,
  lift text CHECK (lift IN ('squat','bench','deadlift')),
  weight numeric, weight_unit text, reps int, rpe numeric,
  had_video boolean,
  rep_quality_score numeric,
  flag_summary text[]
)
```

**What is never stored server-side in v1:** video files, keypoints, per-frame anything.
`flag_summary` (names + severity) and the score are the only form-check residue, and only
when `progress_tracking = true`. Clip upload/storage is deferred entirely — v1 sharing
goes through the OS share sheet from a local file.

## Endpoints (v1 complete list)

| Method | Path | Notes |
|---|---|---|
| — | auth | Supabase Auth SDK (signup/login/OAuth) — not custom endpoints |
| GET | /programs | list templates, `is_free` visible to client for paywall |
| POST | /user_programs | select/start a program |
| PATCH | /user_programs | advance week / switch active |
| PUT | /logged_sets/:set_id | idempotent upsert (offline queue replays safely) |
| GET | /logged_sets?since= | paged fetch for history + prefill |
| GET | /entitlement | `{ tier, watermark_free }` — UI passes to Clip-Gen |
| POST | /iap/validate | edge function: verify App Store / Play receipt → subscriptions |

RLS: every table filtered to `auth.uid() = user_id`. Programs table read-only to clients.

## Retention policy (v1)

- `logged_sets`: kept until account deletion.
- Account deletion (App Store requirement — must ship in v1): edge function cascades
  profiles → subscriptions → user_programs → logged_sets, then deletes auth user. In-app
  button in Profile.
- No server logs containing set data beyond 30 days.

## Deliverables checklist

- [ ] OpenAPI spec for the table above, checked into repo
- [ ] RLS policies + tests (user A cannot read user B's sets)
- [ ] Receipt-validation edge function for both stores
- [ ] Account-deletion cascade + test
