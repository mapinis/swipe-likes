export interface ScoringWeights {
  age: number;
  artistCold: number;
  artistThin: number;
  topTrack: number;
  topArtist: number;
  recentPlay: number;
}

export interface ScoringHorizons {
  /** Age (days) at which the staleness signal saturates. */
  ageDays: number;
  /** Days since you last liked an artist at which "cold" saturates. */
  artistColdDays: number;
  /** Likes-by-artist count at which "thin" fully relaxes. */
  artistCountSat: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  horizons: ScoringHorizons;
}

export type WeightName = keyof ScoringWeights;

export const DEFAULT_WEIGHTS: ScoringWeights = {
  age: 1.0,
  artistCold: 1.2,
  artistThin: 0.6,
  topTrack: 1.5,
  topArtist: 1.2,
  recentPlay: 1.5,
};

export const DEFAULT_HORIZONS: ScoringHorizons = {
  ageDays: 730,
  artistColdDays: 365,
  artistCountSat: 5,
};

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: DEFAULT_WEIGHTS,
  horizons: DEFAULT_HORIZONS,
};

// Keep tiers for the "still in rotation" overrides (short/medium/long term).
export const TOP_TIER_KEEP = { short: 1, medium: 0.6, long: 0.35 };
export const RECENT_TRACK_KEEP = 1;
export const RECENT_ARTIST_KEEP = 0.4;
