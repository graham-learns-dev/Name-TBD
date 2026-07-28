import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { colors, spacing } from '../theme';
import { Button, Dim } from '../components/ui';
import { totalSegmentsDurationMs, type Segment } from '../lib/poseMapping';
import { liftLabel } from '../lib/programs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

// Prescribed filming angle per lift — docs/contracts/cv-keypoints.md "Required camera
// angle". Rules are only valid from the angle they were designed for.
const GUIDE: Record<string, { instruction: string }> = {
  squat: { instruction: 'Film from a 45° angle — whole body in frame' },
  deadlift: { instruction: 'Film from the side — whole body in frame' },
  bench: { instruction: 'Film from the side — head to hips in frame' },
};

// Rolling-buffer capture: records continuously in short segments the moment the
// camera is ready — no tap-to-start. Root-caused on Graham's first on-device test
// (2026-07-28): a fixed record window meant walking to the rack ate into it and
// sometimes ate the whole rep. A pre-record countdown fixed that but still forces a
// fixed schedule; this is strictly better — take however long you need, tap "Got it!"
// whenever the rep is done, and we use whatever's still in the last ~15s of buffer.
// See docs/contracts/cv-keypoints.md and SUPERVISOR-NOTES.md for the segment-file
// (not true frame-buffer) approach.
const SEGMENT_S = 3;
const MAX_SEGMENTS = 5; // ~15s rolling window
// A segment can fail while the camera is still warming up. Round 1 showed the buffer
// silently staying empty forever — this retries instead of giving up after one bad go.
const MAX_CONSECUTIVE_FAILURES = 5;
// Round 2 (2026-07-28) confirmed the real risk flagged in the docs: recordAsync()
// hung for 2+ minutes on Graham's phone, not honoring its own maxDuration at all —
// a native-module issue, not something client code can prevent, only bound. Every
// recordAsync() call now races against this timeout; if it fires, we treat that
// attempt as failed and move on rather than hang indefinitely on a promise that may
// never settle.
const SEGMENT_TIMEOUT_MS = SEGMENT_S * 1000 + 3000;
// Extra safety net on top of the per-segment timeout above, in case some other path
// slips past it — the "Got it!" -> next screen transition should never take longer
// than this no matter what the camera does.
const FINISH_TIMEOUT_MS = SEGMENT_TIMEOUT_MS + 2000;

export function CameraScreen({ navigation, route }: Props) {
  const { set } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<'buffering' | 'finishing' | 'error'>('buffering');
  const [bufferedMs, setBufferedMs] = useState(0);
  // Bumped on retry to force the capture effect to re-run — it depends on
  // permission.granted alone, which doesn't change between attempts.
  const [attempt, setAttempt] = useState(0);

  const segmentsRef = useRef<Segment[]>([]);
  const finishingRef = useRef(false);
  const mountedRef = useRef(true);
  // Guards against the per-segment timeout path and the finish-timeout path both
  // trying to navigate/error at once.
  const settledRef = useRef(false);

  const guide = GUIDE[set.lift] ?? GUIDE.squat;

  const settle = () => {
    if (settledRef.current || !mountedRef.current) {
      return;
    }
    settledRef.current = true;
    if (segmentsRef.current.length === 0) {
      setPhase('error');
    } else {
      navigation.navigate('Results', { set, segments: segmentsRef.current });
    }
  };

  useEffect(() => {
    // Gated on permission only, NOT on the onCameraReady callback — that callback's
    // reliability on real hardware is unverified, and gating a required action on an
    // unverified signal is exactly what left Graham staring at a dead button with no
    // feedback on round 1. recordAsync() failing before the camera is truly ready is
    // now just an ordinary retry case below, not a hard dependency.
    if (!permission?.granted) {
      return;
    }
    mountedRef.current = true;
    finishingRef.current = false;
    settledRef.current = false;
    segmentsRef.current = [];
    setBufferedMs(0);
    setPhase('buffering');

    async function recordOneSegment(): Promise<{ uri: string; durationMs: number } | null> {
      if (!camRef.current) {
        return null;
      }
      const segStart = Date.now();
      try {
        const outcome = await Promise.race([
          camRef.current.recordAsync({ maxDuration: SEGMENT_S }),
          new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), SEGMENT_TIMEOUT_MS)),
        ]);
        if (outcome === 'timeout') {
          // recordAsync() didn't resolve even past its own maxDuration plus a grace
          // period. Nudge stopRecording() defensively (harmless no-op if nothing's
          // actually in progress) and treat this attempt as failed so the loop can
          // retry instead of hanging indefinitely on a promise that may never settle.
          camRef.current?.stopRecording();
          return null;
        }
        const durationMs = Date.now() - segStart;
        if (!outcome?.uri || durationMs < 200) {
          return null;
        }
        return { uri: outcome.uri, durationMs };
      } catch {
        return null;
      }
    }

    async function loop() {
      let consecutiveFailures = 0;
      while (!finishingRef.current) {
        const result = await recordOneSegment();
        if (!mountedRef.current) {
          return;
        }
        if (!result) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            break;
          }
          continue;
        }
        consecutiveFailures = 0;

        const prev = segmentsRef.current;
        const startMs =
          prev.length === 0 ? 0 : prev[prev.length - 1].startMs + prev[prev.length - 1].durationMs;
        let next: Segment[] = [...prev, { uri: result.uri, startMs, durationMs: result.durationMs }];

        if (next.length > MAX_SEGMENTS) {
          const dropped = next[0];
          next = next.slice(1);
          const rebase = next[0].startMs;
          next = next.map((s) => ({ ...s, startMs: s.startMs - rebase }));
          try {
            new File(dropped.uri).delete();
          } catch {
            // Best-effort cleanup — a leaked temp file isn't worth failing capture over.
          }
        }

        segmentsRef.current = next;
        if (mountedRef.current) {
          setBufferedMs(totalSegmentsDurationMs(next));
        }
      }

      if (!mountedRef.current) {
        return;
      }
      settle();
    }

    loop();

    return () => {
      mountedRef.current = false;
      finishingRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, attempt]);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Dim>FormCheck needs camera access to film your lift.</Dim>
        <Button label="Allow camera" onPress={requestPermission} style={styles.mt} />
      </View>
    );
  }

  const finish = () => {
    if (finishingRef.current) {
      return;
    }
    finishingRef.current = true;
    setPhase('finishing');
    camRef.current?.stopRecording();
    // Defense in depth on top of the per-segment timeout: the "Got it!" -> next
    // screen transition should never take longer than this no matter what the
    // camera does.
    setTimeout(settle, FINISH_TIMEOUT_MS);
  };

  const cancel = () => {
    finishingRef.current = true;
    settledRef.current = true; // prevent any in-flight timeout from firing settle() after we've already left
    camRef.current?.stopRecording();
    navigation.goBack();
  };

  const retry = () => {
    setPhase('buffering');
    setAttempt((a) => a + 1); // forces the capture effect to re-run and start a fresh loop
  };

  return (
    <View style={styles.root}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        mute
        onCameraReady={() => setCameraReady(true)}
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.guideBox} />
        <Text style={styles.instruction}>{guide.instruction}</Text>
      </View>

      {phase === 'buffering' && (
        <View style={styles.recIndicator} pointerEvents="none">
          <View style={[styles.recDot, bufferedMs > 0 && styles.recDotActive]} />
          <Text style={styles.recText}>
            {!cameraReady && bufferedMs === 0
              ? 'Starting camera…'
              : bufferedMs === 0
                ? 'Getting ready…'
                : `Buffering — ${(bufferedMs / 1000).toFixed(1)}s ready`}
          </Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={[styles.overlay, styles.errorBox]}>
          <Text style={styles.errorTitle}>Couldn't capture that</Text>
          <Dim style={styles.mt}>The camera didn't produce any footage to analyze.</Dim>
          <Button label="Try again" onPress={retry} style={styles.mt} />
        </View>
      )}

      <View style={styles.controls}>
        {phase === 'buffering' && (
          <>
            <Button label="Got it!" onPress={finish} />
            <Button label="Cancel" kind="ghost" onPress={cancel} style={styles.mt} />
          </>
        )}
        {phase === 'finishing' && <Dim>Wrapping up…</Dim>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  mt: { marginTop: spacing(2) },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBox: {
    width: '70%',
    height: '60%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  instruction: {
    position: 'absolute',
    bottom: 140,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: 12,
    overflow: 'hidden',
  },
  recIndicator: {
    position: 'absolute',
    top: spacing(6),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing(1),
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textDim },
  recDotActive: { backgroundColor: colors.fault },
  recText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5),
    borderRadius: 10,
    overflow: 'hidden',
  },
  errorBox: { backgroundColor: 'rgba(0,0,0,0.6)' },
  errorTitle: { color: colors.fault, fontSize: 18, fontWeight: '700' },
  controls: { position: 'absolute', bottom: spacing(4), left: 0, right: 0, alignItems: 'center' },
});
