import { useRef, useState, type ReactNode, type CSSProperties } from 'react';
import gsap from 'gsap';

interface TiltCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** 是否启用旋转光晕边框，默认 true */
  glowBorder?: boolean;
  /** 是否启用金属光泽扫过，默认 true */
  sheen?: boolean;
}

export default function TiltCard({ children, style, className, glowBorder = true, sheen = true }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    const glow = glowRef.current;
    if (!el || !glow) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xRatio = x / rect.width - 0.5;
    const yRatio = y / rect.height - 0.5;

    gsap.to(el, {
      rotationY: xRatio * 12,
      rotationX: -yRatio * 12,
      transformPerspective: 600,
      duration: 0.3,
      ease: 'power2.out',
    });

    gsap.set(glow, {
      background: `radial-gradient(300px circle at ${x}px ${y}px, rgba(255,255,255,0.18), transparent 70%)`,
    });
  };

  const handleMouseEnter = () => {
    setHovered(true);
    const el = cardRef.current;
    if (!el) return;
    gsap.to(el, {
      boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2)',
      scale: 1.02,
      duration: 0.3,
      ease: 'power2.out',
    });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    const el = cardRef.current;
    const glow = glowRef.current;
    if (!el || !glow) return;

    gsap.to(el, {
      rotationY: 0,
      rotationX: 0,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.5)',
    });
    gsap.set(glow, { background: 'transparent' });
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card ${className || ''}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.3s',
        ...style,
      }}
    >
      {/* 旋转光晕边框 */}
      {glowBorder && (
        <div
          className={`tilt-border ${hovered ? 'tilt-border-active' : ''}`}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 14,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 金属光泽扫过 */}
      {sheen && hovered && <div className="tilt-sheen" />}

      {/* 鼠标跟随光晕 */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          pointerEvents: 'none',
          borderRadius: 12,
        }}
      />

      {/* 内容 */}
      <div style={{ position: 'relative', zIndex: 2, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
