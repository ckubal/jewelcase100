import { NextRequest, NextResponse } from 'next/server';

interface LastFmSimilarArtist { name: string }
interface LastFmAlbum {
  name: string;
  artist: { name: string } | string;
  playcount?: number | string;
  image?: Array<{ '#text': string; size: string }>;
}
interface Candidate { title: string; artist: string; coverUrl: string; score: number; seedCount: number; playcount: number }

const SINGLE_PATTERN = /(-\s*(single|ep|remix|acoustic|live|demo|edit|version|mix|radio edit|extended|instrumental)\s*)$/i;

// Fetch cover from iTunes as fallback for a given artist + album
async function itunesCover(artist: string, title: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=3`, { next: { revalidate: 3600 } });
    const data = await res.json();
    for (const item of data.results ?? []) {
      if (item.artworkUrl100) return (item.artworkUrl100 as string).replace(/\/\d+x\d+bb\./, '/600x600bb.');
    }
  } catch { /* ignore */ }
  return '';
}

async function lastfmRecs(seedArtists: string[], apiKey: string, excludeKeys: Set<string>): Promise<Candidate[]> {
  const candidateMap = new Map<string, Candidate>();

  await Promise.all(seedArtists.map(async (artist) => {
    try {
      const simRes = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=6`,
        { next: { revalidate: 1800 } }
      );
      const simData = await simRes.json();
      const similar: LastFmSimilarArtist[] = simData?.similarartists?.artist ?? [];

      await Promise.all(similar.slice(0, 5).map(async (sim) => {
        try {
          const topRes = await fetch(
            `https://ws.audioscrobbler.com/2.0/?method=artist.getTopAlbums&artist=${encodeURIComponent(sim.name)}&api_key=${apiKey}&format=json&limit=4`,
            { next: { revalidate: 1800 } }
          );
          const topData = await topRes.json();
          const albums: LastFmAlbum[] = topData?.topalbums?.album ?? [];

          for (const album of albums) {
            if (SINGLE_PATTERN.test(album.name)) continue;
            const artistName = typeof album.artist === 'string' ? album.artist : album.artist?.name ?? sim.name;
            const key = `${artistName.toLowerCase()}::${album.name.toLowerCase()}`;
            if (excludeKeys.has(key)) continue;

            const playcount = Number(album.playcount ?? 0);
            // Last.fm cover — prefer extralarge, skip empty/generic placeholder
            const rawCover = album.image?.find((i) => i.size === 'extralarge')?.['#text']
              ?? album.image?.slice(-1)[0]?.['#text'] ?? '';
            // Last.fm returns a placeholder URL for missing art — filter it out
            const coverUrl = rawCover.includes('2a96cbd8b46e442fc41c2b86b821562f') ? '' : rawCover;

            if (candidateMap.has(key)) {
              const ex = candidateMap.get(key)!;
              ex.seedCount += 1;
              ex.score = ex.seedCount * (ex.playcount / 1_000_000 + 0.1);
            } else {
              candidateMap.set(key, { title: album.name, artist: artistName, coverUrl, playcount, seedCount: 1, score: playcount / 1_000_000 + 0.1 });
            }
          }
        } catch { /* ignore */ }
      }));
    } catch { /* ignore */ }
  }));

  return Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
}

// iTunes "more by these artists" fallback
async function itunesFallback(seedArtists: string[], excludeKeys: Set<string>): Promise<Array<{ title: string; artist: string; coverUrl: string }>> {
  const results: Array<{ title: string; artist: string; coverUrl: string }> = [];
  const seen = new Set<string>();

  await Promise.all(seedArtists.map(async (artist) => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=album&limit=6`,
        { next: { revalidate: 3600 } }
      );
      const data = await res.json();
      for (const item of data.results ?? []) {
        const title = item.collectionName as string ?? '';
        const itemArtist = item.artistName as string ?? '';
        if (!title || !itemArtist) continue;
        if (SINGLE_PATTERN.test(title)) continue;
        const key = `${itemArtist.toLowerCase()}::${title.toLowerCase()}`;
        if (excludeKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        const cover = ((item.artworkUrl100 as string) ?? '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
        results.push({ title, artist: itemArtist, coverUrl: cover });
      }
    } catch { /* ignore */ }
  }));

  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistsParam = searchParams.get('artists') ?? '';
  if (!artistsParam) return NextResponse.json({ results: [] });

  // De-duplicate and cap to 5 most-recent unique artists (order preserved = most recent first)
  const allArtists = artistsParam.split(',').map((a) => a.trim()).filter(Boolean);
  const seedArtists: string[] = [];
  const seenArtists = new Set<string>();
  for (const a of [...allArtists].reverse()) {
    if (!seenArtists.has(a.toLowerCase())) {
      seenArtists.add(a.toLowerCase());
      seedArtists.push(a);
      if (seedArtists.length >= 5) break;
    }
  }

  // Build exclusion set from tray (all artists passed in = all tray artists)
  const excludeKeys = new Set(
    allArtists.map((a) => a.toLowerCase() + '::') // artist-prefix exclusion handled below
  );
  // We don't have titles here, so we'll filter in the components via inTray check

  const apiKey = process.env.LASTFM_API_KEY;

  let candidates: Array<{ title: string; artist: string; coverUrl: string }> = [];

  if (apiKey) {
    const lastfmResults = await lastfmRecs(seedArtists, apiKey, new Set());
    // Resolve missing covers via iTunes (only for top candidates)
    const resolved = await Promise.all(
      lastfmResults.slice(0, 15).map(async (c) => {
        const coverUrl = c.coverUrl || await itunesCover(c.artist, c.title);
        return { title: c.title, artist: c.artist, coverUrl };
      })
    );
    candidates = resolved.filter((c) => c.coverUrl); // drop anything still without art
  }

  // If Last.fm yielded fewer than 5 good results, pad with iTunes fallback
  if (candidates.length < 5) {
    const fallback = await itunesFallback(seedArtists, new Set());
    const fallbackFiltered = fallback.filter(
      (f) => !candidates.some((c) => c.title.toLowerCase() === f.title.toLowerCase() && c.artist.toLowerCase() === f.artist.toLowerCase())
    );
    candidates = [...candidates, ...fallbackFiltered];
  }

  return NextResponse.json(
    { results: candidates.slice(0, 10) },
    { headers: { 'Cache-Control': 's-maxage=1800' } }
  );
}
