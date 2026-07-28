import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluate } from '@formcheck/rule-engine';
import { colors, spacing } from '../theme';
import { Button, Card, Dim, Title } from '../components/ui';
import { nextDemoClip } from '../lib/demoClip';
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

export function ResultsScreen({ navigation, route }: Props) {
  const { set } = route.params;
  const { logSet } = useAppState();

  // Runs the real rule engine on a bundled demo clip (camera lands with the device
  // build). Scenario rotates each visit so every outcome is visible.
  const { label, result } = useMemo(() => {
    const demo = nextDemoClip();
    return { label: demo.label, result: evaluate(demo.clip) };
  }, []);

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
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>Form check</Title>
      <Dim>
        {liftLabel(set.lift)} · {set.weight} {set.weight_unit} × {set.reps}
        {set.rpe != null ? ` @ RPE ${set.rpe}` : ''} · demo scenario: {label}
      </Dim>

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
      <Button label="Share clip — arrives with clip-gen" kind="secondary" onPress={() => {}} />
      <Dim>
        The annotated, watermarked clip and share sheet land with the clip-generation
        workstream (native video composition).
      </Dim>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
