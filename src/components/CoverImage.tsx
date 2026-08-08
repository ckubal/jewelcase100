'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  // Used to fetch a fallback from iTunes if primary src 404s
  artist?: string;
  title?: string;
}

export default function CoverImage({ src, alt, width, height, fill, className, style, artist, title }: Props) {
  const [current, setCurrent] = useState(src);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleError() {
    if (tried) { setFailed(true); return; }
    setTried(true);

    // Try iTunes search as fallback
    if (artist || title) {
      try {
        const q = [artist, title].filter(Boolean).join(' ');
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=3`);
        const data = await res.json();
        const match = (data.results ?? []).find((a: { title: string; artist: string; coverUrl: string }) =>
          (!title || a.title.toLowerCase().includes(title.toLowerCase())) &&
          (!artist || a.artist.toLowerCase().includes(artist.toLowerCase()))
        ) ?? data.results?.[0];
        if (match?.coverUrl && match.coverUrl !== src) {
          setCurrent(match.coverUrl);
          return;
        }
      } catch { /* fall through */ }
    }

    setFailed(true);
  }

  if (failed) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: 'linear-gradient(135deg, #a8854d 0%, #c9a36a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...(fill ? { position: 'absolute', inset: 0 } : { width, height }),
        }}
      >
        <span style={{ fontSize: fill ? 22 : Math.min((width ?? 40) / 2.5, 18), opacity: 0.5 }}>♪</span>
      </div>
    );
  }

  const imgProps = {
    src: current,
    alt,
    className,
    style,
    unoptimized: true as const,
    onError: handleError,
  };

  return fill
    ? <Image {...imgProps} fill />
    : <Image {...imgProps} width={width!} height={height!} />;
}
