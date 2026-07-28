import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'secondary' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        kind === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.7 },
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

export function Dim({ children }: { children: React.ReactNode }) {
  return <Text style={styles.dim}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  dim: { color: colors.textDim, fontSize: 14 },
});
