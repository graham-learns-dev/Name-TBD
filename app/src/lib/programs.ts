// Program templates ship with the app bundle in v1 (static JSON per docs/contracts/programs.md).
// The backend `programs` table mirrors these; the bundle is the offline source of truth.
import fullBody from '../../../programs/beginner_full_body_3d.json';
import upperLower from '../../../programs/beginner_upper_lower.json';

export interface Prescription {
  week: number;
  sets: number;
  reps: number;
  rpe_target?: number;
  intensity_pct?: number;
  deload?: boolean;
}

export interface Exercise {
  lift: string;
  trackable: boolean;
  prescriptions: Prescription[];
  progression_note?: string;
}

export interface Session {
  day: number;
  name: string;
  exercises: Exercise[];
}

export interface Program {
  program_id: string;
  name: string;
  description: string;
  level: string;
  days_per_week: number;
  weeks: number;
  deload_week: number;
  is_free: boolean;
  sessions: Session[];
}

export const PROGRAMS: Program[] = [fullBody as Program, upperLower as Program];

export function getProgram(programId: string): Program {
  const p = PROGRAMS.find((x) => x.program_id === programId);
  if (!p) {
    throw new Error(`unknown program: ${programId}`);
  }
  return p;
}

export function prescriptionFor(ex: Exercise, week: number): Prescription | undefined {
  return ex.prescriptions.find((p) => p.week === week);
}

/** Display name: "romanian_deadlift" -> "Romanian Deadlift". */
export function liftLabel(lift: string): string {
  return lift
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
