import { useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import gsap from 'gsap';
import { useTheme } from '../contexts/ThemeContext';

interface GlassCardProps {
  children: ReactNode;
  glowColor?: string;
  className?: string;
  style?: CSSProperties;
  hoverable?: boolean;
  [key: string]: any;
}

export default function GlassCard({
  children,
  glowColor = '#1677ff',
  className,
  style,
  hoverable = true,
  ...rest
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !hoverable) return;

    el.style.transformStyle = 'preserve-3d';
    el.style.willChange = 'transform';

    const handleMouse = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      gsap.to(el, {
        rotationY: (x - 0.5) * 12,
        rotationX: -(y - 0.5) * 12,
        transformPerspective: 800,
        duration: 0.3,
        ease: 'power2.out',
      });

      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${glowColor}22, transparent 60%)`;
      }
    };

    const handleLeave = () => {
      gsap.to(el, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
      });
      if (glowRef.current) {
        glowRef.current.style.background = 'transparent';
      }
    };

    el.addEventListener('mousemove', handleMouse);
    el.addEventListener('mouseleave', handleLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouse);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [hoverable, glowColor]);

  const glassStyle: CSSProperties = {
    background: isDark ? 'rgba(26, 26, 26, 0.65)' : 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)'}`,
    boxShadow: isDark
      ? '0 8px 32px rgba(0, 0, 0, 0.3)'
      : '0 8px 32px rgba(0, 0, 0, 0.08)',
    transition: 'box-shadow 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  const glowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    transition: 'background 0.15s ease',
  };

  return (
    <div
      ref={cardRef}
      data-glass-card="1"
      className={className}
      style={glassStyle}
      onMouseEnter={() => {
        if (cardRef.current) {
          cardRef.current.style.boxShadow = isDark
            ? `0 8px 32px ${glowColor}33, 0 4px 16px rgba(0,0,0,0.3)`
            : `0 8px 32px ${glowColor}22, 0 4px 16px rgba(0,0,0,0.06)`;
        }
      }}
      onMouseLeave={() => {
        if (cardRef.current) {
          cardRef.current.style.boxShadow = isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.3)'
            : '0 8px 32px rgba(0, 0, 0, 0.08)';
        }
      }}
      {...rest}
    >
      <div ref={glowRef} style={glowStyle} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
