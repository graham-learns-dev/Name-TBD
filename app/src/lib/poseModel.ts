// Interim CV backend: BlazePose running via TensorFlow.js's 'tfjs' runtime, chosen
// specifically because it works inside Expo Go (official expo-gl module only — no
// custom native module, so no EAS dev client / Apple Developer account needed to test
// on-device). docs/contracts/cv-keypoints.md still names MediaPipe as the target;
// BlazePose-tfjs is the *same underlying model* MediaPipe Pose uses, just executed
// through a different runtime, so its 33-landmark output and `keypoints3D` (hip-
// centered, roughly metric) map onto our existing schema with no rule-engine changes.
// Swapping to a native MediaPipe Tasks module later is a backend swap behind the same
// ClipKeypoints contract, not a rewrite. See docs/SUPERVISOR-NOTES.md (2026-07-28).
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import {
  createDetector,
  SupportedModels,
  type PoseDetector,
} from '@tensorflow-models/pose-detection';

let readyPromise: Promise<void> | null = null;
let detectorPromise: Promise<PoseDetector> | null = null;

function ensureTfReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = tf.ready();
  }
  return readyPromise;
}

/**
 * Lazily creates a single BlazePose detector for the app's lifetime. First call
 * triggers a model download (needs network) and a WebGL warm-up — expect it to take
 * several seconds longer than subsequent calls, which reuse the same instance.
 */
export function getDetector(): Promise<PoseDetector> {
  if (!detectorPromise) {
    detectorPromise = ensureTfReady().then(() =>
      createDetector(SupportedModels.BlazePose, {
        runtime: 'tfjs',
        modelType: 'full',
      }),
    );
  }
  return detectorPromise;
}
