import { m } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { CommandPalette } from '@/components/command/CommandPalette';
import { ShortcutsDialog } from '@/components/command/ShortcutsDialog';
import { ParticleField } from '@/components/effects/ParticleField';
import { NavigationProgress } from '@/components/feedback/NavigationProgress';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Topbar } from '@/components/navigation/Topbar';
import { ALL_NAV_ITEMS, canAccess } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { matchesCombo, useHotkey } from '@/hooks/useHotkey';
import { useEffectsPreference } from '@/hooks/useSettings';

const NAV_SHORTCUTS = ALL_NAV_ITEMS.filter((item) => item.shortcut);

/** Application shell: sidebar rail (drawer on mobile), sticky header, routed content, global shortcuts. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reducedMotion, effects3d } = useEffectsPreference();

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useHotkey('mod+k', () => setPaletteOpen((open) => !open), { allowInInputs: true });
  useHotkey('?', () => setShortcutsOpen(true));
  useHotkey(
    NAV_SHORTCUTS.map((item) => item.shortcut!),
    (event) => {
      const item = NAV_SHORTCUTS.find((candidate) => matchesCombo(event, candidate.shortcut!));
      if (item && canAccess(item.access, user)) void navigate(item.to);
    },
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        Skip to content
      </a>
      {effects3d ? <ParticleField reducedMotion={reducedMotion} /> : null}
      <NavigationProgress />
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <div className="flex min-w-0 flex-col">
        <Topbar
          onOpenMenu={() => setMenuOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={openShortcuts}
        />
        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-16 outline-none sm:px-6 lg:px-10">
          <m.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </m.div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} onOpenShortcuts={openShortcuts} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
