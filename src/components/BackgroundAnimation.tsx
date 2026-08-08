'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  opacityDir: number;
  type: 'star4' | 'star5' | 'note' | 'sparkle';
  rotation: number;
  rotSpeed: number;
  color: string;
}

const COLORS = ['#d12b2b', '#3a4a6b', '#c9a36a', '#a8854d', '#f5e642', '#9ad500', '#fff8e8'];
const NOTE_CHARS = ['♪', '♫', '♩', '♬'];

function drawStar4(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? size : size * 0.4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStar5(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.38;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export default function BackgroundAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn initial particles
    const count = Math.min(55, Math.floor((window.innerWidth * window.innerHeight) / 14000));
    particles.current = Array.from({ length: count }, () => spawn(canvas.width, canvas.height, true));

    let last = 0;
    function frame(ts: number) {
      const dt = Math.min(ts - last, 32); // cap at ~30fps equivalent
      last = ts;
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.current.length; i++) {
        const p = particles.current[i];
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.rotation += p.rotSpeed * dt * 0.06;
        p.opacity += p.opacityDir * dt * 0.003;

        if (p.opacity >= 0.75) { p.opacity = 0.75; p.opacityDir = -1; }
        if (p.opacity <= 0.05) { p.opacity = 0.05; p.opacityDir = 1; }

        // Respawn if off-screen
        if (p.y < -60 || p.y > canvas.height + 60 || p.x < -60 || p.x > canvas.width + 60) {
          particles.current[i] = spawn(canvas.width, canvas.height, false);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'star4') {
          drawStar4(ctx, 0, 0, p.size);
        } else if (p.type === 'star5') {
          drawStar5(ctx, 0, 0, p.size);
        } else if (p.type === 'sparkle') {
          // cross sparkle
          ctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 2);
          ctx.fillRect(-p.size, -p.size * 0.15, p.size * 2, p.size * 0.3);
        } else {
          // music note
          ctx.font = `${p.size * 2.2}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(NOTE_CHARS[Math.floor(Math.abs(Math.sin(p.rotation)) * NOTE_CHARS.length)], 0, 0);
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

function spawn(w: number, h: number, anywhere: boolean): Particle {
  const types: Particle['type'][] = ['star4', 'star4', 'star5', 'star5', 'sparkle', 'sparkle', 'note'];
  const type = types[Math.floor(Math.random() * types.length)];
  const x = anywhere ? Math.random() * w : (Math.random() < 0.5 ? -30 : w + 30);
  const y = anywhere ? Math.random() * h : Math.random() * h;
  const speed = 0.08 + Math.random() * 0.22;
  const angle = Math.random() * Math.PI * 2;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.05, // slight upward drift
    size: type === 'note' ? 5 + Math.random() * 6 : 3 + Math.random() * 9,
    opacity: Math.random() * 0.5 + 0.05,
    opacityDir: Math.random() < 0.5 ? 1 : -1,
    type,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}
