import { useLocation } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { pageTitle } from '@/config/app';

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-24 text-center">
      <title>{pageTitle('Page not found')}</title>
      <p className="font-mono text-5xl font-medium text-warn">404</p>
      <h1 className="mt-5 font-display text-2xl font-normal tracking-tight">No screen at this address</h1>
      <p className="mt-3 text-ink-muted">
        Nothing is routed to <code className="font-mono text-ink">{pathname}</code>. Check the address, or go back to
        the overview.
      </p>
      <ButtonLink to="/" className="mt-8">
        Back to overview
      </ButtonLink>
    </div>
  );
}
