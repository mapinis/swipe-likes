export interface FactorWeights {
  staleLike: number;
  notTopTrack: number;
  artistNotTop: number;
  notRecentlyPlayed: number;
  genreDrift: number;
  artistAbandonment: number;
}

export type FactorName = keyof FactorWeights;

export const WEIGHTS: FactorWeights = {
  staleLike: 0.28,
  notTopTrack: 0.22,
  artistNotTop: 0.2,
  notRecentlyPlayed: 0.1,
  genreDrift: 0.1,
  artistAbandonment: 0.1,
};

export const STALE_MAX_DAYS = 730;
export const RECENT_ARTIST_LIKE_DAYS = 180;
