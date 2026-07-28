import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluate, type Lift, type RuleResult } from '@formcheck/rule-engine';
import { colors, spacing } from '../theme';
import { Button, Card, Dim, Title } from '../components/ui';
import { nextDemoClip } from '../lib/demoClip';
import { extractClipKeypoints } from '../lib/poseEstimation';
import { liftLabel } from '../lib/programs';
import { useAppState } from '../state/AppState';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

const SEVERITY_COLOR: Record<string, string> = {
  high: colors.fault,
  medium: colors.warning,
  low: colors.warning,
  info: colors.textDim,
};

type Stage =
  | { kind: 'loading' }
  | { kind: 'ready'; result: RuleResult; isDemo: boolean; demoLabel?: string }
  | { kind: 'error'; message: string };

export function ResultsScreen({ navigation, route }: Props) {
  const { set, segments } = route.params;
  const hasRecording = !!segments && segments.length > 0;
  const { logSet } = useAppState();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!segments || segments.length === 0) {
        // Defensive fallback — Results is only ever reached via Camera today, which
        // always supplies segments when the rolling buffer captured anything at all.
        const demo = nextDemoClip();
        if (!cancelled) {
          setStage({ kind: 'ready', result: evaluate(demo.clip), isDemo: true, demoLabel: demo.label });
        }
        return;
      }
      try {
        const clip = await extractClipKeypoints(segments, set.lift as Lift);
        if (!cancelled) {
          setStage({ kind: 'ready', result: evaluate(clip), isDemo: false });
        }
      } catch (e) {
        if (!cancelled) {
          setStage({
            kind: 'error',
            message: e instanceof Error ? e.message : 'Analysis failed unexpectedly.',
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [segments, set.lift]);

  const useDemoInstead = () => {
    const demo = nextDemoClip();
    setStage({ kind: 'ready', result: evaluate(demo.clip), isDemo: true, demoLabel: demo.label });
  };

  if (stage.kind === 'loading') {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Dim style={styles.mt}>
          Analyzing your rep on-device — the pose model can take a while to warm up the
          first time.
        </Dim>
      </View>
    );
  }

  if (stage.kind === 'error') {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.errorTitle}>Couldn't analyze this clip</Text>
        <Dim style={styles.mt}>{stage.message}</Dim>
        <Button label="Try demo data instead" onPress={useDemoInstead} style={styles.mt} />
        {hasRecording && (
          <Button label="Retake" kind="secondary" onPress={() => navigation.goBack()} style={styles.mt} />
        )}
      </View>
    );
  }

  const { result, isDemo, demoLabel } = stage;
  const score = result.rep_quality_score;
  const scoreColor =
    score == null ? colors.textDim : score >= 0.85 ? colors.good : score >= 0.6 ? colors.warning : colors.fault;

  const saveAndClose = () => {
    logSet({
      ...set,
      rep_quality_score: score ?? undefined,
      flag_summary: result.flags
        .filter((f) => f.severity !== 'info')
        .map((f) => `${f.issue}:${f.severity}`),
    });
    navigation.popToTop();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>Form check</Title>
      <Dim>
        {liftLabel(set.lift)} · {set.weight} {set.weight_unit} × {set.reps}
        {set.rpe != null ? ` @ RPE ${set.rpe}` : ''}
      </Dim>
      {isDemo && (
        <Dim>
          {hasRecording
            ? `Couldn't get a clean read on this clip, so this is bundled demo data (scenario: ${demoLabel}) — not your recording.`
            : `Demo data (scenario: ${demoLabel}).`}
        </Dim>
      )}
      {!isDemo && result.rep == null && (
        <Dim>
          Ran real pose analysis on your recording, but couldn't find a clear rep in it —
          try filming with your whole body in frame, matching the on-screen guide.
        </Dim>
      )}

      <View style={styles.scoreWrap}>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {score == null ? '—' : Math.round(score * 100)}
          </Text>
        </View>
        <Dim>rep quality</Dim>
      </View>

      <Text style={styles.section}>Form issues</Text>
      {result.flags.length === 0 ? (
        <Card style={{ borderColor: colors.good }}>
          <Text style={[styles.flagTitle, { color: colors.good }]}>Clean rep ✓</Text>
          <Dim>No issues detected on this rep.</Dim>
        </Card>
      ) : (
        result.flags.map((f, i) => (
          <Card key={i} style={{ borderColor: SEVERITY_COLOR[f.severity] }}>
            <View style={styles.flagHeader}>
              <Text style={styles.flagTitle}>{f.description}</Text>
              <Text style={[styles.sev, { color: SEVERITY_COLOR[f.severity] }]}>{f.severity}</Text>
            </View>
            {f.severity !== 'info' && (
              <Dim>
                measured {f.measured} {f.unit} (limit {f.threshold} {f.unit})
              </Dim>
            )}
          </Card>
        ))
      )}

      <Button label="Save to history" onPress={saveAndClose} />
      {hasRecording && (
        <Button label="Retake" kind="secondary" onPress={() => navigation.goBack()} />
      )}
      <Button label="Share clip — arrives with clip-gen" kind="ghost" onPress={() => {}} />
      <Dim>
        The annotated, watermarked clip and share sheet land with the clip-generation
        workstream (native video composition).
      </Dim>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  mt: { marginTop: spacing(2) },
  errorTitle: { color: colors.fault, fontSize: 18, fontWeight: '700' },
  content: { padding: spacing(3), gap: spacing(2) },
  scoreWrap: { alignItems: 'center', gap: spacing(1), marginVertical: spacing(2) },
  scoreRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { fontSize: 36, fontWeight: '800' },
  section: { color: colors.textDim, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  flagHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(1) },
  flagTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  sev: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
});
