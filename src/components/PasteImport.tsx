'use client';

import { useState } from 'react';
import { useCollage } from '@/store/collageStore';
import { Album } from '@/types/album';
import CoverImage from '@/components/CoverImage';

interface ParsedLine {
  artist: string;
  title: string;
  raw: string;
}

function parseLine(line: string): ParsedLine | null {
  let s = line.trim().replace(/^\d+[\.\)]\s*/, '').trim();
  if (!s) return null;
  const dashMatch = s.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (dashMatch) return { artist: dashMatch[1].trim(), title: dashMatch[2].trim(), raw: line.trim() };
  const byMatch = s.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) return { artist: byMatch[2].trim(), title: byMatch[1].trim(), raw: line.trim() };
  return { artist: '', title: s, raw: line.trim() };
}

type MatchStatus = 'pending' | 'found' | 'notfound' | 'added';

interface RowResult {
  parsed: ParsedLine;
  status: MatchStatus;
  match?: Album;
  candidates?: Album[];
}

export default function PasteImport() {
  const { state, dispatch } = useCollage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<RowResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  async function handleImport() {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map(parseLine).filter(Boolean) as ParsedLine[];
    if (!parsed.length) return;

    setPickerIdx(null);
    setRunning(true);
    setDone(false);

    const results: RowResult[] = parsed.map((p) => ({ parsed: p, status: 'pending' as MatchStatus }));
    setRows([...results]);

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      try {
        const params = new URLSearchParams({ title: p.title });
        if (p.artist) params.set('artist', p.artist);
        const res = await fetch(`/api/import-match?${params}`);
        const data = await res.json();
        const match: Album | undefined = data.match ?? undefined;
        const candidates: Album[] = data.candidates ?? [];

        if (match) {
          const alreadyInTray = state.tray.some((a) => a.id === match.id);
          results[i] = { parsed: p, status: alreadyInTray ? 'added' : 'found', match, candidates };
          if (!alreadyInTray) dispatch({ type: 'ADD_ALBUM', album: match });
        } else {
          results[i] = { parsed: p, status: 'notfound', candidates };
        }
      } catch {
        results[i] = { parsed: p, status: 'notfound' };
      }
      setRows([...results]);
    }

    setRunning(false);
    setDone(true);
  }

  function swapMatch(rowIdx: number, newAlbum: Album) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      // Remove old match from tray if it was added by import
      if (row.match) dispatch({ type: 'REMOVE_ALBUM', id: row.match.id });
      // Add new match
      const alreadyInTray = state.tray.some((a) => a.id === newAlbum.id);
      if (!alreadyInTray) dispatch({ type: 'ADD_ALBUM', album: newAlbum });
      next[rowIdx] = { ...row, match: newAlbum, status: 'found' };
      return next;
    });
    setPickerIdx(null);
  }

  function reset() {
    setText('');
    setRows([]);
    setDone(false);
    setPickerIdx(null);
  }

  return (
    <div className="w-full">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs"
          style={{ color: 'rgba(58,74,107,0.6)', fontFamily: 'Verdana, Tahoma, sans-serif', fontSize: 11 }}
        >
          {open ? '▾ ' : '▸ '}paste a list instead
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'rgba(23,21,20,0.55)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
            paste any ranked list — one album per line. works with most formats:
            <br />
            <span className="font-mono" style={{ fontSize: 11 }}>
              1. Artist – Album &nbsp;·&nbsp; Artist - Album &nbsp;·&nbsp; Album by Artist
            </span>
          </p>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setRows([]); setDone(false); }}
            placeholder={"1. Charli xcx – Brat\n2. Vampire Weekend – Vampire Weekend\n3. Belle and Sebastian – The Life Pursuit"}
            rows={6}
            className="w-full text-xs resize-y focus:outline-none"
            style={{
              background: '#fff8ee',
              border: '1px solid rgba(23,21,20,0.2)',
              borderRadius: 3,
              padding: '8px 10px',
              fontFamily: '"Courier New", Courier, monospace',
              color: '#171514',
            }}
          />

          <div className="flex gap-2 items-center">
            <button
              onClick={handleImport}
              disabled={running || !text.trim()}
              className="btn-bevel"
              style={running || !text.trim() ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {running ? 'importing…' : 'import list'}
            </button>
            {(rows.length > 0 || done) && (
              <button onClick={reset} className="text-xs underline" style={{ color: 'rgba(23,21,20,0.45)', fontFamily: 'Verdana, Tahoma, sans-serif' }}>
                clear
              </button>
            )}
          </div>

          {rows.length > 0 && (
            <div className="flex flex-col text-xs" style={{ fontFamily: 'Verdana, Tahoma, sans-serif' }}>
              {rows.map((row, i) => (
                <div key={i} style={{ borderBottom: '1px solid rgba(23,21,20,0.07)' }}>
                  {/* Main row */}
                  <div className="flex items-center gap-2 py-1.5">
                    {/* Status icon */}
                    <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>
                      {row.status === 'pending'  && <span style={{ color: 'rgba(23,21,20,0.3)' }}>…</span>}
                      {row.status === 'found'    && <span style={{ color: '#5a8500' }}>✓</span>}
                      {row.status === 'added'    && <span style={{ color: '#3a4a6b' }}>✓</span>}
                      {row.status === 'notfound' && <span style={{ color: '#d12b2b' }}>?</span>}
                    </span>

                    {/* Input text */}
                    <span className="flex-1 truncate" style={{ color: 'rgba(23,21,20,0.55)' }}>
                      {row.parsed.raw}
                    </span>

                    {/* Matched album thumbnail — tap to open picker */}
                    {(row.status === 'found' || row.status === 'added') && row.match && (
                      <button
                        onClick={() => setPickerIdx(pickerIdx === i ? null : i)}
                        title="tap to change"
                        className="flex items-center gap-1.5 flex-shrink-0"
                        style={{ color: '#3a4a6b', maxWidth: 160 }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 2, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                          <CoverImage src={row.match.coverUrl} alt={row.match.title} width={28} height={28} className="object-cover" artist={row.match.artist} title={row.match.title} />
                        </div>
                        <span className="truncate text-xs" style={{ maxWidth: 100 }}>
                          {row.match.artist} – {row.match.title}
                        </span>
                        <span style={{ fontSize: 9, opacity: 0.5 }}>✎</span>
                      </button>
                    )}

                    {/* Not found — show picker trigger if we have candidates */}
                    {row.status === 'notfound' && (
                      <span style={{ color: '#d12b2b', flexShrink: 0 }}>
                        {row.candidates?.length
                          ? <button onClick={() => setPickerIdx(pickerIdx === i ? null : i)} style={{ color: '#d12b2b', textDecoration: 'underline' }}>pick one?</button>
                          : 'not found'
                        }
                      </span>
                    )}
                  </div>

                  {/* Inline picker */}
                  {pickerIdx === i && (row.candidates?.length ?? 0) > 0 && (
                    <div className="pb-2 pl-4">
                      <div className="text-xs mb-1.5" style={{ color: 'rgba(23,21,20,0.4)' }}>pick the right one:</div>
                      <div className="flex gap-2 flex-wrap">
                        {row.candidates!.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => swapMatch(i, c)}
                            title={`${c.artist} – ${c.title} (${c.year})`}
                            className="flex flex-col items-center gap-1 group"
                            style={{ width: 56 }}
                          >
                            <div style={{ width: 56, height: 56, borderRadius: 2, overflow: 'hidden', boxShadow: '1px 2px 5px rgba(0,0,0,0.3)', border: row.match?.id === c.id ? '2px solid #3a4a6b' : '2px solid transparent' }}>
                              <CoverImage src={c.coverUrl} alt={c.title} width={56} height={56} className="object-cover" artist={c.artist} title={c.title} />
                            </div>
                            <span className="text-xs leading-tight text-center w-full truncate" style={{ color: '#171514', fontSize: 10 }}>{c.title}</span>
                            <span className="truncate w-full text-center" style={{ color: 'rgba(23,21,20,0.45)', fontSize: 9 }}>{c.artist}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {done && (
                <div className="pt-2 font-bold" style={{ color: '#3a4a6b' }}>
                  {rows.filter((r) => r.status === 'found').length} added ·{' '}
                  {rows.filter((r) => r.status === 'notfound').length} not found
                  {rows.some(r => r.status === 'found' || r.status === 'notfound') && (
                    <span className="font-normal ml-2" style={{ color: 'rgba(23,21,20,0.4)', fontSize: 10 }}>tap any album to swap it</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
