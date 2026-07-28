import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'secondary' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        kind === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      <Text style={[styles.btnText, kind === 'ghost' && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Dim({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.dim, style]}>{children}</Text>;
}

/**
 * Small metadata tag — muscle-group labels, "form-check" markers, day/week counts.
 * `tone` picks the border/text color; `filled` gives it a solid background instead
 * of just an outline, for when a badge needs to read as more prominent.
 */
export function Badge({
  label,
  tone = 'accent',
  filled = false,
  style,
}: {
  label: string;
  tone?: 'accent' | 'neutral' | 'good' | 'warning';
  filled?: boolean;
  style?: ViewStyle;
}) {
  const toneColor =
    tone === 'good' ? colors.good : tone === 'warning' ? colors.warning : tone === 'neutral' ? colors.textDim : colors.accent;
  return (
    <View
      style={[
        styles.badge,
        { borderColor: toneColor },
        filled && { backgroundColor: toneColor },
        style,
      ]}>
      <Text style={[styles.badgeText, { color: filled ? colors.text : toneColor }]}>{label}</Text>
    </View>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
}

/**
 * A row of selectable pill buttons where exactly one (or zero) can be active —
 * matches RP Hypertrophy's feedback-survey pattern: solid fill when selected,
 * dark outlined "unselected" state otherwise. Used for RPE selection and any other
 * small single-pick choice set. Wraps onto multiple lines if the options don't fit.
 */
export function ChoicePillGroup({
  options,
  value,
  onChange,
}: {
  options: ChoiceOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.pill,
              selected ? styles.pillSelected : styles.pillUnselected,
              pressed && { opacity: 0.75 },
            ]}>
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  dim: { color: colors.textDim, fontSize: 14 },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing(1),
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  pill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1.25),
    minWidth: 64,
    alignItems: 'center',
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillUnselected: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  pillText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pillTextSelected: { color: colors.text },
});
