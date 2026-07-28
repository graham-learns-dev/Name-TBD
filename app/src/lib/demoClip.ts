// Bundled synthetic keypoint clips so the full log -> analyze -> results loop works
// before the camera + MediaPipe native module lands. Same parametric approach as the
// rule-engine test fixtures: injected fault magnitude == measured value.
import type { ClipKeypoints } from '@formcheck/rule-engine';

const N = 30; // 3 s at 10 FPS sampled

const kp2 = (x: number, y: number, confidence = 0.95) => ({ x, y, confidence });
const kp3 = (x: number, y: number, z = 0, confidence = 0.95) => ({ x, y, z, confidence });
const downUp = (i: number) => (i < 5 || i > 25 ? 0 : Math.sin((Math.PI * (i - 5)) / 20));

export function makeDemoSquat(opts: { depthKneeY?: number; valgusDeg?: number } = {}): ClipKeypoints {
  const { depthKneeY = -0.03, valgusDeg = 0 } = opts;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = downUp(i);
    const hipY = 900 + 400 * s;
    const kneeY = 0.45 - (0.45 - depthKneeY) * s;
    const valgusFrame = valgusDeg > 0 && i >= 17 && i <= 22;
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
        left_knee: valgusFrame
          ? kp3(-0.09 + 0.45 * Math.tan((valgusDeg * Math.PI) / 180), 0.45)
          : kp3(-0.09, kneeY),
        right_knee: kp3(0.09, kneeY),
        left_ankle: kp3(-0.09, valgusFrame ? 0.9 : kneeY + 0.45),
        right_ankle: kp3(0.09, kneeY + 0.45),
      },
      bar_px: kp2(540, 500 + 400 * s),
    });
  }
  return {
    schema_version: '1.0',
    clip_id: `demo-squat-${Date.now()}`,
    lift: 'squat',
    prescribed_view: 'front_45',
    view_check: 'pass',
    source: { width_px: 1080, height_px: 1920, fps: 30, duration_ms: N * 100 },
    sampling: { sampled_fps: 10, frame_stride: 3 },
    bar_proxy: 'shoulder_midpoint',
    frames,
  };
}

/** Rotate through demo scenarios so repeated taps show different outcomes. */
const SCENARIOS = [
  { label: 'clean rep', make: () => makeDemoSquat() },
  { label: 'knees caving', make: () => makeDemoSquat({ valgusDeg: 18 }) },
  { label: 'high squat', make: () => makeDemoSquat({ depthKneeY: 0.06 }) },
  { label: 'high + caving', make: () => makeDemoSquat({ depthKneeY: 0.06, valgusDeg: 20 }) },
];

let cursor = 0;
export function nextDemoClip(): { label: string; clip: ClipKeypoints } {
  const s = SCENARIOS[cursor % SCENARIOS.length];
  cursor++;
  return { label: s.label, clip: s.make() };
}
