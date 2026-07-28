// Single source of visual constants until a real design system lands.
//
// UX structure (2026-07-28) is inspired by RP Hypertrophy's app — pill-shaped choice
// buttons, prominent colored target-range banners, small metadata badges, confident
// bold typography — studied via its official marketing screenshots. Deliberately kept
// our own color identity rather than their true-black + red palette (Graham's call);
// see docs/SUPERVISOR-NOTES.md. accentDim/accentBorder exist for the selected/
// unselected pill pattern, derived from our own blue accent instead of their red.
export const colors = {
  bg: '#0E0F13',
  card: '#1A1C23',
  border: '#2A2D38',
  text: '#F2F3F7',
  textDim: '#9AA0B0',
  accent: '#4C8DFF',
  accentDim: '#132238',
  accentBorder: '#2F4F7E',
  good: '#35C759',
  warning: '#FFB020',
  fault: '#FF4438',
};

export const spacing = (n: number) => n * 8;
