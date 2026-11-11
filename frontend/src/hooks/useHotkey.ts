import { useEffect, useEffectEvent } from 'react';
import { isEditableTarget, isMac } from '@/lib/browser';

/**
 * Keyboard shortcuts.
 *
 * Combos: "mod+k" (⌘ on Apple, Ctrl elsewhere), "mod+enter", "shift+?", "/",
 * "escape", and two-key sequences such as "g d" (press g, then d).
 */

let lastKey: { key: string; at: number } = { key: '', at: 0 };
let previousKey: { key: string; at: number } = { key: '', at: 0 };

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.repeat) return;
      previousKey = lastKey;
      lastKey = { key: event.key.toLowerCase(), at: event.timeStamp };
    },
    { capture: true },
  );
}

const SEQUENCE_WINDOW_MS = 1_200;

export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const normalized = combo.toLowerCase().trim();

  if (normalized.includes(' ')) {
    const [first, second] = normalized.split(/\s+/);
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    return (
      event.key.toLowerCase() === second &&
      previousKey.key === first &&
      event.timeStamp - previousKey.at < SEQUENCE_WINDOW_MS
    );
  }

  const parts = normalized.split('+');
  const key = parts.pop() ?? '';
  const wantsMod = parts.includes('mod');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt');
  const modPressed = isMac ? event.metaKey : event.ctrlKey;

  if (wantsMod !== modPressed || wantsAlt !== event.altKey) return false;
  // Shift is part of typing "?" itself, so it only matters for letters and named keys.
  if (/^([a-z0-9]|enter|escape|arrow\w+)$/.test(key) && wantsShift !== event.shiftKey) return false;

  const pressed = event.key.toLowerCase();
  return pressed === key || (key === 'esc' && pressed === 'escape');
}

interface HotkeyOptions {
  enabled?: boolean;
  /** Fire even while typing in an input (for mod-combos such as ⌘S / ⌘↵). */
  allowInInputs?: boolean;
  /** Keep the browser's default action (default: prevented). */
  keepDefault?: boolean;
}

export function useHotkey(
  combos: string | string[],
  handler: (event: KeyboardEvent) => void,
  { enabled = true, allowInInputs = false, keepDefault = false }: HotkeyOptions = {},
) {
  const list = Array.isArray(combos) ? combos : [combos];
  const key = list.join('|');

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented && !keepDefault) return;
    if (!allowInInputs && isEditableTarget(event.target)) return;
    if (!key.split('|').some((combo) => matchesCombo(event, combo))) return;
    if (!keepDefault) event.preventDefault();
    handler(event);
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled, key]);
}
