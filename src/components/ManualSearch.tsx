'use client';

import { useState } from 'react';
import { useCollage } from '@/store/collageStore';
import { Album } from '@/types/album';
import CoverImage from '@/components/CoverImage';

export default function ManualSearch() {
  const { state, dispatch } = useCollage();
  const [open, setOpen] = useState(false);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [results, setResults] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!artist.trim() && !title.trim()) return;
    setLoading(true);
    setSearched(false);
    setResults([]);
    try {
      // Try two targeted queries in parallel: "artist album" and "album artist"
      const q1 = [artist, title].filter(Boolean).join(' ');
      const q2 = [title, artist].filter(Boolean).join(' ');
      const [r1, r2] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q1)}&limit=8`),
        q1 !== q2 ? fetch(`/api/search?q=${encodeURIComponent(q2)}&limit=8`) : Promise.resolve(null),
      ]);
      const d1 = await r1.json();
      const d2 = r2 ? await r2.json() : { results: [] };

      const seen = new Set<string>();
      const merged: Album[] = [];
      for (const a of [...(d1.results ?? []), ...(d2.results ?? [])]) {
        const key = `${a.title?.toLowerCase()}::${a.artist?.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(a);
      }

      // Sort: exact artist match first, then title match
      merged.sort((a, b) => {
        const aArtist = artist ? (a.artist.toLowerCase().includes(artist.toLowerCase()) ? 0 : 1) : 0;
        const bArtist = artist ? (b.artist.toLowerCase().includes(artist.toLowerCase()) ? 0 : 1) : 0;
        const aTitle  = title  ? (a.title.toLowerCase().includes(title.toLowerCase())   ? 0 : 1) : 0;
        const bTitle  = title  ? (b.title.toLowerCase().includes(title.toLowerCase())   ? 0 : 1) : 0;
        return (aArtist + aTitle) - (bArtist + bTitle);
      });

      setResults(merged.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function addAlbum(album: Album) {
    dispatch({ type: 'ADD_ALBUM', album });
    setOpen(false);
  }

  const inTray = (id: string) => state.tray.some((a) => a.id === id);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs"
        style={{ color: 'rgba(58,74,107,0.6)', fontFamily: 'Verdana, Tahoma, sans-serif', fontSize: 11 }}
      >
        {open ? '▾ ' : '▸ '}can&apos;t find it? search by artist + album
      </button>

      {open && (
        <form onSubmit={handleSearch} className="mt-3 flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="font-pixel text-[10px]" style={{ color: '#3a4a6b' }}>artist</label>
              <input
                value={artist}
                onChange={(e) => { setArtist(e.target.value); setSearched(false); }}
                placeholder="e.g. Lydia"
                style={{
                  background: '#f3ead6',
                  border: '2px solid rgba(23,21,20,0.2)',
                  borderRadius: 3,
                  padding: '7px 10px',
                  fontFamily: 'Verdana, Tahoma, sans-serif',
                  fontSize: 12,
                  color: '#171514',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="font-pixel text-[10px]" style={{ color: '#3a4a6b' }}>album</label>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSearched(false); }}
                placeholder="e.g. Illuminate"
                style={{
                  background: '#f3ead6',
                  border: '2px solid rgba(23,21,20,0.2)',
                  borderRadius: 3,
                  padding: '7px 10px',
                  fontFamily: 'Verdana, Tahoma, sans-serif',
                  fontSize: 12,
                  color: '#171514',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (!artist.trim() && !title.trim())}
            className="btn-bevel self-start"
            style={loading || (!artist.trim() && !title.trim()) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >
            {loading ? 'searching…' : 'find it →'}
          </button>

          {searched && results.length === 0 && (
            <p className="text-xs" style={{ color: 'rgba(23,21,20,0.5)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
              track not found. (try LimeWire? …jk) — double-check the spelling and try again.
            </p>
          )}

          {results.length > 0 && (
            <div
              className="flex flex-col overflow-hidden"
              style={{ border: '1px solid rgba(23,21,20,0.15)', borderRadius: 4, background: '#f3ead6' }}
            >
              {results.map((album) => {
                const added = inTray(album.id);
                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => !added && addAlbum(album)}
                    disabled={added}
                    className="flex items-center gap-3 px-3 py-2.5 text-left w-full"
                    style={{
                      borderBottom: '1px solid rgba(23,21,20,0.08)',
                      background: added ? 'rgba(154,213,0,0.1)' : '#f3ead6',
                      cursor: added ? 'default' : 'pointer',
                      opacity: added ? 0.65 : 1,
                    }}
                    onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLElement).style.background = '#e8dcc4'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = added ? 'rgba(154,213,0,0.1)' : '#f3ead6'; }}
                  >
                    <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2, overflow: 'hidden', boxShadow: '1px 1px 4px rgba(0,0,0,0.25)' }}>
                      <CoverImage src={album.coverUrl} alt={album.title} width={44} height={44} className="object-cover" artist={album.artist} title={album.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate" style={{ color: '#171514', fontFamily: 'Verdana, Tahoma, sans-serif' }}>{album.title}</div>
                      <div className="text-xs truncate" style={{ color: 'rgba(23,21,20,0.55)' }}>
                        {album.artist}{album.year ? ` · ${album.year}` : ''}
                      </div>
                    </div>
                    {added
                      ? <span className="font-pixel text-[10px] flex-shrink-0" style={{ color: '#5a8500' }}>in binder</span>
                      : <span className="text-xs flex-shrink-0 font-bold" style={{ color: '#3a4a6b' }}>+ add</span>
                    }
                  </button>
                );
              })}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
