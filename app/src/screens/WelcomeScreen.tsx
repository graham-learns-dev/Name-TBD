import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button, Dim } from '../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        {/* [APP_NAME] wordmark goes here once the name lands */}
        <Text style={styles.logo}>[APP_NAME]</Text>
        <Text style={styles.tagline}>Film your lifts. Fix your form. Share the proof.</Text>
      </View>
      <View style={styles.footer}>
        <Button
          label="Get started"
          onPress={() => navigation.navigate('HowItWorks', { from: 'onboarding' })}
        />
        <Dim>Sign-in (email / Apple / Google) arrives with the backend wiring.</Dim>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing(3), justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing(2) },
  logo: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: colors.textDim, fontSize: 16, textAlign: 'center' },
  footer: { gap: spacing(2), alignItems: 'center' },
});
