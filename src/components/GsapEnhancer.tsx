import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';

/**
 * Non-invasive GSAP animation enhancer.
 *
 * CSS hides .ant-card and .ant-statistic-content-value by default.
 * IntersectionObserver reveals them with a staggered slide-up as they
 * scroll into view, then marks them with .gsap-revealed so CSS no longer
 * hides them.
 *
 * Handles antd Tabs: inactive tabs use display:none which prevents
 * IntersectionObserver from firing. When a tab becomes active and its
 * cards become visible, we detect this via attribute mutations and
 * re-trigger the reveal animation.
 */
export default function GsapEnhancer() {
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const ioSet = new Set<IntersectionObserver>();
    const cleanups: (() => void)[] = [];

    // Cards that have been animated and are currently visible
    const revealed = new WeakSet<Element>();
    // Cards that were processed but are in hidden tabs (display:none)
    // — need re-animation when their tab becomes active
    const pendingReveal = new WeakSet<Element>();
    let cardCounter = 0;

    function revealCard(card: Element, forceReveal = false) {
      if (revealed.has(card) && !forceReveal) return;
      const index = cardCounter++;

      // If the card is hidden (display:none), defer animation
      if (!isVisible(card)) {
        pendingReveal.add(card);
        return;
      }

      revealed.add(card);
      pendingReveal.delete(card);

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // 轻量动画：只做淡入，不做位移，减少视觉延迟
            gsap.fromTo(entry.target,
              { opacity: 0.6, y: 8 },
              {
                opacity: 1,
                y: 0,
                duration: 0.3,
                delay: Math.min(index * 0.03, 0.3),
                ease: 'power2.out',
                onComplete() {
                  entry.target.classList.add('gsap-revealed');
                  gsap.set(entry.target, { clearProps: 'opacity,transform' });
                },
              }
            );
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(card);
      ioSet.add(observer);
    }

    function revealStat(stat: Element) {
      if (revealed.has(stat) || !isVisible(stat)) return;
      revealed.add(stat);

      gsap.to(stat, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        delay: 0.2,
        ease: 'power2.out',
        onComplete() {
          stat.classList.add('gsap-revealed');
          gsap.set(stat, { clearProps: 'opacity,transform' });
        },
      });
    }

    function setupTilt(card: Element) {
      const el = card as HTMLElement;
      if (el.dataset.tiltBound || el.dataset.glassCard) return;
      el.dataset.tiltBound = '1';
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
      cleanups.push(() => {
        el.removeEventListener('mousemove', handleMouse);
        el.removeEventListener('mouseleave', handleLeave);
      });
    }

    /** Check if an element is visible (not display:none) */
    function isVisible(el: Element): boolean {
      if (el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).display === 'none') {
        return false;
      }
      return true;
    }

    /** Process all cards currently in the DOM */
    function processAll() {
      document.querySelectorAll('.ant-card').forEach((c) => revealCard(c));
      document.querySelectorAll('.ant-card-hoverable').forEach(setupTilt);
      document.querySelectorAll('.ant-statistic-content-value').forEach(revealStat);
    }

    /** Re-trigger animation for cards that just became visible (e.g. tab switch) */
    function processPendingReveals() {
      // Walk pendingReveal WeakSet — WeakSet isn't iterable, so re-scan
      document.querySelectorAll('.ant-card').forEach((card) => {
        if (pendingReveal.has(card) && isVisible(card)) {
          // Reset the "revealed" state so revealCard can run
          revealed.delete(card);
          card.classList.remove('gsap-revealed');
          revealCard(card);
          if (card.classList.contains('ant-card-hoverable')) setupTilt(card);
        }
      });
      document.querySelectorAll('.ant-statistic-content-value').forEach((stat) => {
        if (isVisible(stat) && !stat.classList.contains('gsap-revealed')) {
          revealed.delete(stat);
          revealStat(stat);
        }
      });
    }

    // 1. MutationObserver: catch new cards AND attribute changes (tab switches)
    const mo = new MutationObserver((mutations) => {
      if (cancelled) return;
      let hasAttrChange = false;

      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.classList.contains('ant-card')) {
              revealCard(node);
              if (node.classList.contains('ant-card-hoverable')) setupTilt(node);
            }
            node.querySelectorAll?.('.ant-card').forEach((c) => {
              revealCard(c);
              if (c.classList.contains('ant-card-hoverable')) setupTilt(c);
            });
            if (node.classList.contains('ant-statistic-content-value')) revealStat(node);
            node.querySelectorAll?.('.ant-statistic-content-value').forEach(revealStat);
          }
        }
        // Tab panels change their style attribute when switching tabs
        if (m.type === 'attributes' && m.attributeName === 'style') {
          hasAttrChange = true;
        }
      }

      // If style attributes changed (tab switch), check for pending reveals
      if (hasAttrChange) {
        requestAnimationFrame(() => processPendingReveals());
      }
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    cleanups.push(() => mo.disconnect());

    // 2. Initial processing
    processAll();

    return () => {
      cancelled = true;
      ioSet.forEach((o) => o.disconnect());
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
