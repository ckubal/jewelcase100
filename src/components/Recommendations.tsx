'use client';

import { useEffect, useRef, useState } from 'react';
import CoverImage from '@/components/CoverImage';
import { useCollage } from '@/store/collageStore';
import { Album } from '@/types/album';

interface RecResult {
  title: string;
  artist: string;
  coverUrl: string;
}

const REC_HEADERS = [
  'you might\'ve forgotten about…',
  'more for the wall →',
  'also in heavy rotation…',
  'deep cuts you might\'ve slept on…',
  'your taste says you\'d like…',
];

export default function Recommendations() {
  const { state, dispatch } = useCollage();
  const { tray, recommendations, recsLoading } = state;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [simpleRecs, setSimpleRecs] = useState<Album[]>([]);
  const [simpleLoading, setSimpleLoading] = useState(false);
  const [headerIdx] = useState(() => Math.floor(Math.random() * REC_HEADERS.length));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (tray.length < 3) {
      if (tray.length > 0) {
        const artist = tray[tray.length - 1].artist;
        setSimpleLoading(true);
        debounceRef.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(artist)}&limit=10`);
            const data = await res.json();
            const filtered = (data.results ?? []).filter(
              (a: Album) => a.artist === artist && !tray.find((t) => t.id === a.id)
            );
            setSimpleRecs(filtered.slice(0, 6));
          } catch { setSimpleRecs([]); }
          finally { setSimpleLoading(false); }
        }, 500);
      }
      return;
    }

    // Use the 5 most recently added unique artists as seeds
    const recentArtists: string[] = [];
    const seen = new Set<string>();
    for (const a of [...tray].reverse()) {
      if (!seen.has(a.artist.toLowerCase())) {
        seen.add(a.artist.toLowerCase());
        recentArtists.push(a.artist);
        if (recentArtists.length >= 5) break;
      }
    }
    const artists = recentArtists.join(',');
    dispatch({ type: 'SET_RECS_LOADING', loading: true });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recommend?artists=${encodeURIComponent(artists)}`);
        const data = await res.json();
        dispatch({ type: 'SET_RECOMMENDATIONS', recommendations: data.results ?? [] });
      } catch {
        dispatch({ type: 'SET_RECOMMENDATIONS', recommendations: [] });
      } finally {
        dispatch({ type: 'SET_RECS_LOADING', loading: false });
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray.length, tray.map((a) => a.id).join(',')]);

  const inTray = (title: string, artist: string) =>
    tray.some((a) => a.title === title && a.artist === artist);

  const addRec = (rec: RecResult) => {
    const id = `rec-${rec.artist}-${rec.title}`.replace(/\s+/g, '-').toLowerCase();
    if (tray.some((a) => a.id === id)) return;
    dispatch({
      type: 'ADD_ALBUM',
      album: { id, title: rec.title, artist: rec.artist, year: '', coverUrl: rec.coverUrl, source: 'musicbrainz' },
    });
  };

  const allItems: RecResult[] =
    tray.length >= 3
      ? recommendations
      : simpleRecs.map((a) => ({ title: a.title, artist: a.artist, coverUrl: a.coverUrl }));

  const items = allItems.filter((item) => !inTray(item.title, item.artist));

  const isLoading = tray.length >= 3 ? recsLoading : simpleLoading;
  const heading =
    tray.length >= 3
      ? REC_HEADERS[headerIdx]
      : tray.length > 0
      ? `more by ${tray[tray.length - 1].artist.toLowerCase()}`
      : null;

  if (tray.length === 0) return null;

  return (
    <div className="w-full">
      {heading && (
        <div className="font-pixel text-[10px] mb-3 uppercase" style={{ color: 'var(--denim)', letterSpacing: '0.06em' }}>
          {heading}
        </div>
      )}

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-24">
              <div className="w-24 h-24 rounded mb-2 animate-pulse" style={{ background: 'var(--cork-dark)', opacity: 0.4 }} />
              <div className="h-2 rounded mb-1 w-3/4 animate-pulse" style={{ background: 'var(--cork-dark)', opacity: 0.3 }} />
              <div className="h-2 rounded w-1/2 animate-pulse" style={{ background: 'var(--cork-dark)', opacity: 0.3 }} />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {items.map((item, i) => (
            <div key={i} className="flex-shrink-0 w-24 group">
              <div className="relative tape-corner pt-2">
                <div
                  className="overflow-hidden"
                  style={{ width: 96, height: 96, borderRadius: 2, boxShadow: '1px 2px 5px rgba(0,0,0,0.3)' }}
                >
                  <CoverImage src={item.coverUrl} alt={item.title} width={96} height={96} className="object-cover" artist={item.artist} title={item.title} />
                </div>
                <button
                  onClick={() => tray.length >= 3 ? addRec(item) : addRec(item)}
                  className="absolute inset-0 mt-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(23,21,20,0.55)', borderRadius: 2 }}
                  title="add to binder"
                >
                  <span className="font-bold text-white text-xl">+</span>
                </button>
              </div>
              <div className="mt-1.5">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>{item.title}</div>
                <div className="text-xs truncate" style={{ color: 'rgba(23,21,20,0.5)' }}>{item.artist}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
