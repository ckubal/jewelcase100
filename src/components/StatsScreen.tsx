'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCollage } from '@/store/collageStore';
import { normalizeGenre } from '@/types/album';

// ── Canvas helpers ────────────────────────────────────────────────────────────

const BG = '#0e0e0e';
const CREAM = '#f0e8d0';
const PINK = '#ff3fa0';
const LIME = '#b0f000';
const CYAN = '#3bbfff';
const DIM = 'rgba(240,232,208,0.35)';

function px(n: number) { return Math.round(n); }

function setupCanvas(canvas: HTMLCanvasElement, size = 1080) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  return ctx;
}

function drawHeader(ctx: CanvasRenderingContext2D, size: number, label: string, title: string, subtitle: string) {
  const pad = px(size * 0.065);
  // brand label
  ctx.font = `bold ${px(size * 0.028)}px monospace`;
  ctx.fillStyle = PINK;
  ctx.fillText(label, pad, pad + px(size * 0.028));
  // title
  ctx.font = `bold ${px(size * 0.088)}px Arial Black, sans-serif`;
  ctx.fillStyle = CREAM;
  const titleY = pad + px(size * 0.135);
  // word wrap title at ~18 chars
  const words = title.split(' ');
  let line = '';
  let lineY = titleY;
  const lineH = px(size * 0.095);
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > size - pad * 2 && line) {
      ctx.fillText(line, pad, lineY);
      line = w;
      lineY += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, pad, lineY);
  // subtitle
  ctx.font = `${px(size * 0.033)}px monospace`;
  ctx.fillStyle = CYAN;
  ctx.fillText(subtitle, pad, lineY + px(size * 0.052));
  // dashed divider
  const divY = lineY + px(size * 0.085);
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(240,232,208,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, divY);
  ctx.lineTo(size - pad, divY);
  ctx.stroke();
  ctx.setLineDash([]);
  return divY + px(size * 0.04);
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], filename, { type: 'image/png' });
  // On mobile prefer Web Share → saves to camera roll instead of Files
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* user cancelled */ }
    return; // don't fall through to link download whether share succeeded or was dismissed
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Artist card ───────────────────────────────────────────────────────────────

function useArtistCanvas(albums: ReturnType<typeof useCollage>['state']['tray'], gridOrder: string[], gridSize: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || albums.length === 0) return;
    const S = 1080;
    const ctx = setupCanvas(canvas, S);
    const pad = px(S * 0.065);

    // Compute scores: points = 101 - rank for items in grid
    const albumMap = new Map(albums.map((a) => [a.id, a]));
    const orderedIds = [
      ...gridOrder.filter((id) => albumMap.has(id)),
      ...albums.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
    ].slice(0, gridSize);

    const artistScore: Record<string, { pts: number; count: number }> = {};
    orderedIds.forEach((id, i) => {
      const a = albumMap.get(id);
      if (!a) return;
      const pts = gridSize + 1 - (i + 1);
      if (!artistScore[a.artist]) artistScore[a.artist] = { pts: 0, count: 0 };
      artistScore[a.artist].pts += pts;
      artistScore[a.artist].count++;
    });

    // Sort by pts desc, tiebreak by count desc
    const sorted = Object.entries(artistScore)
      .sort((a, b) => b[1].pts - a[1].pts || b[1].count - a[1].count)
      .slice(0, 8);

    const subtitle = `most albums in my top ${gridSize}, rank-weighted`;
    let y = drawHeader(ctx, S, 'jewelcase 100', 'the artists that\nbuilt the list', subtitle);

    // Column headers
    const colAlbums = S - pad - px(S * 0.22);
    const colPts = S - pad;
    ctx.font = `${px(S * 0.025)}px monospace`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.fillText('albums', colAlbums, y);
    ctx.fillStyle = LIME;
    ctx.fillText('pts', colPts, y);
    ctx.textAlign = 'left';
    y += px(S * 0.06);

    const rowH = px(S * 0.082);
    const footerY = S - px(S * 0.075); // reserve space for footer note
    const maxRows = Math.floor((footerY - y) / rowH);
    const visible = sorted.slice(0, maxRows);
    visible.forEach(([artist, { pts, count }], i) => {
      const rowY = y + i * rowH;
      const isTop = i === 0;

      // highlight row for #1
      if (isTop) {
        ctx.fillStyle = 'rgba(255,63,160,0.12)';
        ctx.fillRect(pad - 8, rowY - px(S * 0.058), S - pad * 2 + 16, px(S * 0.075));
      }

      // star
      ctx.font = `${px(S * 0.036)}px sans-serif`;
      ctx.fillStyle = isTop ? PINK : CYAN;
      ctx.fillText('★', pad, rowY);

      // artist name
      ctx.font = isTop
        ? `bold ${px(S * 0.052)}px Arial Black, sans-serif`
        : `${px(S * 0.048)}px Arial, sans-serif`;
      ctx.fillStyle = isTop ? PINK : CREAM;
      // truncate if needed
      let name = artist;
      while (ctx.measureText(name).width > colAlbums - pad - px(S * 0.07) && name.length > 4) {
        name = name.slice(0, -2) + '…';
      }
      ctx.fillText(name, pad + px(S * 0.055), rowY);

      // albums count
      ctx.font = `${px(S * 0.038)}px monospace`;
      ctx.fillStyle = DIM;
      ctx.textAlign = 'right';
      ctx.fillText(String(count), colAlbums, rowY);

      // pts
      ctx.font = `bold ${px(S * 0.052)}px Arial Black, sans-serif`;
      ctx.fillStyle = LIME;
      ctx.fillText(String(pts), colPts, rowY);
      ctx.textAlign = 'left';
    });

    // Footer note
    const top = visible[0];
    const runner = visible[1];
    if (top && runner) {
      const note = `${top[0].split(' ')[0]} leads on volume; ${runner[0].split(' ')[0]} punches above their count.`;
      ctx.font = `italic ${px(S * 0.028)}px Georgia, serif`;
      ctx.fillStyle = DIM;
      ctx.fillText(note, pad, S - pad);
    }
  }, [albums, gridOrder, gridSize]);

  useEffect(() => { draw(); }, [draw]);
  return canvasRef;
}

// ── Genre card ────────────────────────────────────────────────────────────────

const GENRE_PALETTE = [PINK, CYAN, '#b0f000', '#ff9900', '#cc88ff', '#ff5533', '#888888'];

function useGenreCanvas(albums: ReturnType<typeof useCollage>['state']['tray'], gridOrder: string[], gridSize: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || albums.length === 0) return;
    const S = 1080;
    const ctx = setupCanvas(canvas, S);
    const pad = px(S * 0.065);

    const albumMap = new Map(albums.map((a) => [a.id, a]));
    const orderedIds = [
      ...gridOrder.filter((id) => albumMap.has(id)),
      ...albums.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
    ].slice(0, gridSize);

    // Raw counts and weighted scores
    const rawCount: Record<string, number> = {};
    const wtdScore: Record<string, number> = {};
    orderedIds.forEach((id, i) => {
      const a = albumMap.get(id);
      if (!a) return;
      const g = a.genre ?? 'other';
      const pts = gridSize + 1 - (i + 1);
      rawCount[g] = (rawCount[g] ?? 0) + 1;
      wtdScore[g] = (wtdScore[g] ?? 0) + pts;
    });

    const totalPts = Object.values(wtdScore).reduce((s, v) => s + v, 0);
    const n = orderedIds.length;

    // Build dynamic genre list: top 6 by count, collapse rest into "other"
    const sorted = Object.entries(rawCount)
      .filter(([g]) => g !== 'other')
      .sort((a, b) => b[1] - a[1]);
    const top6 = sorted.slice(0, 6).map(([g]) => g);
    const otherCount = sorted.slice(6).reduce((s, [, c]) => s + c, 0) + (rawCount['other'] ?? 0);
    const otherPts = sorted.slice(6).reduce((s, [g]) => s + (wtdScore[g] ?? 0), 0) + (wtdScore['other'] ?? 0);
    if (otherCount > 0) {
      rawCount['other'] = otherCount;
      wtdScore['other'] = otherPts;
    }
    const genres = otherCount > 0 ? [...top6, 'other'] : top6;
    // Assign colors by rank position
    const genreColor = (g: string) => g === 'other' ? '#888888' : GENRE_PALETTE[genres.indexOf(g)] ?? '#888888';

    // Find dominant genre for headline
    const topGenre = genres[0];
    const topPct = Math.round((rawCount[topGenre] ?? 0) / n * 100);
    const topWtd = Math.round((wtdScore[topGenre] ?? 0) / totalPts * 100);

    const subtitle = `and even bigger at the top — ${topWtd}% weighted`;
    let y = drawHeader(ctx, S, 'jewelcase 100', `${topPct}% of my top ${gridSize}\nis ${topGenre}`, subtitle);

    // Donut chart
    const cx = pad + px(S * 0.22);
    const cy = y + px(S * 0.21);
    const outerR = px(S * 0.19);
    const innerR = px(S * 0.11);
    let angle = -Math.PI / 2;
    genres.forEach((g) => {
      const share = (rawCount[g] ?? 0) / n;
      const sweep = share * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = genreColor(g);
      ctx.fill();
      angle += sweep;
    });
    // inner hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = BG;
    ctx.fill();
    // center label
    ctx.font = `bold ${px(S * 0.07)}px Arial Black, sans-serif`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.fillText(String(n), cx, cy + px(S * 0.025));
    ctx.font = `${px(S * 0.028)}px monospace`;
    ctx.fillStyle = DIM;
    ctx.fillText('albums', cx, cy + px(S * 0.065));
    ctx.textAlign = 'left';

    // Legend table
    const legendX = cx + outerR + px(S * 0.055);
    const colShare = S - pad - px(S * 0.12);
    const colWtd = S - pad;
    ctx.font = `${px(S * 0.024)}px monospace`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.fillText('share', colShare, y + px(S * 0.03));
    ctx.fillStyle = LIME;
    ctx.fillText('wtd', colWtd, y + px(S * 0.03));
    ctx.textAlign = 'left';

    const rowH = px(S * 0.072);
    genres.forEach((g, i) => {
      const ry = y + px(S * 0.07) + i * rowH;
      // color swatch
      ctx.fillStyle = genreColor(g);
      ctx.fillRect(legendX, ry - px(S * 0.035), px(S * 0.034), px(S * 0.034));
      // label
      ctx.font = `${px(S * 0.042)}px Arial, sans-serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText(g, legendX + px(S * 0.048), ry);
      // share %
      ctx.font = `${px(S * 0.038)}px monospace`;
      ctx.fillStyle = DIM;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round((rawCount[g] ?? 0) / n * 100)}%`, colShare, ry);
      // weighted %
      ctx.fillStyle = LIME;
      ctx.fillText(`${Math.round((wtdScore[g] ?? 0) / totalPts * 100)}%`, colWtd, ry);
      ctx.textAlign = 'left';
    });

    // footer
    ctx.font = `italic ${px(S * 0.028)}px Georgia, serif`;
    ctx.fillStyle = DIM;
    ctx.fillText(`weighted = rank-weighted share (top ranks count more).`, pad, S - pad);
  }, [albums, gridOrder, gridSize]);

  useEffect(() => { draw(); }, [draw]);
  return canvasRef;
}

// ── Era card ──────────────────────────────────────────────────────────────────

const ERA_LABELS = ['kid', 'teens', '20s', '30s', '40s', '50s', '60s', '70s'];

function getEra(releaseYear: number, birthYear: number): string {
  // Albums before birth count as "kid" — you discovered them growing up
  const age = Math.max(0, releaseYear - birthYear);
  const idx = Math.min(Math.floor(age / 10), ERA_LABELS.length - 1);
  return ERA_LABELS[idx];
}

function getDynamicEras(birthYear: number, rawCount: Record<string, number>): string[] {
  const currentAge = new Date().getFullYear() - birthYear;
  const maxIdx = Math.floor(currentAge / 10);
  const lived = ERA_LABELS.slice(0, maxIdx + 1);
  // Trim empty eras from both ends only — keep middle gaps to preserve continuity
  const first = lived.findIndex((e) => (rawCount[e] ?? 0) > 0);
  const last = lived.findLastIndex((e) => (rawCount[e] ?? 0) > 0);
  if (first === -1) return lived; // no data yet, show all lived eras
  return lived.slice(first, last + 1);
}

function useEraCanvas(albums: ReturnType<typeof useCollage>['state']['tray'], gridOrder: string[], gridSize: number, birthYear: number | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || albums.length === 0 || !birthYear) return;
    const S = 1080;
    const ctx = setupCanvas(canvas, S);
    const pad = px(S * 0.065);

    const albumMap = new Map(albums.map((a) => [a.id, a]));
    const orderedIds = [
      ...gridOrder.filter((id) => albumMap.has(id)),
      ...albums.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
    ].slice(0, gridSize);

    const rawCount: Record<string, number> = {};
    const wtdScore: Record<string, number> = {};
    let usable = 0;

    orderedIds.forEach((id, i) => {
      const a = albumMap.get(id);
      if (!a?.releaseYear) return;
      const era = getEra(a.releaseYear, birthYear);
      const pts = gridSize + 1 - (i + 1);
      rawCount[era] = (rawCount[era] ?? 0) + 1;
      wtdScore[era] = (wtdScore[era] ?? 0) + pts;
      usable++;
    });

    const ERAS = getDynamicEras(birthYear, rawCount);

    if (usable === 0) return;
    const totalPts = Object.values(wtdScore).reduce((s, v) => s + v, 0);

    // Find peak era by weighted score
    const peakEra = ERAS.reduce((best, e) => (wtdScore[e] ?? 0) > (wtdScore[best] ?? 0) ? e : best, ERAS[0]);
    const peakWtdPct = Math.round((wtdScore[peakEra] ?? 0) / totalPts * 100);

    const subtitle = `${peakWtdPct}% of my weighted score is ${peakEra}-era`;
    let y = drawHeader(ctx, S, 'jewelcase 100', `balanced by count —\nbut my peaks are ${peakEra}`, subtitle);

    y += px(S * 0.03);
    const barAreaX = pad + px(S * 0.18);
    const barMaxW = S - barAreaX - pad - px(S * 0.12);
    const legendH = px(S * 0.11); // space reserved at bottom for legend lines
    const availableH = S - y - legendH;
    const rowH = Math.max(px(S * 0.075), Math.floor(availableH / ERAS.length));
    // bar height scales with row height but caps at a comfortable size
    const barH = Math.min(px(S * 0.055), Math.floor(rowH * 0.42));
    // font size for era labels also scales down if rows are tight
    const eraFontSize = rowH < px(S * 0.1) ? px(S * 0.042) : px(S * 0.052);

    ERAS.forEach((era, i) => {
      const ry = y + i * rowH;
      const rawPct = Math.round((rawCount[era] ?? 0) / usable * 100);
      const wtdPct = Math.round((wtdScore[era] ?? 0) / totalPts * 100);
      const barW = px((rawPct / 100) * barMaxW);
      const wtdX = barAreaX + px((wtdPct / 100) * barMaxW);
      const isPeak = era === peakEra;

      // era label
      ctx.font = `bold ${eraFontSize}px Arial Black, sans-serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText(era, pad, ry + barH - px(S * 0.005));

      // bar track
      ctx.fillStyle = 'rgba(240,232,208,0.08)';
      ctx.fillRect(barAreaX, ry, barMaxW, barH);

      // filled bar
      ctx.fillStyle = isPeak ? PINK : CYAN;
      ctx.fillRect(barAreaX, ry, barW, barH);

      // weighted marker line
      ctx.strokeStyle = LIME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wtdX, ry - px(S * 0.008));
      ctx.lineTo(wtdX, ry + barH + px(S * 0.008));
      ctx.stroke();

      // weighted % label above line
      ctx.font = `bold ${px(S * 0.033)}px monospace`;
      ctx.fillStyle = LIME;
      ctx.textAlign = 'center';
      ctx.fillText(`${wtdPct}%`, wtdX, ry - px(S * 0.015));
      ctx.textAlign = 'left';

      // raw % right edge
      ctx.font = `${px(S * 0.038)}px monospace`;
      ctx.fillStyle = DIM;
      ctx.textAlign = 'right';
      ctx.fillText(`${rawPct}%`, S - pad, ry + barH - px(S * 0.005));
      ctx.textAlign = 'left';
    });

    // Legend
    const legY = S - pad - px(S * 0.04);
    ctx.font = `bold ${px(S * 0.026)}px monospace`;
    ctx.fillStyle = LIME;
    ctx.fillText('lime = weighted by rank (top 10 count most)', pad, legY);
    ctx.font = `italic ${px(S * 0.026)}px Georgia, serif`;
    ctx.fillStyle = DIM;
    ctx.fillText(`bar = even count split · birth year: ${birthYear}`, pad, legY + px(S * 0.038));
  }, [albums, gridOrder, gridSize, birthYear]);

  useEffect(() => { draw(); }, [draw]);
  return canvasRef;
}

// ── Main component ────────────────────────────────────────────────────────────

const CANVAS_PREVIEW_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: 420,
  height: 'auto',
  aspectRatio: '1 / 1',
  borderRadius: 4,
  boxShadow: '3px 5px 16px rgba(0,0,0,0.35)',
};

interface CardProps {
  label: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  filename: string;
  note?: string;
}

function StatCard({ label, canvasRef, filename, note }: CardProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[10px]" style={{ color: 'var(--denim)' }}>{label}</span>
        <button
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, filename)}
          className="btn-bevel"
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          save image
        </button>
      </div>
      <canvas ref={canvasRef} style={CANVAS_PREVIEW_STYLE} />
      {note && <p className="text-xs italic" style={{ color: 'rgba(23,21,20,0.45)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>{note}</p>}
    </div>
  );
}

export default function StatsScreen() {
  const { state, dispatch } = useCollage();
  const { tray, gridSize, gridOrder } = state;
  const [birthYearInput, setBirthYearInput] = useState('');
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);

  const albumMap = new Map(tray.map((a) => [a.id, a]));
  const orderedIds = [
    ...gridOrder.filter((id) => albumMap.has(id)),
    ...tray.map((a) => a.id).filter((id) => !gridOrder.includes(id)),
  ].slice(0, gridSize);

  // Enrich albums missing releaseYear/genre by looking them up from iTunes
  useEffect(() => {
    const missing = tray.filter((a) => !a.releaseYear || !a.genre);
    if (missing.length === 0) return;
    setEnriching(true);
    let cancelled = false;

    (async () => {
      for (const album of missing) {
        if (cancelled) break;
        try {
          // For iTunes albums, look up directly by collection ID
          const isItunes = album.source === 'itunes' && !album.id.startsWith('mb-');
          let url = isItunes
            ? `https://itunes.apple.com/lookup?id=${album.id}&entity=album`
            : `https://itunes.apple.com/search?term=${encodeURIComponent(`${album.title} ${album.artist}`)}&media=music&entity=album&attribute=albumTerm&limit=5`;
          const res = await fetch(`/api/itunes-meta?url=${encodeURIComponent(url)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const items = data.results ?? [];
          const item = isItunes
            ? items.find((r: Record<string, unknown>) => r.wrapperType === 'collection' || r.collectionType === 'Album')
            : items.find((r: Record<string, unknown>) => {
                const t = (r.collectionName as string ?? '').toLowerCase();
                const a = (r.artistName as string ?? '').toLowerCase();
                return t.includes(album.title.toLowerCase().slice(0, 8)) && a.includes(album.artist.toLowerCase().slice(0, 5));
              });
          if (!item) continue;
          const releaseDate = item.releaseDate as string | undefined;
          const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
          const rawGenre = item.primaryGenreName as string | undefined;
          if (releaseYear && rawGenre) {
            dispatch({ type: 'UPDATE_ALBUM_META', id: album.id, releaseYear, genre: normalizeGenre(rawGenre) });
          }
        } catch { /* skip */ }
      }
      if (!cancelled) setEnriching(false);
    })();

    return () => { cancelled = true; };
  }, []); // run once on mount

  const artistRef = useArtistCanvas(tray, gridOrder, gridSize);
  const genreRef = useGenreCanvas(tray, gridOrder, gridSize);
  const eraRef = useEraCanvas(tray, gridOrder, gridSize, birthYear);

  const albumsWithYear = orderedIds.filter((id) => albumMap.get(id)?.releaseYear).length;
  const albumsWithGenre = orderedIds.filter((id) => albumMap.get(id)?.genre && albumMap.get(id)?.genre !== 'other').length;

  function handleBirthYear(val: string) {
    setBirthYearInput(val);
    const y = parseInt(val, 10);
    if (y >= 1920 && y <= 2015) setBirthYear(y);
    else setBirthYear(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="font-bold text-sm mb-1" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: '#171514' }}>
          your stats
        </div>
        <div className="text-xs" style={{ color: 'rgba(23,21,20,0.5)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
          shareable square cards based on your ranked list.
        </div>
      </div>

      <StatCard
        label="artist leaderboard"
        canvasRef={artistRef}
        filename="jewelcase100-artists.png"
      />

      <StatCard
        label="genre breakdown"
        canvasRef={genreRef}
        filename="jewelcase100-genres.png"
        note={enriching ? `looking up genre data… ${albumsWithGenre}/${orderedIds.length} ready` : albumsWithGenre < orderedIds.length * 0.7 ? `genre data loading — ${albumsWithGenre}/${orderedIds.length} ready` : undefined}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[10px]" style={{ color: 'var(--denim)' }}>era breakdown</span>
          <button
            onClick={() => eraRef.current && downloadCanvas(eraRef.current, 'jewelcase100-eras.png')}
            className="btn-bevel"
            style={{ fontSize: 11, padding: '3px 10px', ...(!birthYear ? { opacity: 0.35, cursor: 'not-allowed' } : {}) }}
            disabled={!birthYear}
          >
            save image
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs flex-shrink-0" style={{ fontFamily: 'Verdana, Tahoma, sans-serif', color: 'rgba(23,21,20,0.6)' }}>
            birth year:
          </label>
          <input
            type="number"
            min={1920}
            max={2015}
            placeholder="e.g. 1990"
            value={birthYearInput}
            onChange={(e) => handleBirthYear(e.target.value)}
            className="text-xs px-2 py-1 rounded border w-24"
            style={{ fontFamily: 'Verdana, Tahoma, sans-serif', borderColor: 'rgba(23,21,20,0.2)', background: 'transparent', color: '#171514' }}
          />
        </div>
        {!birthYear && (
          <div className="text-xs italic" style={{ color: 'rgba(23,21,20,0.4)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            enter your birth year to see how your taste breaks down by life stage.
          </div>
        )}
        {birthYear && enriching && (
          <div className="text-xs italic" style={{ color: 'rgba(23,21,20,0.4)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            looking up release years… {albumsWithYear}/{orderedIds.length} ready
          </div>
        )}
        <canvas ref={eraRef} style={{ ...CANVAS_PREVIEW_STYLE, opacity: birthYear ? 1 : 0.3 }} />
      </div>
    </div>
  );
}
