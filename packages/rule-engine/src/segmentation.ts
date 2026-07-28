import type { ClipKeypoints, Frame } from './types.ts';
import { CONFIG } from './config.ts';
import { smooth } from './geometry.ts';

export interface RepSegment {
  startIdx: number;
  bottomIdx: number; // extremum: bottom for squat/bench, lockout for deadlift
  endIdx: number;
}

function trackY(clip: ClipKeypoints, f: Frame): number {
  if (clip.lift === 'squat') {
    const l = f.keypoints_px['left_hip'];
    const r = f.keypoints_px['right_hip'];
    if (l && r) return (l.y + r.y) / 2;
    return (l ?? r ?? f.bar_px).y;
  }
  return f.bar_px.y;
}

/**
 * Locate the single rep in the clip, per contracts/rule-engine.md.
 * Squat/bench: y descends (image y grows) to a max and returns.
 * Deadlift: bar y shrinks monotonically to lockout and plateaus.
 * Returns null when total excursion is below the min fraction of frame height.
 */
export function segmentRep(clip: ClipKeypoints): RepSegment | null {
  const n = clip.frames.length;
  if (n < 5) return null;

  const ys = smooth(clip.frames.map((f) => trackY(clip, f)));
  const base = ys[0];

  let ext = 0;
  for (let i = 1; i < n; i++) {
    const better =
      clip.lift === 'deadlift'
        ? ys[i] < ys[ext] // lockout = min bar y
        : ys[i] > ys[ext]; // bottom = max y
    if (better) ext = i;
  }

  const amp = Math.abs(ys[ext] - base);
  if (amp < CONFIG.min_rep_excursion_frac * clip.source.height_px) return null;

  const edge = CONFIG.rep_edge_frac * amp;

  let startIdx = 0;
  for (let i = ext; i >= 0; i--) {
    if (Math.abs(ys[i] - base) < edge) {
      startIdx = i;
      break;
    }
  }

  let endIdx = n - 1;
  if (clip.lift === 'deadlift') {
    endIdx = ext; // rep is floor -> lockout
  } else {
    for (let i = ext; i < n; i++) {
      if (Math.abs(ys[i] - base) < 2 * edge) {
        endIdx = i;
        break;
      }
    }
  }

  return { startIdx, bottomIdx: ext, endIdx };
}
