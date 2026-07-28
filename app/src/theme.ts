// Single source of visual constants until a real design system lands.
//
// Visual language deliberately inspired by RP Hypertrophy's app (studied via its
// official marketing screenshots, 2026-07-28) — true-black + bold red, confident
// typography, pill-shaped choice buttons. Adopted their aesthetic and component
// patterns, not their literal branding/copy/logo, and not their dense multi-set
// spreadsheet logging table (kept our simpler single-set-entry flow — see
// docs/SUPERVISOR-NOTES.md for why). accentDim/accentBorder exist specifically for
// the selected/unselected pill pattern their Feedback screen uses.
export const colors = {
  bg: '#0A0A0B',
  card: '#19191B',
  border: '#2C2C2F',
  text: '#F5F5F6',
  textDim: '#9B9B9F',
  accent: '#EE3A34',
  accentDim: '#3A1414',
  accentBorder: '#5C201C',
  good: '#33C759',
  warning: '#FFB020',
  fault: '#EE3A34',
};

export const spacing = (n: number) => n * 8;
