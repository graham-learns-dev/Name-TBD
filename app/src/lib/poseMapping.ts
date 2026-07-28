// Pure mapping stage, deliberately isolated from poseEstimation.ts's I/O imports
// (TFJS, expo-file-system, expo-video-thumbnails) so it's unit-testable in plain
// Jest/Node without a device, a model, or any native module.
//
// RawKeypoint/RawPose are local structural types, not imports from
// @tensorflow-models/pose-detection — its `Pose`/`Keypoint` shapes satisfy these by
// structural typing, but this file has zero runtime dependency on that package.
import type { ClipKeypoints, Frame, Lift, Point2D, Point3D, View } from '@formcheck/rule-engine';

export interface RawKeypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
  name?: string;
}

export interface RawPose {
  keypoints: RawKeypoint[];
  keypoints3D?: RawKeypoint[];
}

export interface SampledPose {
  timestampMs: number;
  width: number;
  height: number;
  pose: RawPose | undefined;
}

// Rolling-buffer capture (2026-07-28): CameraScreen records continuously in short
// segments and keeps only the last few, so the user never has to tap record before
// walking into position — see SUPERVISOR-NOTES.md for why (a fixed countdown was
// tried and worked, but this is strictly better UX). A Segment's `startMs` is its
// position on the *combined, rebased* timeline of whatever segments are still in the
// buffer when analysis starts — not wall-clock time, and not stable across a trim.
export interface Segment {
  uri: string;
  startMs: number;
  durationMs: number;
}

export interface ResolvedSample {
  uri: string;
  localMs: number;
}

/**
 * Pure: finds which segment covers `absoluteMs` on the combined timeline and the
 * local offset within that segment's own file. Clamps to the nearest segment if the
 * timestamp falls outside all of them (defensive — segments should be contiguous by
 * construction, but a clamp is cheap insurance against an off-by-one in the caller).
 */
export function resolveSegmentSample(segments: Segment[], absoluteMs: number): ResolvedSample | null {
  if (segments.length === 0) {
    return null;
  }
  for (const seg of segments) {
    if (absoluteMs >= seg.startMs && absoluteMs < seg.startMs + seg.durationMs) {
      return { uri: seg.uri, localMs: absoluteMs - seg.startMs };
    }
  }
  const first = segments[0];
  if (absoluteMs < first.startMs) {
    return { uri: first.uri, localMs: 0 };
  }
  const last = segments[segments.length - 1];
  return { uri: last.uri, localMs: Math.max(0, last.durationMs - 1) };
}

/** Pure: end time of the last segment on the combined timeline. */
export function totalSegmentsDurationMs(segments: Segment[]): number {
  if (segments.length === 0) {
    return 0;
  }
  const last = segments[segments.length - 1];
  return last.startMs + last.durationMs;
}

// Interim sampling rate. The CV contract targets 10 FPS sampled via a fast native
// pipeline; each BlazePose-tfjs inference on a phone GPU via WebGL takes on the order
// of hundreds of ms to ~1s, so sampling densely would make analysis take too long.
// This is a real, documented accuracy tradeoff (coarser rep segmentation, less precise
// worst-frame detection) versus the target native pipeline — see SUPERVISOR-NOTES.md.
// Bumped 8 -> 12 (2026-07-28) after Graham's first on-device test. The real root
// cause of that miss was the recording window including several seconds of him
// walking to the rack before the rep even started — fixed with a pre-record countdown
// in CameraScreen, not a shorter window (a shorter window was tried first and made
// things worse, since his setup time alone exceeded it). This frame-count bump is a
// smaller, independent improvement on top of that fix.
export const SAMPLE_COUNT = 12;

const PRESCRIBED_VIEW: Record<Lift, View> = {
  squat: 'front_45',
  deadlift: 'side',
  bench: 'side',
};

const NEEDED_KEYPOINTS = [
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
  'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index',
] as const;

export function barProxyFor(lift: Lift): 'wrist_midpoint' | 'shoulder_midpoint' {
  return lift === 'squat' ? 'shoulder_midpoint' : 'wrist_midpoint';
}

function midpoint(a: Point2D | undefined, b: Point2D | undefined): Point2D | undefined {
  if (!a || !b) {
    return a ?? b;
  }
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    confidence: Math.min(a.confidence, b.confidence),
  };
}

/**
 * Pure mapping stage: raw per-frame BlazePose output -> ClipKeypoints. No I/O.
 * Frames with no detected pose are dropped (rule-engine treats too few frames as
 * "no rep detected", which is the correct behavior when the person wasn't found).
 */
export function posesToClipKeypoints(params: {
  clipId: string;
  lift: Lift;
  samples: SampledPose[];
}): ClipKeypoints {
  const { clipId, lift, samples } = params;
  const prescribedView = PRESCRIBED_VIEW[lift];
  const barProxy = barProxyFor(lift);

  const detected = samples.filter((s) => s.pose && s.pose.keypoints.length > 0);
  const detectionRate = samples.length > 0 ? detected.length / samples.length : 0;
  const viewCheck: ClipKeypoints['view_check'] =
    detectionRate < 0.5 ? 'fail' : detectionRate < 0.8 ? 'warn' : 'pass';

  const frames: Frame[] = detected.map((s, i) => {
    const pose = s.pose!;
    const keypoints_px: Record<string, Point2D> = {};
    const keypoints_world: Record<string, Point3D> = {};

    for (const name of NEEDED_KEYPOINTS) {
      const kp2 = pose.keypoints.find((k) => k.name === name);
      if (kp2) {
        keypoints_px[name] = { x: kp2.x, y: kp2.y, confidence: kp2.score ?? 0 };
      }
      const kp3 = pose.keypoints3D?.find((k) => k.name === name);
      if (kp3) {
        keypoints_world[name] = {
          x: kp3.x,
          y: kp3.y,
          z: kp3.z ?? 0,
          confidence: kp3.score ?? 0,
        };
      }
    }

    const bar_px =
      barProxy === 'shoulder_midpoint'
        ? midpoint(keypoints_px.left_shoulder, keypoints_px.right_shoulder)
        : midpoint(keypoints_px.left_wrist, keypoints_px.right_wrist);

    return {
      frame_index: i,
      timestamp_ms: s.timestampMs,
      keypoints_px,
      keypoints_world,
      bar_px: bar_px ?? { x: 0, y: 0, confidence: 0 },
    };
  });

  const first = samples[0];
  return {
    schema_version: '1.0',
    clip_id: clipId,
    lift,
    prescribed_view: prescribedView,
    view_check: viewCheck,
    source: {
      width_px: first?.width ?? 0,
      height_px: first?.height ?? 0,
      fps: 30,
      duration_ms: samples.length > 0 ? samples[samples.length - 1].timestampMs : 0,
    },
    sampling: { sampled_fps: SAMPLE_COUNT, frame_stride: 1 },
    bar_proxy: barProxy,
    frames,
  };
}
