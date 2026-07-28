import type { ClipKeypoints, Flag, RuleResult } from './types.ts';
import { CONFIG } from './config.ts';
import { segmentRep } from './segmentation.ts';
import { benchRules, deadliftRules, squatRules, type LiftRuleOutput } from './rules.ts';

export type { ClipKeypoints, RuleResult, Flag } from './types.ts';
export { CONFIG } from './config.ts';

const SCHEMA_VERSION = '1.0';

function infoFlag(issue: string, description: string): Flag {
  return {
    issue,
    severity: 'info',
    frame_index: 0,
    timestamp_ms: 0,
    measured: 0,
    threshold: 0,
    unit: '',
    description,
    viz: null,
  };
}

function scoreFor(flags: Flag[]): number {
  let penalty = 0;
  for (const f of flags) {
    if (f.severity === 'info') continue;
    penalty += CONFIG.penalties[f.severity];
  }
  return Math.max(0, Number((1 - penalty).toFixed(2)));
}

/**
 * The entire rule engine: pure function, no I/O.
 * Input schema: contracts/cv-keypoints.md. Output schema: contracts/rule-engine.md.
 */
export function evaluate(clip: ClipKeypoints): RuleResult {
  const base = {
    schema_version: SCHEMA_VERSION,
    clip_id: clip.clip_id,
    lift: clip.lift,
  };

  if (!clip.schema_version.startsWith('1.')) {
    throw new Error(
      `rule-engine ${SCHEMA_VERSION} cannot read keypoint schema ${clip.schema_version}`,
    );
  }

  if (clip.view_check === 'fail') {
    return {
      ...base,
      rep: null,
      rep_quality_score: null,
      flags: [infoFlag('view_check_failed', 'Camera angle unreadable — re-film')],
      skipped_rules: [],
    };
  }

  const seg = segmentRep(clip);
  if (!seg) {
    return {
      ...base,
      rep: null,
      rep_quality_score: null,
      flags: [infoFlag('no_rep_detected', "Couldn't find a rep in this clip")],
      skipped_rules: [],
    };
  }

  let out: LiftRuleOutput;
  if (clip.lift === 'squat') out = squatRules(clip.frames, seg);
  else if (clip.lift === 'deadlift') out = deadliftRules(clip.frames, seg);
  else out = benchRules(clip.frames, seg);

  return {
    ...base,
    rep: {
      start_ms: clip.frames[seg.startIdx].timestamp_ms,
      bottom_ms: clip.frames[seg.bottomIdx].timestamp_ms,
      end_ms: clip.frames[seg.endIdx].timestamp_ms,
    },
    rep_quality_score: scoreFor(out.flags),
    flags: out.flags,
    skipped_rules: out.skipped,
  };
}
