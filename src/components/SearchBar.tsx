'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollage } from '@/store/collageStore';
import { Album } from '@/types/album';
import Image from 'next/image';

export default function SearchBar() {
  const { state, dispatch } = useCollage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inTray = (id: string) => state.tray.some((a) => a.id === id);

  const addAlbum = (album: Album) => {
    dispatch({ type: 'ADD_ALBUM', album });
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="search an album or artist… (no skips allowed)"
          style={{
            width: '100%',
            background: 'var(--tape)',
            border: '2px solid rgba(23,21,20,0.25)',
            borderRadius: '4px',
            padding: '10px 14px',
            color: 'var(--ink)',
            fontFamily: 'Verdana, Tahoma, sans-serif',
            fontSize: '13px',
            boxShadow: '0 1px 0 #fff8 inset, 0 2px 4px rgba(0,0,0,0.12)',
            outline: 'none',
          }}
          onFocusCapture={(e) => (e.target.style.borderColor = 'var(--denim)')}
          onBlurCapture={(e) => (e.target.style.borderColor = 'rgba(23,21,20,0.25)')}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[10px]" style={{ color: 'var(--denim)' }}>
            ripping…
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 overflow-y-auto"
          style={{
            background: '#f3ead6',
            border: '2px solid rgba(23,21,20,0.22)',
            borderRadius: '4px',
            boxShadow: '3px 5px 16px rgba(0,0,0,0.3)',
            maxHeight: '340px',
          }}
        >
          {results.map((album) => {
            const added = inTray(album.id);
            return (
              <button
                key={album.id}
                onClick={() => !added && addAlbum(album)}
                disabled={added}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{
                  borderBottom: '1px solid rgba(23,21,20,0.1)',
                  background: added ? 'rgba(154,213,0,0.12)' : '#f3ead6',
                  cursor: added ? 'default' : 'pointer',
                  opacity: added ? 0.65 : 1,
                }}
                onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLElement).style.background = '#e8dcc4'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = added ? 'rgba(154,213,0,0.12)' : '#f3ead6'; }}
              >
                {album.coverUrl ? (
                  <Image src={album.coverUrl} alt={album.title} width={44} height={44}
                    className="rounded flex-shrink-0 object-cover" style={{ boxShadow: '1px 1px 4px rgba(0,0,0,0.3)' }} unoptimized />
                ) : (
                  <div className="w-11 h-11 rounded flex-shrink-0" style={{ background: '#a8854d' }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate" style={{ color: '#171514', fontFamily: 'Verdana, Tahoma, sans-serif' }}>{album.title}</div>
                  <div className="text-xs truncate" style={{ color: 'rgba(23,21,20,0.55)' }}>
                    {album.artist}{album.year ? ` · ${album.year}` : ''}
                  </div>
                </div>
                {added ? (
                  <span className="font-pixel text-[10px] flex-shrink-0" style={{ color: '#5a8500' }}>in binder</span>
                ) : (
                  <span className="text-xs flex-shrink-0 font-bold" style={{ color: '#3a4a6b' }}>+ add</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
