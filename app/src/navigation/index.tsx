import React from 'react';
import { Text } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { useAppState } from '../state/AppState';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { ProgramScreen } from '../screens/ProgramScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SetLoggerScreen } from '../screens/SetLoggerScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 16 }}>
            {route.name === 'Today' ? '▶' : route.name === 'Program' ? '▤' : '◉'}
          </Text>
        ),
      })}>
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Program" component={ProgramScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigation() {
  const { onboarded } = useAppState();

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}>
        {!onboarded ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: '' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="SetLogger"
              component={SetLoggerScreen}
              options={{ presentation: 'modal', title: 'Log set' }}
            />
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
            <Stack.Screen
              name="Results"
              component={ResultsScreen}
              options={{ presentation: 'modal', title: '' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
