import { useEffect, useRef } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useEffectsPreference } from '@/hooks/useSettings';

const INTERACTIVE =
  'a, button, summary, label, select, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], [role="radio"], input[type="checkbox"], input[type="radio"], canvas';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]';

function CursorRing() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ring.current;
    if (!element) return;
    const target = { x: -100, y: -100, scale: 1, opacity: 0 };
    const current = { ...target };
    let pressed = false;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      target.x = event.clientX;
      target.y = event.clientY;
      const node = event.target instanceof Element ? event.target : null;
      // The native cursor always stays; over text fields the ring steps aside for the I-beam.
      if (node?.closest(TEXT)) {
        target.scale = 0.4;
        target.opacity = 0;
      } else if (node?.closest(INTERACTIVE)) {
        target.scale = 1.65;
        target.opacity = 1;
      } else {
        target.scale = 1;
        target.opacity = 0.75;
      }
    };
    const onDown = () => (pressed = true);
    const onUp = () => (pressed = false);
    const onLeave = () => (target.opacity = 0);

    const tick = () => {
      current.x += (target.x - current.x) * 0.24;
      current.y += (target.y - current.y) * 0.24;
      current.scale += ((pressed ? target.scale * 0.8 : target.scale) - current.scale) * 0.2;
      current.opacity += (target.opacity - current.opacity) * 0.2;
      element.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%) scale(${current.scale})`;
      element.style.opacity = String(current.opacity);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ring}
      className="pointer-events-none fixed top-0 left-0 z-[200] size-7 rounded-full border border-accent/70 bg-accent/[0.06] opacity-0 shadow-[0_0_18px_-4px_var(--accent)]"
      aria-hidden
    />
  );
}

/** A soft ring that trails the mouse and swells over anything clickable (mouse only, never with reduced motion). */
export function CustomCursor() {
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const { reducedMotion, effects3d } = useEffectsPreference();
  if (!finePointer || reducedMotion || !effects3d) return null;
  return <CursorRing />;
}
