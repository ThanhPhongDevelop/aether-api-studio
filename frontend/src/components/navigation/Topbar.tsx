import { Menu, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { useAuth } from '@/hooks/useAuth';
import { MOD_KEY } from '@/lib/browser';
import { ConnectionIndicator } from './ConnectionIndicator';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface TopbarProps {
  onOpenMenu: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}

export function Topbar({ onOpenMenu, onOpenPalette, onOpenShortcuts }: TopbarProps) {
  const { status } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/70 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 size-9 px-0 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <Link to="/" className="rounded-lg lg:hidden" aria-label="Aether API Studio, home">
        <Logo markOnly className="sm:hidden" />
        <Logo className="max-sm:hidden" />
      </Link>

      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden h-9 w-full max-w-xs items-center gap-2.5 rounded-[0.7rem] border border-line bg-surface px-3 text-[0.8125rem] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-muted md:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="flex gap-1" aria-hidden>
          <Kbd>{MOD_KEY}</Kbd>
          <Kbd>K</Kbd>
        </span>
        <span className="sr-only">(shortcut {MOD_KEY} K)</span>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0 md:hidden"
          onClick={onOpenPalette}
          aria-label="Search or jump to"
        >
          <Search />
        </Button>
        <ConnectionIndicator />
        {status === 'authenticated' ? <NotificationBell /> : null}
        <ThemeToggle />
        {status === 'authenticated' ? (
          <UserMenu onOpenShortcuts={onOpenShortcuts} />
        ) : status === 'guest' ? (
          <ButtonLink
            to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
            size="sm"
            className="ml-1"
          >
            Sign in
          </ButtonLink>
        ) : null}
      </div>
    </header>
  );
}
