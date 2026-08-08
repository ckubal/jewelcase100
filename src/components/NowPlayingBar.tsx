'use client';

import { useState } from 'react';

const EQ_BARS = [
  { h: [4, 14, 4], dur: '0.6s' },
  { h: [10, 4, 10], dur: '0.5s' },
  { h: [7, 14, 3], dur: '0.7s' },
  { h: [12, 5, 12], dur: '0.55s' },
  { h: [5, 13, 5], dur: '0.65s' },
];

export default function NowPlayingBar() {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 now-playing z-40"
      style={{ height: 36 }}
    >
      <div className="max-w-2xl mx-auto px-4 h-full flex items-center gap-4">
        {/* Play/pause button */}
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            background: 'linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 100%)',
            border: '1px solid #555',
            borderRadius: 3,
            color: '#9ad500',
            fontSize: 10,
            boxShadow: '0 1px 0 #fff2 inset',
          }}
          title={playing ? 'pause' : 'press play'}
        >
          {playing ? '■' : '▸'}
        </button>

        {/* EQ bars */}
        <div className="flex items-end gap-px flex-shrink-0" style={{ height: 16 }}>
          {EQ_BARS.map((bar, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: playing ? bar.h[1] : bar.h[0],
                background: '#9ad500',
                borderRadius: 1,
                transition: playing ? `height ${bar.dur} ease-in-out` : undefined,
                animation: playing ? `eq${i + 1} ${bar.dur} ease-in-out infinite alternate` : undefined,
              }}
            />
          ))}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0 font-pixel text-[10px]" style={{ color: '#9ad500' }}>
          {playing ? '♫ now playing: your taste, on shuffle' : '♫ now playing — press play'}
        </div>

        {/* Hit counter */}
        <div className="font-pixel text-[10px] flex-shrink-0" style={{ color: 'rgba(154,213,0,0.5)' }}>
          visitor #00,001
        </div>
      </div>
    </div>
  );
}
