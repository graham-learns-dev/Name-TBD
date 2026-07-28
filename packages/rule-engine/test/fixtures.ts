// Parametric synthetic clips. Real fixture footage replaces these once the CV
// workstream delivers golden keypoint output; the geometry here is deliberately
// idealized so each rule's measured value equals the injected fault magnitude.

import type { ClipKeypoints, Frame, Point2D, Point3D } from '../src/types.ts';

const N = 30; // frames @ 100 ms (10 FPS sampled, 3 s clip)

const kp2 = (x: number, y: number, confidence = 0.95): Point2D => ({ x, y, confidence });
const kp3 = (x: number, y: number, z = 0, confidence = 0.95): Point3D => ({ x, y, z, confidence });

/** 0 -> 1 -> 0 half-sine between frames 5 and 25 (descent/ascent). */
const downUp = (i: number) => (i < 5 || i > 25 ? 0 : Math.sin((Math.PI * (i - 5)) / 20));
/** 0 -> 1 quarter-sine between frames 5 and 25, then holds (deadlift pull). */
const pull = (i: number) => (i < 5 ? 0 : i > 25 ? 1 : Math.sin((Math.PI / 2) * ((i - 5) / 20)));

function clip(lift: ClipKeypoints['lift'], view: ClipKeypoints['prescribed_view'],
              barProxy: ClipKeypoints['bar_proxy'], frames: Frame[]): ClipKeypoints {
  return {
    schema_version: '1.0',
    clip_id: `fixture-${lift}`,
    lift,
    prescribed_view: view,
    view_check: 'pass',
    source: { width_px: 1080, height_px: 1920, fps: 30, duration_ms: N * 100 },
    sampling: { sampled_fps: 10, frame_stride: 3 },
    bar_proxy: barProxy,
    frames,
  };
}

export function makeSquatClip(opts: {
  depthKneeY?: number;      // world knee y at the bottom; <= 0 means depth reached
  valgusDeg?: number;       // medial knee deviation injected on the ascent
  kneeConfidence?: number;
  pxAmplitude?: number;     // hip pixel excursion (small value => no rep)
} = {}): ClipKeypoints {
  const {
    depthKneeY = -0.03, valgusDeg = 0, kneeConfidence = 0.95, pxAmplitude = 400,
  } = opts;

  const frames: Frame[] = [];
  for (let i = 0; i < N; i++) {
    const s = downUp(i);
    const hipY = 900 + pxAmplitude * s;
    const kneeY = 0.45 - (0.45 - depthKneeY) * s;

    // Ascent frames 17-22 get fixed geometry so the injected valgus angle is exact.
    const valgusFrame = valgusDeg > 0 && i >= 17 && i <= 22;
    const leftKnee = valgusFrame
      ? kp3(-0.09 + 0.45 * Math.tan((valgusDeg * Math.PI) / 180), 0.45, 0, kneeConfidence)
      : kp3(-0.09, kneeY, 0, kneeConfidence);
    const leftAnkleY = valgusFrame ? 0.9 : kneeY + 0.45;

    frames.push({
      frame_index: i * 3,
      timestamp_ms: i * 100,
      keypoints_px: {
        left_hip: kp2(500, hipY),
        right_hip: kp2(580, hipY),
      },
      keypoints_world: {
        left_hip: kp3(-0.09, 0),
        right_hip: kp3(0.09, 0),
        left_knee: leftKnee,
        right_knee: kp3(0.09, kneeY, 0, kneeConfidence),
        left_ankle: kp3(-0.09, leftAnkleY),
        right_ankle: kp3(0.09, kneeY + 0.45),
      },
      bar_px: kp2(540, 500 + pxAmplitude * s),
    });
  }
  return clip('squat', 'front_45', 'shoulder_midpoint', frames);
}

export function makeDeadliftClip(opts: {
  roundingDeg?: number;   // extra torso tilt injected while the bar is below the knee
  driftRatio?: number;    // peak horizontal bar drift in shin lengths
} = {}): ClipKeypoints {
  const { roundingDeg = 0, driftRatio = 0 } = opts;
  const t0 = (30 * Math.PI) / 180; // setup torso tilt from vertical
  const shinPx = 600;              // |knee(560,1100) - ankle(550,1700)| ≈ 600

  const frames: Frame[] = [];
  for (let i = 0; i < N; i++) {
    const p = pull(i);
    const tilt = t0 + (roundingDeg > 0 && i >= 8 && i <= 10 ? (roundingDeg * Math.PI) / 180 : 0);
    frames.push({
      frame_index: i * 3,
      timestamp_ms: i * 100,
      keypoints_px: {
        left_knee: kp2(560, 1100),
        left_ankle: kp2(550, 1700),
        left_heel: kp2(540, 1750),
        left_foot_index: kp2(620, 1750),
      },
      keypoints_world: {
        left_hip: kp3(0, 0),
        left_knee: kp3(0.25, 0.35),
        left_shoulder: kp3(0.5 * Math.sin(tilt), -0.5 * Math.cos(tilt)),
      },
      bar_px: kp2(580 + driftRatio * shinPx * downUp(i), 1400 - 700 * p),
    });
  }
  return clip('deadlift', 'side', 'wrist_midpoint', frames);
}

export function makeBenchClip(opts: { pathRatio?: number } = {}): ClipKeypoints {
  const { pathRatio = 0 } = opts;
  const frames: Frame[] = [];
  for (let i = 0; i < N; i++) {
    const s = downUp(i);
    frames.push({
      frame_index: i * 3,
      timestamp_ms: i * 100,
      keypoints_px: {
        left_wrist: kp2(500, 600 + 400 * s),
        left_elbow: kp2(500, 850),
      },
      keypoints_world: {},
      bar_px: kp2(500 + pathRatio * 250 * s, 600 + 400 * s),
    });
  }
  return clip('bench', 'side', 'wrist_midpoint', frames);
}
