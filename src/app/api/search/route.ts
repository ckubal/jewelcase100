import { NextRequest, NextResponse } from 'next/server';
import { Album, normalizeGenre } from '@/types/album';

const MB_UA = 'jewelcase100/1.0 (ckubal@gmail.com)';

// Patterns that indicate a single/EP/compilation — not a proper album
const SINGLE_PATTERN = /(-\s*(single|ep|remix|acoustic|live|demo|edit|version|mix|radio edit|extended|instrumental)\s*)$/i;

function itunesItemToAlbum(item: Record<string, unknown>): Album | null {
  const title = (item.collectionName as string | undefined) ?? '';
  const artist = (item.artistName as string | undefined) ?? '';
  if (!title || !artist) return null;
  // Drop singles, EPs, remixes
  if (SINGLE_PATTERN.test(title)) return null;
  const artworkUrl = (item.artworkUrl100 as string | undefined) ?? '';
  const coverUrl = artworkUrl.replace(/\/\d+x\d+bb\./, '/600x600bb.').replace('100x100', '600x600');
  const releaseDate = (item.releaseDate as string | undefined) ?? '';
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const year = releaseYear?.toString() ?? '';
  const rawGenre = (item.primaryGenreName as string | undefined);
  return {
    id: String(item.collectionId ?? item.trackId ?? ''),
    title,
    artist,
    year,
    releaseYear,
    genre: normalizeGenre(rawGenre),
    coverUrl,
    source: 'itunes' as const,
  };
}

async function searchItunes(q: string, limit: number): Promise<Album[]> {
  try {
    const [r1, r2] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=album&limit=${limit * 2}`, { next: { revalidate: 3600 } }),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=album&attribute=albumTerm&limit=${limit * 2}`, { next: { revalidate: 3600 } }),
    ]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
    const seen = new Set<string>();
    const results: Album[] = [];
    for (const item of [...(d1.results ?? []), ...(d2.results ?? [])]) {
      const album = itunesItemToAlbum(item as Record<string, unknown>);
      if (!album || !album.id) continue;
      const key = `${album.title.toLowerCase()}::${album.artist.toLowerCase()}`;
      if (seen.has(album.id) || seen.has(key)) continue;
      seen.add(album.id);
      seen.add(key);
      results.push(album);
    }
    return results;
  } catch {
    return [];
  }
}

async function searchMusicBrainz(q: string, limit: number): Promise<Album[]> {
  try {
    // Build a smarter query: if query has multiple words, try as release title + artist
    const encoded = encodeURIComponent(q);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group/?query=${encoded}&type=album&fmt=json&limit=${limit}`,
      { headers: { 'User-Agent': MB_UA }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const groups: Album[] = [];

    for (const rg of (data['release-groups'] ?? []).slice(0, limit)) {
      const title = rg.title as string;
      const artistCredit = (rg['artist-credit'] ?? []) as Array<{ artist?: { name?: string }; name?: string }>;
      const artist = artistCredit[0]?.artist?.name ?? artistCredit[0]?.name ?? '';
      const mbid = rg.id as string;
      if (!title || !artist || !mbid) continue;

      // Cover Art Archive
      const coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`;
      const year = (rg['first-release-date'] as string | undefined)?.slice(0, 4) ?? '';

      groups.push({
        id: `mb-${mbid}`,
        title,
        artist,
        year,
        coverUrl,
        source: 'musicbrainz' as const,
      });
    }
    return groups;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  if (!q) return NextResponse.json({ results: [] });

  try {
    // Run iTunes + MusicBrainz in parallel
    const [itunesResults, mbResults] = await Promise.all([
      searchItunes(q, limit),
      searchMusicBrainz(q, limit),
    ]);

    // Merge: iTunes first (has reliable cover art), then MB results not already covered
    const seen = new Set<string>();
    const merged: Album[] = [];

    for (const album of itunesResults) {
      const key = `${album.title.toLowerCase()}::${album.artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(album);
    }

    for (const album of mbResults) {
      const key = `${album.title.toLowerCase()}::${album.artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(album);
    }

    return NextResponse.json(
      { results: merged.slice(0, limit) },
      { headers: { 'Cache-Control': 's-maxage=3600' } }
    );
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
