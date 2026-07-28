import type { LoggedSet } from '../state/AppState';

export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  SetLogger: {
    lift: string;
    trackable: boolean;
    targetReps: number;
    targetRpe?: number;
  };
  Results: { set: LoggedSet };
};
