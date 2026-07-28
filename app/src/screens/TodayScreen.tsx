import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Badge, Button, Card, Dim, Title } from '../components/ui';
import { getProgram, liftLabel, prescriptionFor } from '../lib/programs';
import { useAppState } from '../state/AppState';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

export function TodayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { programId, week, sessionIdx, sets, nextSession, advanceWeek } = useAppState();
  const program = getProgram(programId);
  const done = sessionIdx >= program.days_per_week;
  const session = program.sessions[Math.min(sessionIdx, program.days_per_week - 1)];
  const isDeload = week === program.deload_week;

  const setsToday = sets.filter(
    (s) => s.program_week === week && new Date(s.logged_at).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>
        Week {week} · {session.name}
      </Title>
      <Dim>
        {program.name}
        {isDeload ? ' · deload week — keep it light' : ''}
      </Dim>

      {done ? (
        <Card>
          <Text style={styles.exName}>Week {week} complete</Text>
          <Dim>
            {week >= program.weeks
              ? 'Program finished — restart it or pick a new one in the Program tab.'
              : 'Nice work. Ready for next week?'}
          </Dim>
          {week < program.weeks && (
            <Button label={`Start week ${week + 1}`} onPress={advanceWeek} style={styles.mt} />
          )}
        </Card>
      ) : (
        <>
          {session.exercises.map((ex) => {
            const rx = prescriptionFor(ex, week);
            if (!rx) {
              return null;
            }
            return (
              <Card key={ex.lift}>
                <View style={styles.exHeader}>
                  <Text style={styles.exName}>{liftLabel(ex.lift)}</Text>
                  {ex.trackable && <Badge label="🎥 form-check" />}
                </View>
                <View style={styles.targetBanner}>
                  <Text style={styles.targetBannerText}>
                    {rx.sets} × {rx.reps}
                    {rx.rpe_target != null ? ` @ RPE ${rx.rpe_target}` : ''}
                    {rx.deload ? ' · deload' : ''}
                  </Text>
                </View>
                {ex.progression_note ? <Text style={styles.note}>{ex.progression_note}</Text> : null}
                <Button
                  label="Log set"
                  kind="secondary"
                  style={styles.mt}
                  onPress={() =>
                    navigation.navigate('SetLogger', {
                      lift: ex.lift,
                      trackable: ex.trackable,
                      targetReps: rx.reps,
                      targetRpe: rx.rpe_target,
                    })
                  }
                />
              </Card>
            );
          })}
          <Button label="Finish session" onPress={nextSession} />
        </>
      )}
      <Dim>{setsToday} sets logged today</Dim>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(1) },
  exName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  targetBanner: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: 10,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
  },
  targetBannerText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  note: { color: colors.textDim, fontSize: 12, marginTop: spacing(1), fontStyle: 'italic' },
  mt: { marginTop: spacing(1.5) },
});
