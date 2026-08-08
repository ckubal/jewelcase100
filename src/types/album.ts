export interface Album {
  id: string;           // unique: itunes trackId or mbid
  title: string;
  artist: string;
  year: string;
  releaseYear?: number; // numeric year, for stats calculations
  genre?: string;       // normalized genre label
  coverUrl: string;     // resolved cover URL (may be overridden by user)
  coverOverride?: string; // user-supplied cover URL
  source: 'itunes' | 'musicbrainz';
}

// Genre normalization — maps iTunes primaryGenreName to one of our 6 buckets
const GENRE_MAP: Record<string, string> = {
  'hip-hop/rap': 'hip hop', 'hip hop': 'hip hop', 'rap': 'hip hop',
  'rock': 'rock', 'hard rock': 'rock', 'metal': 'rock', 'punk': 'rock',
  'pop-punk': 'rock', 'emo': 'rock', 'alternative': 'rock', 'grunge': 'rock',
  'indie': 'indie/alt', 'indie rock': 'indie/alt', 'indie pop': 'indie/alt',
  'singer/songwriter': 'indie/alt', 'folk': 'indie/alt', 'alternative & punk': 'rock',
  'pop': 'pop', 'teen pop': 'pop', 'dance pop': 'pop', 'synth pop': 'pop',
  'electronic': 'electronic', 'dance': 'electronic', 'house': 'electronic',
  'techno': 'electronic', 'edm': 'electronic', 'electronica': 'electronic',
  'ambient': 'electronic', 'dubstep': 'electronic',
  'r&b/soul': 'r&b', 'r&b': 'r&b', 'soul': 'r&b', 'neo soul': 'r&b', 'funk': 'r&b',
};

export function normalizeGenre(raw: string | undefined): string {
  if (!raw) return 'other';
  const key = raw.toLowerCase().trim();
  return GENRE_MAP[key] ?? 'other';
}

export type GridSize = 9 | 16 | 25 | 36 | 49 | 64 | 81 | 100;
export const GRID_SIZES: GridSize[] = [9, 16, 25, 36, 49, 64, 81, 100];
export function gridDim(size: GridSize): number { return Math.sqrt(size); }
