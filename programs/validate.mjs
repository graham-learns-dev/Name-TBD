// Minimal contract check for program templates (contracts/programs.md).
// Full JSON Schema + CI wiring lands with the repo scaffold.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const TRACKABLE = new Set(['squat', 'bench', 'deadlift']);
let failures = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const p = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const errs = [];

  if (p.schema_version !== '1.0') errs.push('schema_version must be 1.0');
  if (p.sessions.length !== p.days_per_week)
    errs.push(`sessions (${p.sessions.length}) != days_per_week (${p.days_per_week})`);
  if (p.deload_week > p.weeks) errs.push('deload_week beyond program length');

  for (const s of p.sessions) {
    for (const ex of s.exercises) {
      if (ex.trackable && !TRACKABLE.has(ex.lift))
        errs.push(`day ${s.day}: trackable lift "${ex.lift}" not in squat|bench|deadlift`);
      const weeks = ex.prescriptions.map((x) => x.week);
      for (let w = 1; w <= p.weeks; w++)
        if (!weeks.includes(w)) errs.push(`day ${s.day} ${ex.lift}: missing week ${w}`);
      for (const rx of ex.prescriptions) {
        const hasRpe = typeof rx.rpe_target === 'number';
        const hasPct = typeof rx.intensity_pct === 'number';
        if (hasRpe === hasPct)
          errs.push(`day ${s.day} ${ex.lift} wk${rx.week}: need exactly one of rpe_target|intensity_pct`);
        if (rx.week === p.deload_week && !rx.deload)
          errs.push(`day ${s.day} ${ex.lift} wk${rx.week}: deload week not marked deload`);
      }
    }
  }

  const trackableCount = p.sessions.flatMap((s) => s.exercises).filter((e) => e.trackable).length;
  if (trackableCount === 0) errs.push('no trackable lifts — nothing to form-check');

  if (errs.length) {
    failures++;
    console.error(`FAIL ${file}`);
    for (const e of errs) console.error(`  - ${e}`);
  } else {
    console.log(`ok   ${file} (${p.days_per_week}d x ${p.weeks}w, ${trackableCount} trackable slots)`);
  }
}

process.exit(failures ? 1 : 0);
