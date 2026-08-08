'use client';

import { useState, useEffect } from 'react';
import { useCollage } from '@/store/collageStore';

function Explainer({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(!collapsed);

  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  return (
    <div className="panel" style={{ borderLeft: '3px solid #3a4a6b', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ fontFamily: 'Verdana, Tahoma, sans-serif' }}
      >
        <span className="font-bold text-sm" style={{ color: '#171514' }}>what is this?</span>
        <span className="font-pixel text-[10px]" style={{ color: '#3a4a6b' }}>{open ? '▲ hide' : '▼ show'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(23,21,20,0.75)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            you know the albums that actually left a mark on you — the ones you played front to back,
            that got you through something, that still hit the same way years later.
            this is where you put them on a wall.
          </p>
          <div className="flex flex-col gap-1.5">
            {([
              ['01', 'dig through your memory and add the albums that mattered. as many as 100.'],
              ['02', 'rank them — drag them into order on the next page. best at the top.'],
              ['03', 'generate a grid of the covers, sized by how many you picked. download it, share it, argue about it.'],
            ] as const).map(([n, text]) => (
              <div key={n} className="flex gap-3 items-start">
                <span className="font-pixel text-[10px] flex-shrink-0 mt-0.5" style={{ color: '#3a4a6b' }}>{n}</span>
                <span className="text-xs leading-relaxed" style={{ color: 'rgba(23,21,20,0.65)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>{text}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3 italic" style={{ color: 'rgba(23,21,20,0.4)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            no logins. no subscriptions. no algorithms. just your taste.
          </p>
        </div>
      )}
    </div>
  );
}
import SearchBar from '@/components/SearchBar';
import Tray from '@/components/Tray';
import Recommendations from '@/components/Recommendations';
import ArrangeScreen from '@/components/ArrangeScreen';
import GenerateScreen from '@/components/GenerateScreen';
import BackgroundAnimation from '@/components/BackgroundAnimation';
import PasteImport from '@/components/PasteImport';
import ManualSearch from '@/components/ManualSearch';

export default function Home() {
  const { state, dispatch } = useCollage();
  const { screen } = state;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#c9a36a' }}>
      {/* Animated background */}
      <BackgroundAnimation />

<main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 pb-8 relative z-10">
        {/* Content card */}
        <div
          className="rounded-sm p-6"
          style={{
            background: 'rgba(243,234,214,0.88)',
            boxShadow: '3px 5px 20px rgba(0,0,0,0.22)',
            backdropFilter: 'blur(2px)',
          }}
        >
          {/* Back nav */}
          {(screen === 'arrange' || screen === 'generate') && (
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: screen === 'generate' ? 'arrange' : 'add' })}
              className="mb-5 text-sm hover:underline flex items-center gap-1 font-bold"
              style={{ color: '#3a4a6b', fontFamily: 'Verdana, Tahoma, sans-serif' }}
            >
              ← back
            </button>
          )}

          {/* Wordmark */}
          <div className="mb-7">
            <h1
              className="text-4xl font-black tracking-tight leading-none"
              style={{ fontFamily: 'Arial Black, Helvetica, sans-serif', color: '#171514', letterSpacing: '-0.02em' }}
            >
              jewelcase 100
            </h1>

            {screen === 'add' && (
              <p className="mt-2 text-sm" style={{ color: '#3a4a6b' }}>
                before playlists, there were bedroom walls.
              </p>
            )}
            {screen === 'arrange' && (
              <p className="mt-2 text-sm font-bold" style={{ color: '#3a4a6b' }}>
                pin them up. best stuff up top.
              </p>
            )}
            {screen === 'generate' && (
              <p className="mt-2 text-sm font-bold" style={{ color: '#3a4a6b' }}>
                ready to hang.
              </p>
            )}
          </div>

          {/* Add screen */}
          {screen === 'add' && (
            <div className="flex flex-col gap-7">
              {/* Explainer — collapses after first album added */}
              <Explainer collapsed={state.tray.length > 0} />

              <div className="flex flex-col gap-1">
                <SearchBar />
                <ManualSearch />
                <div className="flex justify-end">
                  <PasteImport />
                </div>
              </div>
              <Tray />
              <Recommendations />
            </div>
          )}

          {screen === 'arrange' && <ArrangeScreen />}
          {screen === 'generate' && <GenerateScreen />}
        </div>

        {/* Footer */}
        <div
          className="text-center mt-4 text-xs"
          style={{ color: 'rgba(23,21,20,0.55)', fontFamily: 'Verdana, Tahoma, sans-serif' }}
        >
          <div>all killer, no filler.</div>
          <div className="mt-0.5">
            made in a teenage bedroom · a{' '}
            <a href="https://weirdlittleideas.com" style={{ color: '#3a4a6b' }} className="hover:underline">
              weird little idea
            </a>{' '}
            by{' '}
            <a href="https://www.charliekubal.com/" style={{ color: '#3a4a6b' }} className="hover:underline">
              charlie kubal
            </a>
          </div>
          <div className="font-pixel text-[10px] mt-1">best viewed at 1024×768 · © 2003</div>
        </div>
      </main>
    </div>
  );
}
