// Mirrors contracts/cv-keypoints.md (input) and contracts/rule-engine.md (output).
// Any change here must land in the contract files first.

export type Lift = 'squat' | 'bench' | 'deadlift';
export type View = 'front_45' | 'side';
export type Severity = 'low' | 'medium' | 'high' | 'info';

export interface Point2D {
  x: number;
  y: number;
  confidence: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface Frame {
  frame_index: number;
  timestamp_ms: number;
  keypoints_px: Record<string, Point2D>;
  keypoints_world: Record<string, Point3D>;
  bar_px: Point2D;
}

export interface ClipKeypoints {
  schema_version: string;
  clip_id: string;
  lift: Lift;
  prescribed_view: View;
  view_check: 'pass' | 'warn' | 'fail';
  source: { width_px: number; height_px: number; fps: number; duration_ms: number };
  sampling: { sampled_fps: number; frame_stride: number };
  bar_proxy: 'wrist_midpoint' | 'shoulder_midpoint';
  frames: Frame[];
}

export type VizType = 'angle' | 'line' | 'path' | 'marker';
export type VizStyle = 'warning' | 'fault' | 'neutral';

export interface Viz {
  type: VizType;
  keypoints: string[];
  style: VizStyle;
}

export interface Flag {
  issue: string;
  severity: Severity;
  frame_index: number;
  timestamp_ms: number;
  measured: number;
  threshold: number;
  unit: string;
  description: string;
  viz: Viz | null;
}

export interface SkippedRule {
  issue: string;
  reason: 'low_confidence' | 'view_check_failed';
}

export interface RepWindow {
  start_ms: number;
  bottom_ms: number;
  end_ms: number;
}

export interface RuleResult {
  schema_version: string;
  clip_id: string;
  lift: Lift;
  rep: RepWindow | null;
  rep_quality_score: number | null;
  flags: Flag[];
  skipped_rules: SkippedRule[];
}
