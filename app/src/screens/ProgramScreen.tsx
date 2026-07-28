import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, Dim, Title } from '../components/ui';
import { getProgram, liftLabel, prescriptionFor } from '../lib/programs';
import { useAppState } from '../state/AppState';

export function ProgramScreen() {
  const { programId, week } = useAppState();
  const program = getProgram(programId);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>{program.name}</Title>
      <Dim>
        Week {week} of {program.weeks} · deload on week {program.deload_week}
      </Dim>
      {program.sessions.map((s) => (
        <Card key={s.day}>
          <Text style={styles.day}>
            Day {s.day} — {s.name}
          </Text>
          {s.exercises.map((ex) => {
            const rx = prescriptionFor(ex, week);
            return (
              <Text key={ex.lift} style={styles.line}>
                {liftLabel(ex.lift)}
                {rx
                  ? `  ${rx.sets}×${rx.reps}${rx.rpe_target != null ? ` @ RPE ${rx.rpe_target}` : ''}`
                  : ''}
              </Text>
            );
          })}
        </Card>
      ))}
      <Dim>
        More programs (intermediate, SBD focus) arrive with the paid tier — the paywall
        lives here.
      </Dim>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  day: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing(1) },
  line: { color: colors.textDim, fontSize: 14, paddingVertical: 2 },
});
