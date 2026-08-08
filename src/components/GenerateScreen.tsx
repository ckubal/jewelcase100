'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useCollage } from '@/store/collageStore';
import { gridDim } from '@/types/album';
import StatsScreen from '@/components/StatsScreen';

export default function GenerateScreen() {
  const { state } = useCollage();
  const { tray, gridSize, gridOrder } = state;
  const [showStats, setShowStats] = useState(false);
  const [showLiner, setShowLiner] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showRanks, setShowRanks] = useState(true);
  type CaseMode = 'lower' | 'title' | 'upper';
  const [caseMode, setCaseMode] = useState<CaseMode>('lower');
  const [rendered, setRendered] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [copying, setCopying] = useState(false);
  const [artistFirst, setArtistFirst] = useState(true);
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const albumMap = useMemo(() => new Map(tray.map((a) => [a.id, a])), [tray]);
  const inGridIds = useMemo(() => {
    const ordered = [
      ...gridOrder.filter((id) => albumMap.has(id)),
      ...tray.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
    ];
    return ordered.slice(0, gridSize);
  }, [albumMap, gridOrder, tray, gridSize]);
  const dim = gridDim(gridSize);
  const CELL = 600;

  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = dim * CELL;
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, size, size);
    setLoadedCount(0);

    let done = 0;
    await Promise.all(
      inGridIds.map((id, i) => {
        const album = albumMap.get(id);
        if (!album) return Promise.resolve();
        const col = i % dim;
        const row = Math.floor(i / dim);
        const x = col * CELL;
        const y = row * CELL;

        return new Promise<void>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          const finish = () => { done++; setLoadedCount(done); resolve(); };
          img.onload = () => {
            ctx.drawImage(img, x, y, CELL, CELL);
            if (showRanks) {
              const rank = String(i + 1);
              const fontSize = Math.max(22, CELL / 18);
              ctx.font = `bold ${fontSize}px monospace`;
              const textWidth = ctx.measureText(rank).width;
              const pad = 10;
              const bw = textWidth + pad * 2;
              const bh = fontSize + pad * 1.4;
              const bx = x + 12;
              const by = y + 12;
              const r = 5;
              ctx.fillStyle = 'rgba(0,0,0,0.75)';
              ctx.beginPath();
              ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by);
              ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
              ctx.lineTo(bx + bw, by + bh - r);
              ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
              ctx.lineTo(bx + r, by + bh);
              ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
              ctx.lineTo(bx, by + r);
              ctx.quadraticCurveTo(bx, by, bx + r, by);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.fillText(rank, bx + pad, by + bh - pad * 0.7);
            }
            finish();
          };
          img.onerror = () => {
            if (!img.src.startsWith('/api/cover-proxy')) {
              img.src = `/api/cover-proxy?url=${encodeURIComponent(album.coverUrl)}`;
            } else {
              ctx.fillStyle = '#2a2a2a';
              ctx.fillRect(x, y, CELL, CELL);
              ctx.fillStyle = '#555';
              ctx.font = `${CELL / 10}px monospace`;
              ctx.fillText('?', x + CELL / 2 - 10, y + CELL / 2);
              finish();
            }
          };
          img.src = album.coverUrl;
        });
      })
    );

    setRendered(true);
  }, [inGridIds, dim, showRanks, albumMap]);

  useEffect(() => {
    setRendered(false);
    drawCanvas();
  }, [drawCanvas]);

  const downloadCanvas = async (targetPx?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let exportCanvas = canvas;
    if (targetPx) {
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = targetPx;
      exportCanvas.height = targetPx;
      exportCanvas.getContext('2d')!.drawImage(canvas, 0, 0, targetPx, targetPx);
    }
    const filename = `jewelcase100-${targetPx ?? canvas.width}px.png`;
    const blob = await new Promise<Blob>((res) => exportCanvas.toBlob((b) => res(b!), 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* user cancelled */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  function applyCase(s: string): string {
    if (caseMode === 'lower') return s.toLowerCase();
    if (caseMode === 'upper') return s.toUpperCase();
    return s;
  }

  const textList = inGridIds
    .map((id, i) => {
      const album = albumMap.get(id);
      if (!album) return null;
      const entry = artistFirst
        ? `${album.artist} – ${album.title}`
        : `${album.title} – ${album.artist}`;
      return applyCase(`${i + 1}. ${entry}`);
    })
    .filter(Boolean)
    .join('\n');

  const shareText = `my wall — ${inGridIds.length} albums, ranked, in order. what's on yours? 🎧 #jewelcase100\n\nmake yours at jewelcase100.weirdlittleideas.com`;

  const handleWebShare = async () => {
    const canvas = canvasRef.current;
    if (navigator.share && canvas) {
      try {
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
        const file = new File([blob], 'jewelcase100.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: shareText, files: [file] });
        } else {
          await navigator.share({ text: shareText });
        }
      } catch { /* user cancelled or browser blocked */ }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
      alert('Share text copied! Paste it wherever you like.');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(textList);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch {
      if (hiddenTextareaRef.current) {
        hiddenTextareaRef.current.select();
        document.execCommand('copy');
        setCopying(true);
        setTimeout(() => setCopying(false), 1500);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Canvas preview */}
      <div>
        {!rendered && (
          <div className="font-pixel text-[11px] mb-2" style={{ color: 'var(--denim)' }}>
            ripping cover art… {loadedCount}/{inGridIds.length}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: Math.min(dim * 140, 520),
            height: 'auto',
            aspectRatio: '1 / 1',
            boxShadow: '3px 5px 16px rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        />
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleWebShare}
          className="btn-bevel flex items-center gap-1.5"
          style={{ fontSize: 12, padding: '6px 14px', background: '#3a4a6b', color: '#fff', borderColor: '#1e2d4a', fontWeight: 'bold' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-5-5.5 5-2.5m-5 6 5 2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="13.5" cy="5.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="13.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          share ↗
        </button>
        <button onClick={() => downloadCanvas(1500)} disabled={!rendered} className="btn-bevel" style={!rendered ? { opacity: 0.4 } : {}}>
          save poster (.png)
        </button>
        <button onClick={() => downloadCanvas()} disabled={!rendered} className="btn-bevel" style={!rendered ? { opacity: 0.4 } : {}}>
          hi-res ({dim * CELL}px)
        </button>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: 'rgba(23,21,20,0.6)' }}>
          <input type="checkbox" checked={showRanks} onChange={(e) => setShowRanks(e.target.checked)} />
          ranks
        </label>
      </div>

      {/* Stats — collapsible, closed by default */}
      <div className="panel">
        <button
          onClick={() => setShowStats((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="text-left">
            <span className="font-bold text-sm" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
              stats + insights
            </span>
            {!showStats && (
              <p className="text-xs mt-0.5" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: 'rgba(23,21,20,0.45)' }}>
                artist leaderboard · genre breakdown · era chart
              </p>
            )}
          </div>
          <span className="font-pixel text-[10px] flex-shrink-0 ml-4" style={{ color: '#3a4a6b' }}>
            {showStats ? '▲ hide' : '▼ show'}
          </span>
        </button>
        {showStats && (
          <div className="px-4 pb-4">
            <StatsScreen />
          </div>
        )}
      </div>

      {/* Liner notes — collapsible, closed by default */}
      <div className="panel">
        <button
          onClick={() => setShowLiner((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="text-left">
            <span className="font-bold text-sm" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
              liner notes
            </span>
            {!showLiner && (
              <p className="text-xs mt-0.5" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: 'rgba(23,21,20,0.45)' }}>
                {inGridIds.length} albums · copy or download the full list
              </p>
            )}
          </div>
          <span className="font-pixel text-[10px] flex-shrink-0 ml-4" style={{ color: '#3a4a6b' }}>
            {showLiner ? '▲ hide' : '▼ show'}
          </span>
        </button>

        {showLiner && (
          <div className="px-4 pb-4 flex flex-col gap-3">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {(['lower', 'title', 'upper'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCaseMode(mode)}
                    className="btn-bevel"
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      ...(caseMode === mode ? { background: '#3a4a6b', color: '#fff', borderColor: '#1e2d4a' } : {}),
                    }}
                  >
                    {mode === 'lower' ? 'aa' : mode === 'title' ? 'Aa' : 'AA'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setArtistFirst((v) => !v)}
                className="btn-bevel"
                style={{ fontSize: 10, padding: '2px 7px' }}
              >
                {artistFirst ? 'artist – album' : 'album – artist'}
              </button>
              <div className="flex gap-2 ml-auto">
                <button onClick={copyToClipboard} className="btn-bevel" style={{ fontSize: 11, padding: '4px 10px' }}>
                  {copying ? 'copied ✓' : 'copy list'}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([textList], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'liner-notes.txt'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-bevel"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  .txt
                </button>
              </div>
            </div>

            {/* List as div — no textarea, no zoom trigger */}
            <div
              style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 11,
                lineHeight: 1.7,
                color: 'var(--ink)',
                opacity: 0.7,
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}
            >
              {textList}
            </div>

            {/* Hidden textarea for fallback clipboard copy */}
            <textarea
              ref={hiddenTextareaRef}
              readOnly
              value={textList}
              style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0 }}
              tabIndex={-1}
              aria-hidden
            />
          </div>
        )}
      </div>
    </div>
  );
}
