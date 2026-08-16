import { useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  phase: number;
  color: string;
}

const LIGHT_COLORS = [
  'rgba(22, 119, 255, 0.08)',
  'rgba(114, 46, 209, 0.06)',
  'rgba(82, 196, 26, 0.05)',
  'rgba(250, 173, 20, 0.05)',
];

const DARK_COLORS = [
  'rgba(64, 150, 255, 0.06)',
  'rgba(179, 127, 235, 0.05)',
  'rgba(115, 209, 61, 0.04)',
  'rgba(255, 197, 61, 0.04)',
];

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth < 680;
    const count = isMobile ? 20 : 45;
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

    function resize() {
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = window.innerWidth + 'px';
      canvas!.style.height = window.innerHeight + 'px';
      ctx!.scale(dpr, dpr);
    }
    resize();

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
      });
    }

    let rafId: number;
    function draw(ts: number) {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) p.y = 0;

        const osc = Math.sin(ts * 0.001 + p.phase) * 0.3 + 0.7;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.opacity * osc;
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      aria-hidden="true"
    />
  );
}
