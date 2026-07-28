import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/index.ts';
import { makeBenchClip, makeDeadliftClip, makeSquatClip } from './fixtures.ts';

const issues = (r: ReturnType<typeof evaluate>) => r.flags.map((f) => f.issue).sort();

// ------------------------------------------------------------- squat

test('clean squat: no flags, perfect score', () => {
  const r = evaluate(makeSquatClip());
  assert.deepEqual(r.flags, []);
  assert.equal(r.rep_quality_score, 1);
  assert.ok(r.rep, 'rep window should be detected');
  assert.equal(r.skipped_rules.length, 0);
});

test('high squat: insufficient_depth flagged, always high severity', () => {
  const r = evaluate(makeSquatClip({ depthKneeY: 0.06 }));
  assert.deepEqual(issues(r), ['insufficient_depth']);
  assert.equal(r.flags[0].severity, 'high');
  assert.equal(r.rep_quality_score, 0.7);
});

test('knee valgus 18deg: flagged medium, measured matches injected fault', () => {
  const r = evaluate(makeSquatClip({ valgusDeg: 18 }));
  assert.deepEqual(issues(r), ['knee_valgus']);
  const f = r.flags[0];
  assert.equal(f.severity, 'medium'); // 18/12 = 1.5
  assert.ok(Math.abs(f.measured - 18) < 0.5, `measured ${f.measured} ≈ 18`);
  assert.equal(f.unit, 'deg');
  assert.ok(f.timestamp_ms > 0, 'flag carries a timestamp for clip-gen');
});

test('depth fail + valgus: penalties stack (0.3 + 0.15)', () => {
  const r = evaluate(makeSquatClip({ depthKneeY: 0.06, valgusDeg: 18 }));
  assert.deepEqual(issues(r), ['insufficient_depth', 'knee_valgus']);
  assert.equal(r.rep_quality_score, 0.55);
});

// ------------------------------------------------------------- deadlift

test('clean deadlift: no flags', () => {
  const r = evaluate(makeDeadliftClip());
  assert.deepEqual(r.flags, []);
  assert.equal(r.rep_quality_score, 1);
});

test('back rounding 20deg: flagged medium, measured matches', () => {
  const r = evaluate(makeDeadliftClip({ roundingDeg: 20 }));
  assert.deepEqual(issues(r), ['back_rounding']);
  const f = r.flags[0];
  assert.equal(f.severity, 'medium'); // 20/15 = 1.33
  assert.ok(Math.abs(f.measured - 20) < 1, `measured ${f.measured} ≈ 20`);
});

test('bar drift 0.7 shin lengths: flagged high', () => {
  const r = evaluate(makeDeadliftClip({ driftRatio: 0.7 }));
  assert.deepEqual(issues(r), ['bar_drift']);
  assert.equal(r.flags[0].severity, 'high'); // 0.7/0.35 = 2.0
});

// ------------------------------------------------------------- bench

test('clean bench: no flags', () => {
  const r = evaluate(makeBenchClip({ pathRatio: 0.2 }));
  assert.deepEqual(r.flags, []);
});

test('wandering bench bar path: flagged medium', () => {
  const r = evaluate(makeBenchClip({ pathRatio: 0.8 }));
  assert.deepEqual(issues(r), ['bar_path_deviation']);
  assert.equal(r.flags[0].severity, 'medium'); // 0.8/0.5 = 1.6
});

// ------------------------------------------------------------- guardrails

test('no rep in clip: single info flag, null score', () => {
  const r = evaluate(makeSquatClip({ pxAmplitude: 50 }));
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0].issue, 'no_rep_detected');
  assert.equal(r.flags[0].severity, 'info');
  assert.equal(r.rep_quality_score, null);
  assert.equal(r.rep, null);
});

test('low-confidence knees: squat rules skipped, never guessed', () => {
  const r = evaluate(makeSquatClip({ depthKneeY: 0.06, kneeConfidence: 0.3 }));
  assert.deepEqual(r.flags, []);
  assert.deepEqual(
    r.skipped_rules.map((s) => s.issue).sort(),
    ['insufficient_depth', 'knee_valgus'],
  );
});

test('failed view check: refuses to score', () => {
  const clip = makeSquatClip({ depthKneeY: 0.06 });
  clip.view_check = 'fail';
  const r = evaluate(clip);
  assert.equal(r.flags[0].issue, 'view_check_failed');
  assert.equal(r.rep_quality_score, null);
});

test('future keypoint schema version: fails loudly', () => {
  const clip = makeSquatClip();
  clip.schema_version = '2.0';
  assert.throws(() => evaluate(clip), /cannot read keypoint schema/);
});
