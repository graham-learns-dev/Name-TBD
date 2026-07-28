import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing } from '../theme';
import { Button, Dim } from '../components/ui';
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

const MAX_DURATION_S = 8;

export function CameraScreen({ navigation, route }: Props) {
  const { set } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const guide = GUIDE[set.lift] ?? GUIDE.squat;

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

  const startRecording = async () => {
    if (!camRef.current || recording) {
      return;
    }
    setRecording(true);
    setElapsedMs(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - start), 100);

    try {
      const video = await camRef.current.recordAsync({ maxDuration: MAX_DURATION_S });
      // Read the elapsed time from the clock, not the `elapsedMs` state — that state
      // was captured stale in this closure at button-press time (still 0).
      const finalDurationMs = Date.now() - start;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecording(false);
      if (video?.uri) {
        navigation.navigate('Results', { set, videoUri: video.uri, durationMs: finalDurationMs });
      }
    } catch {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecording(false);
    }
  };

  const stopRecording = () => camRef.current?.stopRecording();
  const pct = Math.min(1, elapsedMs / (MAX_DURATION_S * 1000));

  return (
    <View style={styles.root}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" mode="video" mute />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.guideBox} />
        <Text style={styles.instruction}>{guide.instruction}</Text>
      </View>

      {recording && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>
      )}

      <View style={styles.controls}>
        {!recording ? (
          <Button label={`Record ${liftLabel(set.lift)}`} onPress={startRecording} />
        ) : (
          <Button label="Stop" kind="secondary" onPress={stopRecording} />
        )}
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
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: { height: 4, backgroundColor: colors.fault },
  controls: { position: 'absolute', bottom: spacing(4), left: 0, right: 0, alignItems: 'center' },
});
