import type { Flag, Frame, Severity, SkippedRule, VizStyle } from './types.ts';
import { CONFIG } from './config.ts';
import { angleAtDeg, dist, valgusDeviationDeg } from './geometry.ts';
import type { RepSegment } from './segmentation.ts';

export interface LiftRuleOutput {
  flags: Flag[];
  skipped: SkippedRule[];
}

function severityFor(measured: number, threshold: number): Severity {
  const m = measured / threshold;
  const b = CONFIG.severity_bands;
  if (m >= b.high) return 'high';
  if (m >= b.medium) return 'medium';
  return 'low';
}

function styleFor(severity: Severity): VizStyle {
  return severity === 'high' ? 'fault' : 'warning';
}

/** True when every listed world landmark averages >= min_confidence over the frames. */
function confident(frames: Frame[], keys: string[], space: 'world' | 'px'): boolean {
  return keys.every((k) => {
    let sum = 0;
    let count = 0;
    for (const f of frames) {
      const p = space === 'world' ? f.keypoints_world[k] : f.keypoints_px[k];
      if (p) {
        sum += p.confidence;
        count++;
      }
    }
    return count > 0 && sum / count >= CONFIG.min_confidence;
  });
}

// ---------------------------------------------------------------- squat

export function squatRules(frames: Frame[], seg: RepSegment): LiftRuleOutput {
  const flags: Flag[] = [];
  const skipped: SkippedRule[] = [];
  const rep = frames.slice(seg.startIdx, seg.endIdx + 1);
  const bottom = frames[seg.bottomIdx];

  // insufficient_depth — binary rule, always high severity per contract.
  if (confident(rep, ['left_hip', 'right_hip', 'left_knee', 'right_knee'], 'world')) {
    let minKneeY = Infinity;
    for (const f of rep) {
      const l = f.keypoints_world['left_knee'];
      const r = f.keypoints_world['right_knee'];
      const y = l && r ? (l.y + r.y) / 2 : (l ?? r)!.y;
      minKneeY = Math.min(minKneeY, y);
    }
    if (minKneeY > CONFIG.squat.depth_knee_y_max_m) {
      flags.push({
        issue: 'insufficient_depth',
        severity: 'high',
        frame_index: bottom.frame_index,
        timestamp_ms: bottom.timestamp_ms,
        measured: Number(minKneeY.toFixed(3)),
        threshold: CONFIG.squat.depth_knee_y_max_m,
        unit: 'm',
        description: "Hips didn't reach depth (below the knee)",
        viz: { type: 'line', keypoints: ['left_hip', 'left_knee'], style: 'fault' },
      });
    }
  } else {
    skipped.push({ issue: 'insufficient_depth', reason: 'low_confidence' });
  }

  // knee_valgus — evaluated on the ascent, per leg, needs consecutive frames.
  const ascent = frames.slice(seg.bottomIdx + 1, seg.endIdx + 1);
  const valgusKeys = [
    'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  ];
  if (ascent.length > 0 && confident(ascent, valgusKeys, 'world')) {
    let worst: { dev: number; frame: Frame } | null = null;
    for (const side of ['left', 'right'] as const) {
      let run = 0;
      for (const f of ascent) {
        const hip = f.keypoints_world[`${side}_hip`];
        const knee = f.keypoints_world[`${side}_knee`];
        const ankle = f.keypoints_world[`${side}_ankle`];
        const midlineX =
          (f.keypoints_world['left_hip'].x + f.keypoints_world['right_hip'].x) / 2;
        const dev = valgusDeviationDeg(hip, knee, ankle, midlineX);
        if (dev > CONFIG.squat.valgus_deg) {
          run++;
          if (run >= CONFIG.squat.valgus_min_consecutive_frames &&
              (!worst || dev > worst.dev)) {
            worst = { dev, frame: f };
          }
        } else {
          run = 0;
        }
      }
    }
    if (worst) {
      const sev = severityFor(worst.dev, CONFIG.squat.valgus_deg);
      flags.push({
        issue: 'knee_valgus',
        severity: sev,
        frame_index: worst.frame.frame_index,
        timestamp_ms: worst.frame.timestamp_ms,
        measured: Number(worst.dev.toFixed(1)),
        threshold: CONFIG.squat.valgus_deg,
        unit: 'deg',
        description: 'Knees caving inward on the way up',
        viz: {
          type: 'angle',
          keypoints: ['left_hip', 'left_knee', 'left_ankle'],
          style: styleFor(sev),
        },
      });
    }
  } else {
    skipped.push({ issue: 'knee_valgus', reason: 'low_confidence' });
  }

  return { flags, skipped };
}

// ---------------------------------------------------------------- deadlift

export function deadliftRules(frames: Frame[], seg: RepSegment): LiftRuleOutput {
  const flags: Flag[] = [];
  const skipped: SkippedRule[] = [];
  const rep = frames.slice(seg.startIdx, seg.endIdx + 1);
  const setup = frames[seg.startIdx];

  // Pull frames from floor to knee-pass: bar still at/below knee height in image space.
  const belowKnee = (f: Frame) => {
    const knee = f.keypoints_px['left_knee'] ?? f.keypoints_px['right_knee'];
    return knee ? f.bar_px.y >= knee.y : false;
  };
  const pullToKnee = rep.filter(belowKnee);

  // back_rounding — shoulder-hip-knee angle delta vs setup (3D world angle,
  // orientation-robust for a side view).
  const roundingKeys = ['left_shoulder', 'left_hip', 'left_knee'];
  if (pullToKnee.length > 0 && confident(pullToKnee, roundingKeys, 'world')) {
    const torso = (f: Frame) =>
      angleAtDeg(
        f.keypoints_world['left_shoulder'],
        f.keypoints_world['left_hip'],
        f.keypoints_world['left_knee'],
      );
    const setupAngle = torso(setup);
    let worst: { delta: number; frame: Frame } | null = null;
    for (const f of pullToKnee) {
      const delta = Math.abs(torso(f) - setupAngle);
      if (delta > CONFIG.deadlift.rounding_delta_deg && (!worst || delta > worst.delta)) {
        worst = { delta, frame: f };
      }
    }
    if (worst) {
      const sev = severityFor(worst.delta, CONFIG.deadlift.rounding_delta_deg);
      flags.push({
        issue: 'back_rounding',
        severity: sev,
        frame_index: worst.frame.frame_index,
        timestamp_ms: worst.frame.timestamp_ms,
        measured: Number(worst.delta.toFixed(1)),
        threshold: CONFIG.deadlift.rounding_delta_deg,
        unit: 'deg',
        description: 'Lower back rounding off the floor',
        viz: {
          type: 'angle',
          keypoints: ['left_shoulder', 'left_hip', 'left_knee'],
          style: styleFor(sev),
        },
      });
    }
  } else {
    skipped.push({ issue: 'back_rounding', reason: 'low_confidence' });
  }

  // bar_drift — horizontal deviation from the vertical midfoot line, / shin length.
  const driftKeys = ['left_knee', 'left_ankle', 'left_heel', 'left_foot_index'];
  if (confident([setup], driftKeys, 'px')) {
    const midfootX =
      (setup.keypoints_px['left_heel'].x + setup.keypoints_px['left_foot_index'].x) / 2;
    const shin = dist(setup.keypoints_px['left_knee'], setup.keypoints_px['left_ankle']);
    if (shin > 0) {
      let worst: { ratio: number; frame: Frame } | null = null;
      for (const f of rep) {
        const ratio = Math.abs(f.bar_px.x - midfootX) / shin;
        if (ratio > CONFIG.deadlift.drift_shin_ratio && (!worst || ratio > worst.ratio)) {
          worst = { ratio, frame: f };
        }
      }
      if (worst) {
        const sev = severityFor(worst.ratio, CONFIG.deadlift.drift_shin_ratio);
        flags.push({
          issue: 'bar_drift',
          severity: sev,
          frame_index: worst.frame.frame_index,
          timestamp_ms: worst.frame.timestamp_ms,
          measured: Number(worst.ratio.toFixed(2)),
          threshold: CONFIG.deadlift.drift_shin_ratio,
          unit: 'shin_lengths',
          description: 'Bar drifting away from your legs',
          viz: { type: 'path', keypoints: ['bar'], style: styleFor(sev) },
        });
      }
    }
  } else {
    skipped.push({ issue: 'bar_drift', reason: 'low_confidence' });
  }

  return { flags, skipped };
}

// ---------------------------------------------------------------- bench

export function benchRules(frames: Frame[], seg: RepSegment): LiftRuleOutput {
  const flags: Flag[] = [];
  const skipped: SkippedRule[] = [];
  const rep = frames.slice(seg.startIdx, seg.endIdx + 1);
  const setup = frames[seg.startIdx];

  // bar_path_deviation — horizontal bar range across the rep, / forearm length.
  const pathKeys = ['left_wrist', 'left_elbow'];
  if (confident([setup], pathKeys, 'px')) {
    const forearm = dist(setup.keypoints_px['left_wrist'], setup.keypoints_px['left_elbow']);
    if (forearm > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxFrame = setup;
      for (const f of rep) {
        minX = Math.min(minX, f.bar_px.x);
        if (f.bar_px.x > maxX) {
          maxX = f.bar_px.x;
          maxFrame = f;
        }
      }
      const ratio = (maxX - minX) / forearm;
      if (ratio > CONFIG.bench.path_forearm_ratio) {
        const sev = severityFor(ratio, CONFIG.bench.path_forearm_ratio);
        flags.push({
          issue: 'bar_path_deviation',
          severity: sev,
          frame_index: maxFrame.frame_index,
          timestamp_ms: maxFrame.timestamp_ms,
          measured: Number(ratio.toFixed(2)),
          threshold: CONFIG.bench.path_forearm_ratio,
          unit: 'forearm_lengths',
          description: 'Bar path wandering between chest and lockout',
          viz: { type: 'path', keypoints: ['bar'], style: styleFor(sev) },
        });
      }
    }
  } else {
    skipped.push({ issue: 'bar_path_deviation', reason: 'low_confidence' });
  }

  return { flags, skipped };
}
