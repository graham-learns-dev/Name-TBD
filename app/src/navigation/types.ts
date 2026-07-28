import type { LoggedSet } from '../state/AppState';
import type { Segment } from '../lib/poseMapping';

export type RootStackParamList = {
  Welcome: undefined;
  HowItWorks: { from?: 'onboarding' | 'profile' } | undefined;
  Onboarding: undefined;
  Tabs: undefined;
  SetLogger: {
    lift: string;
    trackable: boolean;
    targetReps: number;
    targetRpe?: number;
  };
  Camera: { set: LoggedSet };
  Results: { set: LoggedSet; segments?: Segment[] };
};
