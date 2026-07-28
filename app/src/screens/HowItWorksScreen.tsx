import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, Card, Title } from '../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HowItWorks'>;

const STEPS = [
  {
    icon: '📝',
    title: 'Log every set',
    body: "Weight, reps, RPE. A few taps and you're done — no video required.",
  },
  {
    icon: '🎥',
    title: 'Film your big three',
    body: "Squat, bench, and deadlift can be form-checked with a quick video. It's analyzed entirely on your phone — nothing is ever uploaded.",
  },
  {
    icon: '✅',
    title: 'See what to fix',
    body: 'A rep score and plain-language flags show exactly what happened, right after you lift.',
  },
];

export function HowItWorksScreen({ navigation, route }: Props) {
  const from = route.params?.from ?? 'onboarding';

  const done = () => {
    if (from === 'onboarding') {
      navigation.navigate('Onboarding');
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Title>How this works</Title>
      {STEPS.map((s) => (
        <Card key={s.title} style={styles.card}>
          <Text style={styles.icon}>{s.icon}</Text>
          <View style={styles.textCol}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </View>
        </Card>
      ))}
      <Button label={from === 'onboarding' ? "Let's go" : 'Done'} onPress={done} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(3), gap: spacing(2) },
  card: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start' },
  icon: { fontSize: 28 },
  textCol: { flex: 1, gap: spacing(0.5) },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stepBody: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
});
