import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, ChoicePillGroup, Dim, Title } from '../components/ui';
import { liftLabel } from '../lib/programs';
import { useAppState } from '../state/AppState';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetLogger'>;

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({
  value: String(v),
  label: String(v),
}));

// Speed is the contract: logging a set must stay under ~4 taps.
export function SetLoggerScreen({ navigation, route }: Props) {
  const { lift, trackable, targetReps, targetRpe } = route.params;
  const { programId, week, weightUnit, sets, logSet } = useAppState();

  const lastSame = sets.find((s) => s.lift === lift);
  const [weight, setWeight] = useState(lastSame ? String(lastSame.weight) : '');
  const [reps, setReps] = useState(targetReps);
  const [rpe, setRpe] = useState<string | undefined>(targetRpe != null ? String(targetRpe) : undefined);

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
      rpe: rpe != null ? parseFloat(rpe) : undefined,
      had_video: withFormCheck,
      flag_summary: [],
    };
    if (withFormCheck) {
      navigation.replace('Camera', { set });
    } else {
      logSet(set);
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>{liftLabel(lift)}</Title>

      <View style={styles.targetBanner}>
        <Text style={styles.targetBannerText}>
          Target: {targetReps} reps{targetRpe != null ? ` @ RPE ${targetRpe}` : ''}
        </Text>
      </View>

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
      <ChoicePillGroup
        options={RPE_OPTIONS}
        value={rpe}
        onChange={(v) => setRpe(rpe === v ? undefined : v)}
      />

      <Button label="Save set" onPress={() => save(false)} style={styles.mt} />
      {trackable && (
        <Button label="Save + film form check" kind="secondary" onPress={() => save(true)} />
      )}
      {trackable && (
        <Dim>
          Your rep is filmed and analyzed entirely on-device — nothing is uploaded.
          First analysis may be slow while the pose model loads.
        </Dim>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  targetBanner: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: 12,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2),
  },
  targetBannerText: { color: colors.text, fontSize: 14, fontWeight: '700' },
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
  mt: { marginTop: spacing(1) },
});
