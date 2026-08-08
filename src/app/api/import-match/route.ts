import { NextRequest, NextResponse } from 'next/server';
import { Album, normalizeGenre } from '@/types/album';

const MB_UA = 'jewelcase100/1.0 (ckubal@gmail.com)';

const JUNK_PATTERN = /tribute|cover|karaoke|piano|instrumental|remix|acoustic|made famous|originally|in the style/i;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function scoreMatch(candidateTitle: string, candidateArtist: string, targetTitle: string, targetArtist: string): number {
  const ct = norm(candidateTitle), ca = norm(candidateArtist);
  const tt = norm(targetTitle), ta = norm(targetArtist);
  let score = 0;

  // Title scoring
  if (ct === tt) score += 30;
  else if (tt.includes(ct) || ct.includes(tt)) score += 10;

  // Artist scoring
  if (ta) {
    if (ca === ta) score += 20;
    else if (ta.includes(ca) || ca.includes(ta)) score += 10;
  }

  // Penalize junk albums
  if (JUNK_PATTERN.test(candidateTitle)) score -= 20;

  return score;
}

async function itunesAlbumTermSearch(title: string, limit = 25): Promise<Album[]> {
  try {
    // Search specifically in album titles — much more targeted than general text search
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=music&entity=album&attribute=albumTerm&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((item: Record<string, unknown>) => {
      const t = (item.collectionName as string) ?? '';
      const a = (item.artistName as string) ?? '';
      if (!t || !a) return null;
      const art = ((item.artworkUrl100 as string) ?? '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
      const releaseYear = (item.releaseDate as string) ? new Date(item.releaseDate as string).getFullYear() : undefined;
      return {
        id: String(item.collectionId ?? item.trackId ?? ''),
        title: t, artist: a,
        year: releaseYear?.toString() ?? '',
        releaseYear,
        genre: normalizeGenre(item.primaryGenreName as string | undefined),
        coverUrl: art, source: 'itunes' as const,
      };
    }).filter(Boolean) as Album[];
  } catch { return []; }
}

async function musicBrainzSearch(title: string, artist: string): Promise<Album | null> {
  try {
    const q = artist
      ? `release:"${title.replace(/"/g, '')}" AND artist:"${artist.replace(/"/g, '')}"`
      : `release:"${title.replace(/"/g, '')}"`;
    const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&type=album&fmt=json&limit=5`;
    const res = await fetch(url, { headers: { 'User-Agent': MB_UA }, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const groups = data['release-groups'] ?? [];
    if (!groups.length) return null;
    const rg = groups[0];
    const rgTitle = rg.title as string;
    const artistCredit = (rg['artist-credit'] ?? []) as Array<{ artist?: { name?: string }; name?: string }>;
    const rgArtist = artistCredit[0]?.artist?.name ?? artistCredit[0]?.name ?? '';
    const mbid = rg.id as string;
    if (!rgTitle || !rgArtist || !mbid) return null;
    return {
      id: `mb-${mbid}`,
      title: rgTitle, artist: rgArtist,
      year: (rg['first-release-date'] as string | undefined)?.slice(0, 4) ?? '',
      coverUrl: `https://coverartarchive.org/release-group/${mbid}/front-250`,
      source: 'musicbrainz' as const,
    };
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? '';
  const artist = searchParams.get('artist') ?? '';

  if (!title) return NextResponse.json({ match: null });

  try {
    // Step 1: iTunes albumTerm search — title-specific, returns albums WITH this title
    const candidates = await itunesAlbumTermSearch(title, 25);

    const best = candidates
      .map(a => ({ a, s: scoreMatch(a.title, a.artist, title, artist) }))
      .filter(x => x.s > 15) // require both title AND artist to match somewhat
      .sort((x, y) => y.s - x.s)[0];

    // Also try MusicBrainz in parallel for more candidates
    const mbMatch = await musicBrainzSearch(title, artist);
    if (mbMatch) {
      const s = scoreMatch(mbMatch.title, mbMatch.artist, title, artist);
      if (s > 0 && !candidates.find(c => c.id === mbMatch.id)) {
        candidates.push(mbMatch);
      }
    }

    // Re-score full candidate pool and return top matches
    const scored = candidates
      .map(a => ({ a, s: scoreMatch(a.title, a.artist, title, artist) }))
      .filter(x => x.s > 0)
      .sort((x, y) => y.s - x.s);

    const topCandidates = scored.slice(0, 4).map(x => x.a);
    const match = scored[0]?.s >= 15 ? scored[0].a : null;

    return NextResponse.json({ match, candidates: topCandidates });
  } catch {
    return NextResponse.json({ match: null });
  }
}
