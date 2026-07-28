import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, Dim, Title } from '../components/ui';
import { liftLabel } from '../lib/programs';
import { useAppState } from '../state/AppState';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetLogger'>;

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// Speed is the contract: logging a set must stay under ~4 taps.
export function SetLoggerScreen({ navigation, route }: Props) {
  const { lift, trackable, targetReps, targetRpe } = route.params;
  const { programId, week, weightUnit, sets, logSet } = useAppState();

  const lastSame = sets.find((s) => s.lift === lift);
  const [weight, setWeight] = useState(lastSame ? String(lastSame.weight) : '');
  const [reps, setReps] = useState(targetReps);
  const [rpe, setRpe] = useState<number | undefined>(targetRpe);

  const step = weightUnit === 'kg' ? 2.5 : 5;
  const bump = (d: number) => setWeight(String(Math.max(0, (parseFloat(weight) || 0) + d)));

  const save = (withFormCheck: boolean) => {
    const parsed = parseFloat(weight) || 0;
    const set = {
      set_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      logged_at: new Date().toISOString(),
      program_id: programId,
      program_week: week,
      lift,
      weight: parsed,
      weight_unit: weightUnit,
      reps,
      rpe,
      had_video: withFormCheck,
      flag_summary: [],
    };
    if (withFormCheck) {
      navigation.replace('Results', { set });
    } else {
      logSet(set);
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>{liftLabel(lift)}</Title>
      <Dim>Week {week} target: {targetReps} reps{targetRpe != null ? ` @ RPE ${targetRpe}` : ''}</Dim>

      <Text style={styles.label}>Weight ({weightUnit})</Text>
      <View style={styles.row}>
        <Button label={`−${step}`} kind="secondary" onPress={() => bump(-step)} />
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textDim}
        />
        <Button label={`+${step}`} kind="secondary" onPress={() => bump(step)} />
      </View>

      <Text style={styles.label}>Reps</Text>
      <View style={styles.row}>
        <Button label="−1" kind="secondary" onPress={() => setReps(Math.max(1, reps - 1))} />
        <Text style={styles.bigValue}>{reps}</Text>
        <Button label="+1" kind="secondary" onPress={() => setReps(reps + 1)} />
      </View>

      <Text style={styles.label}>RPE (optional)</Text>
      <View style={styles.chips}>
        {RPE_OPTIONS.map((v) => (
          <Pressable
            key={v}
            onPress={() => setRpe(rpe === v ? undefined : v)}
            style={[styles.chip, rpe === v && styles.chipOn]}>
            <Text style={[styles.chipText, rpe === v && styles.chipTextOn]}>{v}</Text>
          </Pressable>
        ))}
      </View>

      <Button label="Save set" onPress={() => save(false)} />
      {trackable && (
        <Button label="Save + form check (demo clip)" kind="secondary" onPress={() => save(true)} />
      )}
      {trackable && (
        <Dim>
          Camera capture arrives with the device build — for now the form check runs on a
          bundled demo rep so you can see the full loop.
        </Dim>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  label: { color: colors.textDim, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), justifyContent: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing(1),
  },
  bigValue: { color: colors.text, fontSize: 28, fontWeight: '700', minWidth: 60, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontWeight: '600' },
  chipTextOn: { color: colors.text },
});
