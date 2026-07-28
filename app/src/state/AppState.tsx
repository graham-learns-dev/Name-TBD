// In-memory app state for the v1 scaffold. Persistence (AsyncStorage) and the
// Supabase-backed offline queue land with the backend wiring; the shapes below
// already match docs/contracts/mobile-ui.md so that swap is additive.
import React, { createContext, useContext, useMemo, useState } from 'react';

export interface LoggedSet {
  set_id: string;
  logged_at: string;
  program_id: string;
  program_week: number;
  lift: string;
  weight: number;
  weight_unit: 'kg' | 'lb';
  reps: number;
  rpe?: number;
  had_video: boolean;
  rep_quality_score?: number;
  flag_summary: string[];
}

interface AppState {
  onboarded: boolean;
  programId: string;
  week: number;
  sessionIdx: number;
  weightUnit: 'kg' | 'lb';
  sets: LoggedSet[];
  completeOnboarding: (programId: string) => void;
  logSet: (s: LoggedSet) => void;
  nextSession: () => void;
  advanceWeek: () => void;
  setWeightUnit: (u: 'kg' | 'lb') => void;
  reset: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [onboarded, setOnboarded] = useState(false);
  const [programId, setProgramId] = useState('beginner_full_body_3d');
  const [week, setWeek] = useState(1);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [sets, setSets] = useState<LoggedSet[]>([]);

  const value = useMemo<AppState>(
    () => ({
      onboarded,
      programId,
      week,
      sessionIdx,
      weightUnit,
      sets,
      completeOnboarding: (id) => {
        setProgramId(id);
        setOnboarded(true);
      },
      logSet: (s) => setSets((prev) => [s, ...prev]),
      nextSession: () => setSessionIdx((i) => i + 1),
      advanceWeek: () => {
        setWeek((w) => w + 1);
        setSessionIdx(0);
      },
      setWeightUnit,
      reset: () => {
        setOnboarded(false);
        setWeek(1);
        setSessionIdx(0);
        setSets([]);
      },
    }),
    [onboarded, programId, week, sessionIdx, weightUnit, sets],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useAppState outside AppStateProvider');
  }
  return v;
}
