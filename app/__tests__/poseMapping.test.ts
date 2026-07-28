/**
 * Tests the pure BlazePose-output -> ClipKeypoints mapping in isolation. This file
 * only imports poseMapping.ts, which has zero TFJS/expo/native-module dependencies —
 * confirms the mapping logic without a device, a model, or a video file.
 * @format
 */
import { evaluate } from '@formcheck/rule-engine';
import {
  barProxyFor,
  posesToClipKeypoints,
  resolveSegmentSample,
  totalSegmentsDurationMs,
  type RawPose,
  type SampledPose,
  type Segment,
} from '../src/lib/poseMapping';

// A minimally-posed "standing" skeleton, all 16 needed landmarks present at
// reasonable confidence — enough to build valid frames without triggering any rule.
function standingPose(overrides: Record<string, { x: number; y: number; z?: number }> = {}): RawPose {
  const base: Record<string, { x: number; y: number; z: number }> = {
    left_shoulder: { x: 400, y: 300, z: 0 },
    right_shoulder: { x: 600, y: 300, z: 0 },
    left_elbow: { x: 380, y: 500, z: 0 },
    right_elbow: { x: 620, y: 500, z: 0 },
    left_wrist: { x: 370, y: 700, z: 0 },
    right_wrist: { x: 630, y: 700, z: 0 },
    left_hip: { x: 420, y: 900, z: 0 },
    right_hip: { x: 580, y: 900, z: 0 },
    left_knee: { x: 420, y: 1300, z: 0 },
    right_knee: { x: 580, y: 1300, z: 0 },
    left_ankle: { x: 420, y: 1700, z: 0 },
    right_ankle: { x: 580, y: 1700, z: 0 },
    left_heel: { x: 410, y: 1750, z: 0 },
    right_heel: { x: 590, y: 1750, z: 0 },
    left_foot_index: { x: 460, y: 1780, z: 0 },
    right_foot_index: { x: 540, y: 1780, z: 0 },
  };
  const names = Object.keys(base);
  const merged = { ...base, ...overrides };
  return {
    keypoints: names.map((name) => ({ ...merged[name], score: 0.9, name })),
    keypoints3D: names.map((name) => ({
      ...merged[name],
      x: merged[name].x / 1000,
      y: merged[name].y / 1000,
      z: (merged[name].z ?? 0) / 1000,
      score: 0.9,
      name,
    })),
  };
}

function sample(timestampMs: number, pose: RawPose | undefined): SampledPose {
  return { timestampMs, width: 1080, height: 1920, pose };
}

describe('barProxyFor', () => {
  test('squat uses shoulder midpoint, deadlift/bench use wrist midpoint', () => {
    expect(barProxyFor('squat')).toBe('shoulder_midpoint');
    expect(barProxyFor('deadlift')).toBe('wrist_midpoint');
    expect(barProxyFor('bench')).toBe('wrist_midpoint');
  });
});

describe('posesToClipKeypoints', () => {
  test('maps a fully-detected clip to view_check pass with all frames present', () => {
    const samples = Array.from({ length: 8 }, (_, i) => sample(i * 100, standingPose()));
    const clip = posesToClipKeypoints({ clipId: 'test-1', lift: 'squat', samples });

    expect(clip.view_check).toBe('pass');
    expect(clip.frames).toHaveLength(8);
    expect(clip.prescribed_view).toBe('front_45');
    expect(clip.bar_proxy).toBe('shoulder_midpoint');
    expect(clip.schema_version).toBe('1.0');
  });

  test('drops frames with no detected pose entirely, keeps the rest', () => {
    const samples = [
      sample(0, standingPose()),
      sample(100, undefined),
      sample(200, standingPose()),
    ];
    const clip = posesToClipKeypoints({ clipId: 'test-2', lift: 'bench', samples });
    expect(clip.frames).toHaveLength(2);
    expect(clip.frames.map((f) => f.timestamp_ms)).toEqual([0, 200]);
  });

  test('view_check fails when fewer than half the frames have a detected pose', () => {
    const samples = [
      sample(0, standingPose()),
      sample(100, undefined),
      sample(200, undefined),
      sample(300, undefined),
    ];
    const clip = posesToClipKeypoints({ clipId: 'test-3', lift: 'deadlift', samples });
    expect(clip.view_check).toBe('fail');
  });

  test('view_check warns in the 50-80% detection band', () => {
    const samples = [
      sample(0, standingPose()),
      sample(100, standingPose()),
      sample(200, standingPose()),
      sample(300, undefined),
    ];
    const clip = posesToClipKeypoints({ clipId: 'test-4', lift: 'squat', samples });
    expect(clip.view_check).toBe('warn');
  });

  test('bar_px is the shoulder midpoint for squat', () => {
    const samples = [sample(0, standingPose())];
    const clip = posesToClipKeypoints({ clipId: 'test-5', lift: 'squat', samples });
    // left_shoulder (400,300) + right_shoulder (600,300) -> midpoint (500,300)
    expect(clip.frames[0].bar_px).toEqual({ x: 500, y: 300, confidence: 0.9 });
  });

  test('bar_px is the wrist midpoint for deadlift', () => {
    const samples = [sample(0, standingPose())];
    const clip = posesToClipKeypoints({ clipId: 'test-6', lift: 'deadlift', samples });
    // left_wrist (370,700) + right_wrist (630,700) -> midpoint (500,700)
    expect(clip.frames[0].bar_px).toEqual({ x: 500, y: 700, confidence: 0.9 });
  });

  test('missing keypoints are simply absent from the frame, not zero-filled', () => {
    const pose = standingPose();
    pose.keypoints = pose.keypoints.filter((k) => k.name !== 'left_heel');
    pose.keypoints3D = pose.keypoints3D!.filter((k) => k.name !== 'left_heel');
    const clip = posesToClipKeypoints({ clipId: 'test-7', lift: 'deadlift', samples: [sample(0, pose)] });
    expect(clip.frames[0].keypoints_px.left_heel).toBeUndefined();
    expect(clip.frames[0].keypoints_px.right_heel).toBeDefined();
  });

  test('an empty samples array produces zero frames without throwing', () => {
    const clip = posesToClipKeypoints({ clipId: 'test-8', lift: 'squat', samples: [] });
    expect(clip.frames).toHaveLength(0);
    expect(clip.view_check).toBe('fail');
  });

  test('output is accepted by the real rule engine end-to-end', () => {
    // Not just schema-shaped — evaluate() actually runs on it without throwing, and a
    // clip with zero rep excursion correctly comes back as "no rep detected".
    const samples = Array.from({ length: 8 }, (_, i) => sample(i * 100, standingPose()));
    const clip = posesToClipKeypoints({ clipId: 'test-9', lift: 'squat', samples });
    const result = evaluate(clip);
    expect(result.flags[0]?.issue).toBe('no_rep_detected');
  });
});

// ------------------------------------------------------------------------------
// Rolling-buffer segment resolution (CameraScreen's segmented capture, 2026-07-28)

describe('resolveSegmentSample', () => {
  const segments: Segment[] = [
    { uri: 'seg-a', startMs: 0, durationMs: 3000 },
    { uri: 'seg-b', startMs: 3000, durationMs: 3000 },
    { uri: 'seg-c', startMs: 6000, durationMs: 1500 }, // final segment, cut short
  ];

  test('resolves a timestamp within the first segment', () => {
    expect(resolveSegmentSample(segments, 1000)).toEqual({ uri: 'seg-a', localMs: 1000 });
  });

  test('resolves a timestamp within a middle segment, offset correctly', () => {
    expect(resolveSegmentSample(segments, 4200)).toEqual({ uri: 'seg-b', localMs: 1200 });
  });

  test('resolves a timestamp exactly on a segment boundary to the later segment', () => {
    expect(resolveSegmentSample(segments, 3000)).toEqual({ uri: 'seg-b', localMs: 0 });
  });

  test('resolves a timestamp in the short final segment', () => {
    expect(resolveSegmentSample(segments, 7000)).toEqual({ uri: 'seg-c', localMs: 1000 });
  });

  test('clamps a timestamp past the end of all segments to the last one', () => {
    expect(resolveSegmentSample(segments, 99999)).toEqual({ uri: 'seg-c', localMs: 1499 });
  });

  test('clamps a negative timestamp to the start of the first segment', () => {
    expect(resolveSegmentSample(segments, -500)).toEqual({ uri: 'seg-a', localMs: 0 });
  });

  test('returns null for an empty segment list', () => {
    expect(resolveSegmentSample([], 1000)).toBeNull();
  });

  test('handles a single segment', () => {
    const single: Segment[] = [{ uri: 'only', startMs: 0, durationMs: 3000 }];
    expect(resolveSegmentSample(single, 1500)).toEqual({ uri: 'only', localMs: 1500 });
  });
});

describe('totalSegmentsDurationMs', () => {
  test('sums to the end of the last segment, not a naive sum of durations', () => {
    const segments: Segment[] = [
      { uri: 'a', startMs: 0, durationMs: 3000 },
      { uri: 'b', startMs: 3000, durationMs: 1200 }, // shorter, cut short by "Got it!"
    ];
    expect(totalSegmentsDurationMs(segments)).toBe(4200);
  });

  test('is zero for an empty list', () => {
    expect(totalSegmentsDurationMs([])).toBe(0);
  });
});
