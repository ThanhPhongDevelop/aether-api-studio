import { AnimatePresence, m } from 'framer-motion';
import { ExternalLink, Lock, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { API_BASE_URL, APP_VERSION } from '@/config/app';
import { NAV_GROUPS, canAccess } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const loginTarget = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <div className="flex h-full flex-col gap-7 overflow-y-auto px-4 py-5">
      <Link
        to="/"
        onClick={onNavigate}
        className="self-start rounded-lg px-2 py-1"
        aria-label="Aether API Studio, home"
      >
        <Logo />
      </Link>

      <nav aria-label="Main" className="space-y-6">
        {NAV_GROUPS.map((group) => {
          // Guests see what the workspace offers (locked); admin tools stay hidden from everyone else.
          const items = group.items.filter((item) => item.access !== 'admin' || canAccess('admin', user));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-xs text-ink-faint">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, access }) => {
                  const locked = !canAccess(access, user) && status !== 'loading';
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'relative flex items-center gap-3 rounded-[0.7rem] px-3 py-2 text-sm transition-colors',
                            isActive ? 'bg-surface-strong text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />
                            ) : null}
                            <Icon className="size-4" aria-hidden />
                            <span className="flex-1">{label}</span>
                            {locked ? <Lock className="size-3.5 text-ink-faint" aria-label="Requires sign-in" /> : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        {user ? (
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-line-strong"
          >
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-faint">
                {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
              </span>
            </span>
          </Link>
        ) : status === 'guest' ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
            <p className="text-[0.8125rem] text-ink-muted">
              Sign in to send requests, save collections and see your usage.
            </p>
            <div className="flex gap-2">
              <ButtonLink to={loginTarget} size="sm" className="flex-1" onClick={onNavigate}>
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" size="sm" variant="secondary" className="flex-1" onClick={onNavigate}>
                Sign up
              </ButtonLink>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-line px-1 pt-3 text-xs text-ink-faint">
          <span>Version {APP_VERSION}</span>
          <a
            href={API_BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded text-ink-muted transition-colors hover:text-ink"
          >
            Raw API
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Fixed rail on large screens; slide-over drawer on small ones. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface backdrop-blur-xl lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open ? (
          <m.div className="fixed inset-0 z-50 lg:hidden" initial="hidden" animate="visible" exit="hidden">
            <m.div
              className="absolute inset-0 bg-[#02040b]/60 backdrop-blur-sm"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              onClick={onClose}
              aria-hidden
            />
            <m.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface-strong backdrop-blur-xl"
              variants={{ hidden: { x: '-100%' }, visible: { x: 0 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <Button
                ref={closeButton}
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close navigation"
                className="absolute top-4 right-3 z-10 size-9 px-0"
              >
                <X />
              </Button>
              <SidebarContent onNavigate={onClose} />
            </m.aside>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
