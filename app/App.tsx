import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/state/AppState';
import { RootNavigation } from './src/navigation';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppStateProvider>
        <RootNavigation />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

export default App;
