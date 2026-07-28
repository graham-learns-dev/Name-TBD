// I/O orchestration for the interim BlazePose-tfjs backend. The pure mapping logic
// lives in poseMapping.ts (kept free of these imports so it's unit-testable without a
// device); this file is the part that actually needs one.
import type { Tensor3D } from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { ClipKeypoints, Lift } from '@formcheck/rule-engine';
import { getDetector } from './poseModel';
import { posesToClipKeypoints, SAMPLE_COUNT, type SampledPose } from './poseMapping';

async function tensorFromThumbnail(uri: string): Promise<Tensor3D> {
  const file = new File(uri);
  const buffer = await file.arrayBuffer();
  return decodeJpeg(new Uint8Array(buffer));
}

/**
 * Extracts SAMPLE_COUNT still frames from the recorded video, runs the (lazily
 * loaded, reused) BlazePose detector on each, and maps the result into a
 * ClipKeypoints ready for @formcheck/rule-engine's evaluate(). Never throws for a
 * single bad frame — a frame that fails to decode/detect is just dropped.
 */
export async function extractClipKeypoints(
  videoUri: string,
  lift: Lift,
  durationMs: number,
): Promise<ClipKeypoints> {
  const detector = await getDetector();
  const clipId = `rec-${Date.now()}`;
  const span = Math.max(durationMs, 1000);
  const timestamps = Array.from({ length: SAMPLE_COUNT }, (_, i) =>
    Math.round(((i + 0.5) / SAMPLE_COUNT) * span),
  );

  const samples: SampledPose[] = [];
  for (const timestampMs of timestamps) {
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time: timestampMs });
      const tensor = await tensorFromThumbnail(thumb.uri);
      try {
        const poses = await detector.estimatePoses(tensor, { flipHorizontal: false });
        samples.push({
          timestampMs,
          width: thumb.width,
          height: thumb.height,
          pose: poses[0],
        });
      } finally {
        tensor.dispose();
      }
    } catch {
      samples.push({ timestampMs, width: 0, height: 0, pose: undefined });
    }
  }

  return posesToClipKeypoints({ clipId, lift, samples });
}
