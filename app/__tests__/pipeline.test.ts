/**
 * Verifies the app-side integration seams that don't need a device:
 * - the rule engine is importable from app code (symlinked package, babel TS)
 * - the bundled demo clips produce the expected form-check outcomes
 * - the program templates bundle and satisfy what the UI reads from them
 *
 * A full App render test arrives once navigation test mocks are set up.
 * @format
 */

import { evaluate } from '@formcheck/rule-engine';
import { makeDemoSquat } from '../src/lib/demoClip';
import { PROGRAMS, getProgram, prescriptionFor, liftLabel } from '../src/lib/programs';

describe('form-check pipeline (app -> rule engine)', () => {
  test('clean demo rep scores 100 with no flags', () => {
    const r = evaluate(makeDemoSquat());
    expect(r.flags).toHaveLength(0);
    expect(r.rep_quality_score).toBe(1);
  });

  test('knee valgus demo rep is flagged', () => {
    const r = evaluate(makeDemoSquat({ valgusDeg: 18 }));
    expect(r.flags.map(f => f.issue)).toContain('knee_valgus');
    expect(r.rep_quality_score).toBeLessThan(1);
  });

  test('high squat demo rep is flagged high severity', () => {
    const r = evaluate(makeDemoSquat({ depthKneeY: 0.06 }));
    const depth = r.flags.find(f => f.issue === 'insufficient_depth');
    expect(depth?.severity).toBe('high');
  });
});

describe('bundled program templates', () => {
  test('both free programs bundle', () => {
    expect(PROGRAMS.map(p => p.program_id).sort()).toEqual([
      'beginner_full_body_3d',
      'beginner_upper_lower',
    ]);
  });

  test('every session week 1 has complete prescriptions', () => {
    for (const p of PROGRAMS) {
      for (const s of p.sessions) {
        for (const ex of s.exercises) {
          const rx = prescriptionFor(ex, 1);
          expect(rx).toBeDefined();
          expect(rx!.sets).toBeGreaterThan(0);
          expect(rx!.reps).toBeGreaterThan(0);
        }
      }
    }
  });

  test('trackable lifts are exactly the three form-checkable ones', () => {
    const trackable = new Set(
      PROGRAMS.flatMap(p => p.sessions)
        .flatMap(s => s.exercises)
        .filter(e => e.trackable)
        .map(e => e.lift),
    );
    expect([...trackable].sort()).toEqual(['bench', 'deadlift', 'squat']);
  });

  test('helpers behave', () => {
    expect(getProgram('beginner_full_body_3d').days_per_week).toBe(3);
    expect(liftLabel('romanian_deadlift')).toBe('Romanian Deadlift');
    expect(() => getProgram('nope')).toThrow();
  });
});
