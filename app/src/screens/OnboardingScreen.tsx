import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, Card, Dim, Title } from '../components/ui';
import { PROGRAMS } from '../lib/programs';
import { useAppState } from '../state/AppState';

export function OnboardingScreen() {
  const { completeOnboarding } = useAppState();
  const [selected, setSelected] = useState(PROGRAMS[0].program_id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>Pick your program</Title>
      <Dim>Both are free. You can switch any time.</Dim>
      {PROGRAMS.map((p) => (
        <Card
          key={p.program_id}
          style={selected === p.program_id ? styles.selectedCard : undefined}>
          <Text style={styles.name} onPress={() => setSelected(p.program_id)}>
            {p.name}
          </Text>
          <Dim>
            {p.days_per_week} days/week · {p.weeks} weeks · {p.level}
          </Dim>
          <Text style={styles.desc}>{p.description}</Text>
          <Button
            label={selected === p.program_id ? 'Selected' : 'Select'}
            kind={selected === p.program_id ? 'primary' : 'secondary'}
            onPress={() => setSelected(p.program_id)}
          />
        </Card>
      ))}
      <Button label="Start training" onPress={() => completeOnboarding(selected)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  selectedCard: { borderColor: colors.accent },
  name: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing(0.5) },
  desc: { color: colors.text, marginVertical: spacing(1) },
});
