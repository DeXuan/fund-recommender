import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';

/**
 * Non-invasive GSAP animation enhancer.
 * Re-runs on route changes. Uses MutationObserver to wait for content.
 */
export default function GsapEnhancer() {
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function animate() {
      if (cancelled) return;

      const cards = document.querySelectorAll('.ant-card');
      // If no cards yet, the page is still loading — retry
      if (cards.length === 0) {
        retryTimer = setTimeout(animate, 200);
        return;
      }

      // 1. Stagger reveal for all cards in viewport
      cards.forEach((card, i) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              gsap.from(entry.target, {
                opacity: 0,
                y: 24,
                duration: 0.5,
                delay: i * 0.06,
                ease: 'power2.out',
              });
              observer.unobserve(entry.target);
            }
          },
          { threshold: 0.1 }
        );
        observer.observe(card);
      });

      // 2. Hoverable cards: 3D tilt effect
      const hoverCards = document.querySelectorAll('.ant-card-hoverable');
      hoverCards.forEach((card) => {
        const el = card as HTMLElement;
        el.style.transformStyle = 'preserve-3d';
        el.style.willChange = 'transform';

        const handleMouse = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          gsap.to(el, {
            rotationY: x * 8,
            rotationX: -y * 8,
            transformPerspective: 600,
            duration: 0.3,
            ease: 'power2.out',
          });
        };

        const handleLeave = () => {
          gsap.to(el, {
            rotationY: 0,
            rotationX: 0,
            duration: 0.5,
            ease: 'elastic.out(1, 0.5)',
          });
        };

        el.addEventListener('mousemove', handleMouse);
        el.addEventListener('mouseleave', handleLeave);
      });

      // 3. Statistic values: fade-in + slide-up
      const stats = document.querySelectorAll('.ant-statistic-content-value');
      stats.forEach((stat) => {
        gsap.from(stat, {
          opacity: 0,
          y: 10,
          duration: 0.4,
          ease: 'power2.out',
        });
      });
    }

    // Start after a short delay for Suspense to resolve
    retryTimer = setTimeout(animate, 500);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [pathname]);

  return null;
}
