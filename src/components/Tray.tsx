'use client';

import CoverImage from '@/components/CoverImage';
import { useEffect, useRef } from 'react';
import { useCollage } from '@/store/collageStore';
import { GRID_SIZES } from '@/types/album';

export default function Tray() {
  const { state, dispatch } = useCollage();
  const { tray } = state;
  const canArrange = tray.length >= 9;
  const nextGridSize = GRID_SIZES.find((s) => s > tray.length);
  const nextDim = nextGridSize ? Math.sqrt(nextGridSize) : null;
  const toNext = nextGridSize ? nextGridSize - tray.length : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(tray.length);

  // Scroll to the right whenever a new album is added
  useEffect(() => {
    if (tray.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
    prevLengthRef.current = tray.length;
  }, [tray.length]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
              the binder
            </span>
            <span className="font-pixel text-[10px] px-2 py-0.5 rounded flex-shrink-0" style={{ background: '#3a4a6b', color: '#fff' }}>
              {tray.length} in
            </span>
          </div>
          <span className="text-xs italic" style={{ color: 'rgba(23,21,20,0.5)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            {!canArrange
              ? `need ${9 - tray.length} more for a 3×3`
              : toNext
              ? `add ${toNext} more to unlock a ${nextDim}×${nextDim}`
              : "you've got the whole wall — let's hang it"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tray.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Start over and clear everything?')) dispatch({ type: 'CLEAR_ALL' }); }}
              className="text-xs"
              style={{ color: 'rgba(23,21,20,0.35)', fontFamily: 'Verdana, Tahoma, sans-serif', textDecoration: 'underline' }}
            >
              start over
            </button>
          )}
          <button
            onClick={() => canArrange && dispatch({ type: 'SET_SCREEN', screen: 'arrange' })}
            disabled={!canArrange}
            className="btn-bevel flex-shrink-0"
            style={canArrange ? {} : { opacity: 0.4, cursor: 'not-allowed' }}
          >
            {canArrange ? 'to the wall →' : `add ${9 - tray.length} more to get a grid`}
          </button>
        </div>
      </div>

      {tray.length === 0 ? (
        <div
          className="h-20 flex items-center justify-center rounded text-sm"
          style={{ border: '2px dashed rgba(23,21,20,0.2)', color: 'rgba(23,21,20,0.4)', fontFamily: 'Verdana, Tahoma, sans-serif' }}
        >
          the binder&apos;s empty. go dig. 🪙
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pt-1 pb-2" style={{ scrollbarWidth: 'thin' }}>
          {tray.map((album) => (
            <div key={album.id} className="relative flex-shrink-0 group tape-corner pt-3">
              <div className="overflow-hidden" style={{ width: 72, height: 72, boxShadow: '1px 2px 6px rgba(0,0,0,0.35)', borderRadius: 2 }}>
                <CoverImage src={album.coverUrl} alt={album.title} width={72} height={72} className="object-cover" artist={album.artist} title={album.title} />
              </div>
              <button
                onClick={() => dispatch({ type: 'REMOVE_ALBUM', id: album.id })}
                className="absolute top-0 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center transition-opacity font-bold [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                style={{ background: '#d12b2b', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 10 }}
                title="Remove from binder"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
