import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { safeNext } from '@/lib/navigation';

function ScreenSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pt-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

/** Screens for signed-in accounts; guests are sent to sign in and brought back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <ScreenSkeleton />;
  if (status === 'guest') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { status, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <ScreenSkeleton />;
  if (status === 'guest') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="This screen is for administrators"
        description="Your account can use the tester, dashboard and environments. Ask an administrator if you need user management."
        action={<ButtonLink to="/dashboard">Go to your dashboard</ButtonLink>}
        className="py-24"
      />
    );
  }
  return <Outlet />;
}

/** Sign-in and sign-up: already signed-in people continue to where they were going. */
export function GuestOnly() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  if (status === 'authenticated') return <Navigate to={safeNext(params.get('next'))} replace />;
  return <Outlet />;
}
