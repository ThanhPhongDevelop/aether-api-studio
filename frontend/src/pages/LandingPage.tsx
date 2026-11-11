import 'lenis/dist/lenis.css';
import { m, useScroll, useTransform, type MotionValue } from 'framer-motion';
import Lenis from 'lenis';
import {
  Activity,
  BookOpen,
  FileCode2,
  FolderTree,
  History,
  LayoutDashboard,
  Send,
  ShieldCheck,
  Variable,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/navigation/ThemeToggle';
import { HeroStage } from '@/components/three/HeroStage';
import { MethodBadge, ToneBadge } from '@/components/ui/Badges';
import { Button, ButtonLink } from '@/components/ui/Button';
import { APP_NAME, APP_VERSION, pageTitle } from '@/config/app';
import { useApiProbe } from '@/hooks/useApiProbe';
import { useAuth } from '@/hooks/useAuth';
import { useEffectsPreference } from '@/hooks/useSettings';
import { useSystemStatus } from '@/hooks/useSystem';
import { formatBytes, formatMs, formatNumber, formatUptime } from '@/lib/format';
import { toneForStatus } from '@/lib/http';
import { loginPath } from '@/lib/navigation';

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    title: 'Compose',
    text: 'Method, URL, query, headers, auth and a JSON or text body. {{baseUrl}} and {{accessToken}} come from the active environment.',
  },
  {
    title: 'Run it on the server',
    text: 'The Aether API sends it with Node’s own HTTP client: no browser CORS limits, every redirect re-checked, private networks blocked in production.',
  },
  {
    title: 'Read the answer',
    text: 'Status, time to first byte, total time, size, headers and a formatted body. A login response’s token can be saved for every later request.',
  },
  {
    title: 'Keep the record',
    text: 'Each request lands in your history and on the dashboard. Save the useful ones into collections and run them again any time.',
  },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: FolderTree,
    title: 'Collections',
    text: 'Group saved requests by API or feature. New accounts start with a Quick Start collection covering every endpoint.',
  },
  {
    icon: Variable,
    title: 'Environments',
    text: 'Switch between Local, Staging and Production values without editing a single request. Secrets are masked on screen.',
  },
  {
    icon: History,
    title: 'History and replay',
    text: 'Every request and response is recorded with its timing. Open an old one, change it, send it again.',
  },
  {
    icon: LayoutDashboard,
    title: 'Usage dashboard',
    text: 'Requests over time, success rate, response times, status codes and your busiest endpoints, per hour or per day.',
  },
  {
    icon: FileCode2,
    title: 'cURL in and out',
    text: 'Paste a command copied from browser developer tools, or copy any request back out as cURL.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe by default',
    text: 'Short-lived tokens kept in memory, rotating refresh cookies, rate limits, account lockout and an SSRF guard.',
  },
];

/** Drifts a block against the scroll for depth (none with reduced motion). */
function Parallax({
  progress,
  distance,
  disabled,
  children,
  className,
}: {
  progress: MotionValue<number>;
  distance: number;
  disabled: boolean;
  children: ReactNode;
  className?: string;
}) {
  const y = useTransform(progress, [0, 1], [distance, -distance]);
  return (
    <m.div style={disabled ? undefined : { y }} className={className}>
      {children}
    </m.div>
  );
}

function SystemNumbers() {
  const status = useSystemStatus(false);
  const report = status.data;
  const records = report?.database.records;
  const readouts = [
    { label: 'Products in the catalogue', value: records ? formatNumber(records.products) : '—' },
    { label: 'Accounts', value: records ? formatNumber(records.users) : '—' },
    { label: 'Saved requests', value: records ? formatNumber(records.savedRequests) : '—' },
    { label: 'Requests recorded', value: records ? formatNumber(records.requestHistory) : '—' },
    { label: 'Server uptime', value: report ? formatUptime(report.service.uptimeSeconds) : '—' },
    { label: 'Database round trip', value: report ? formatMs(report.database.latencyMs) : '—' },
  ];

  return (
    <div>
      {status.isError ? (
        <p className="mb-4 text-[0.8125rem] text-warn">
          The API is not answering right now, so these numbers are unavailable.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3">
        {readouts.map((readout) => (
          <div key={readout.label} className="border-l border-line-strong pl-4">
            <dt className="text-[0.8125rem] text-ink-muted">{readout.label}</dt>
            <dd className="mt-1 text-[1.75rem] leading-none font-semibold tracking-tight text-ink">{readout.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const { reducedMotion, effects3d } = useEffectsPreference();
  const probe = useApiProbe('GET', '/health');
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  // The 3D camera follows the hero leaving the screen; the parallax follows the whole page.
  const { scrollYProgress: heroExit } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const signedIn = status === 'authenticated';
  const testerLink = signedIn ? '/tester' : loginPath('/tester');

  // Smooth scrolling for this long page only; app screens keep native scrolling.
  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.1 });
    return () => lenis.destroy();
  }, [reducedMotion]);

  const reveal = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: EASE },
        };

  return (
    <>
      <title>{pageTitle('API workbench')}</title>
      {effects3d ? (
        <HeroStage pulse={probe.pulse} scroll={heroExit} reducedMotion={reducedMotion} onCoreClick={probe.send} />
      ) : null}

      <header className="fixed inset-x-0 top-0 z-30 border-b border-transparent bg-canvas/40 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="rounded-lg" aria-label={`${APP_NAME}, home`}>
            <Logo />
          </Link>
          <nav aria-label="Site" className="ml-6 hidden items-center gap-1 text-sm md:flex">
            {[
              { to: '/docs', label: 'API docs' },
              { to: '/products', label: 'Products' },
              { to: '/status', label: 'System status' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <ButtonLink to="/dashboard" size="sm">
                Open workspace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" size="sm" variant="ghost" className="max-sm:hidden">
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" size="sm">
                  Create account
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* The hero lets clicks through to the 3D core everywhere except its own controls. */}
        <section ref={hero} className="pointer-events-none relative flex min-h-dvh items-center">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/85 via-canvas/45 to-transparent max-lg:bg-canvas/55"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 pt-24 pb-16 sm:px-8">
            <div className="pointer-events-auto max-w-xl">
              <m.h1
                {...reveal(0.1)}
                className="font-display text-[clamp(2.4rem,5.4vw,4.3rem)] leading-[1.05] font-normal tracking-tight text-ink"
              >
                Send a request. Watch it answer.
              </m.h1>
              <m.p {...reveal(0.25)} className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
                {APP_NAME} is a full-stack workbench for HTTP APIs. Compose requests with environment variables, send
                them from the server, and read every status, header and millisecond that comes back.
              </m.p>
              <m.div {...reveal(0.4)} className="mt-8 flex flex-wrap gap-3">
                <ButtonLink to={testerLink} icon={<Send />} className="h-11 px-5">
                  Open the API Tester
                </ButtonLink>
                <ButtonLink to="/docs" variant="secondary" icon={<BookOpen />} className="h-11 px-5">
                  Read the API docs
                </ButtonLink>
              </m.div>

              <m.div {...reveal(0.55)} className="glass mt-12 max-w-md rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <MethodBadge method={probe.method} />
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-ink">/api{probe.path}</code>
                  <Button size="sm" onClick={probe.send} loading={probe.isPending}>
                    Send
                  </Button>
                </div>
                <div
                  className="mt-3 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted"
                  aria-live="polite"
                >
                  {probe.result ? (
                    <>
                      <ToneBadge tone={toneForStatus(probe.result.status)}>
                        {probe.result.status === 0
                          ? 'No response'
                          : `${probe.result.status} ${probe.result.statusText}`}
                      </ToneBadge>
                      <span className="tabular-nums">{formatMs(probe.result.durationMs)}</span>
                      <span className="tabular-nums">{formatBytes(probe.result.sizeBytes)}</span>
                    </>
                  ) : (
                    <span>
                      A real request to this server.{' '}
                      {effects3d ? 'The core lights up with the answer — or click the crystal.' : ''}
                    </span>
                  )}
                </div>
              </m.div>
            </div>
          </div>
        </section>

        <section aria-labelledby="flow-title" className="relative py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2
              id="flow-title"
              className="max-w-lg font-display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-tight font-normal tracking-tight"
            >
              What happens when you press Send
            </h2>
            <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Parallax
                    progress={scrollYProgress}
                    distance={12 + index * 10}
                    disabled={reducedMotion}
                    className="glass h-full rounded-2xl p-5"
                  >
                    <span className="font-display text-sm text-accent" aria-hidden>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">{step.text}</p>
                  </Parallax>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="numbers-title" className="relative py-16">
          <div className="glass mx-auto grid max-w-6xl gap-12 rounded-[1.5rem] p-6 sm:mx-8 sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:mx-auto">
            <div>
              <h2
                id="numbers-title"
                className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-tight font-normal tracking-tight"
              >
                A real API underneath
              </h2>
              <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
                Accounts, the product catalogue and every workspace are served by a REST API on Express, Prisma and
                SQLite. These numbers come from <code className="font-mono text-ink">GET /api/status</code> as this page
                loads.
              </p>
              <Link to="/status" className="mt-5 inline-flex items-center gap-2 text-sm text-accent hover:underline">
                <Activity className="size-4" aria-hidden />
                Open the system status
              </Link>
            </div>
            <SystemNumbers />
          </div>
        </section>

        <section aria-labelledby="features-title" className="relative py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="glass rounded-[1.5rem] p-6 sm:p-10">
              <h2
                id="features-title"
                className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-tight font-normal tracking-tight"
              >
                Everything around the request
              </h2>
              <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-4 border-t border-line pt-6">
                    <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                    <div>
                      <dt className="text-[0.9375rem] font-semibold text-ink">{title}</dt>
                      <dd className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{text}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="start-title" className="relative py-28">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2
              id="start-title"
              className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-tight font-normal tracking-tight"
            >
              {signedIn ? 'Your workspace is ready' : 'Start with the demo account'}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">
              {signedIn
                ? 'Pick up where you left off: your collections, environments and history are waiting.'
                : 'Sign in as demo@aether.dev, or create your own account: both come with the Quick Start collection, one ready-to-run request for every endpoint.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to={testerLink} icon={<Send />} className="h-11 px-5">
                Open the API Tester
              </ButtonLink>
              {signedIn ? (
                <ButtonLink to="/dashboard" variant="secondary" className="h-11 px-5">
                  See your dashboard
                </ButtonLink>
              ) : (
                <ButtonLink to="/register" variant="secondary" className="h-11 px-5">
                  Create an account
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-line bg-canvas/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-6 text-xs text-ink-faint sm:px-8">
          <span>
            {APP_NAME} version {APP_VERSION}
          </span>
          <Link to="/docs" className="hover:text-ink">
            API docs
          </Link>
          <Link to="/products" className="hover:text-ink">
            Products
          </Link>
          <Link to="/status" className="hover:text-ink">
            System status
          </Link>
        </div>
      </footer>
    </>
  );
}
