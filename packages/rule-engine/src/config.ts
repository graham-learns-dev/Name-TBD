// Every tunable threshold lives here (contract requirement: one config file, because
// tuning against real footage WILL happen). Values are launch defaults per
// contracts/rule-engine.md.

export const CONFIG = {
  // A landmark below this confidence disqualifies rules that depend on it.
  // Shared with the CV contract — change in both places or not at all.
  min_confidence: 0.5,

  // Rep segmentation: excursion must exceed this fraction of frame height to count
  // as a rep at all.
  min_rep_excursion_frac: 0.08,
  // Rep boundary: movement is "started"/"ended" within this fraction of the excursion.
  rep_edge_frac: 0.1,

  squat: {
    // insufficient_depth: knee y in hip-centered world coords at the bottom frame.
    // <= 0 means hip crease at/below knee. Positive margin (meters) = didn't make depth.
    depth_knee_y_max_m: 0.0,
    // knee_valgus: medial deviation of knee from the hip-ankle line, degrees.
    valgus_deg: 12,
    valgus_min_consecutive_frames: 3,
  },

  deadlift: {
    // back_rounding: change in shoulder-hip-knee angle vs setup, degrees,
    // evaluated floor -> knee-pass.
    rounding_delta_deg: 15,
    // bar_drift: horizontal |bar - midfoot| normalized by shin length (px space).
    drift_shin_ratio: 0.35,
  },

  bench: {
    // bar_path_deviation: horizontal bar range normalized by forearm length (px space).
    path_forearm_ratio: 0.5,
  },

  // Severity from m = measured / threshold (contract: uniform across rules).
  severity_bands: { low: 1.0, medium: 1.25, high: 1.75 },
  // rep_quality_score = max(0, 1 - sum(penalty))
  penalties: { low: 0.05, medium: 0.15, high: 0.3 },
} as const;
