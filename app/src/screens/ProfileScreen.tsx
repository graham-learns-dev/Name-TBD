import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, Card, Dim, Title } from '../components/ui';
import { liftLabel } from '../lib/programs';
import { useAppState } from '../state/AppState';

export function ProfileScreen() {
  const { weightUnit, setWeightUnit, sets, reset } = useAppState();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>Profile</Title>

      <Card>
        <Text style={styles.label}>Units</Text>
        <Button
          label={weightUnit === 'kg' ? 'Using kg — switch to lb' : 'Using lb — switch to kg'}
          kind="secondary"
          onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}
        />
      </Card>

      <Card>
        <Text style={styles.label}>History ({sets.length} sets)</Text>
        {sets.length === 0 ? (
          <Dim>Nothing logged yet.</Dim>
        ) : (
          sets.slice(0, 20).map((s) => (
            <Text key={s.set_id} style={styles.histLine}>
              {liftLabel(s.lift)} {s.weight}
              {s.weight_unit}×{s.reps}
              {s.rep_quality_score != null ? `  · form ${Math.round(s.rep_quality_score * 100)}` : ''}
              {s.flag_summary.length > 0 ? `  · ${s.flag_summary.join(', ')}` : ''}
            </Text>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Account</Text>
        <Dim>Sign-in, subscription and account deletion arrive with the backend wiring.</Dim>
        <Button label="Reset app state (dev)" kind="secondary" onPress={reset} style={styles.mt} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  label: { color: colors.textDim, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing(1) },
  histLine: { color: colors.text, fontSize: 14, paddingVertical: 3 },
  mt: { marginTop: spacing(1) },
});
