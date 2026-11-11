import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { DEMO_ACCOUNTS, SHOW_DEMO_ACCOUNTS, pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useAuthSignal } from '@/layouts/auth-outlet';
import { fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import { ApiError } from '@/services/api-client';

/** A sentence a person can act on, for every way signing in can fail. */
function describeFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Signing in failed. Try again.';
  if (error.isUnreachable) return 'The API server is not answering. Start it with "npm run dev", then try again.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'That email and password do not match an account.';
    case 'ACCOUNT_LOCKED': {
      const seconds = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 900;
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      return `Too many failed attempts. This account is locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.`;
    }
    case 'ACCOUNT_DISABLED':
      return 'This account has been deactivated. Contact an administrator to restore it.';
    case 'RATE_LIMITED':
      return 'Too many sign-in attempts from this network. Wait a few minutes and try again.';
    case 'VALIDATION_ERROR':
      return 'Check the highlighted fields.';
    default:
      return error.message;
  }
}

export default function LoginPage() {
  const { login, ended } = useAuth();
  const signal = useAuthSignal();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!email.trim()) local.email = 'Enter your email address';
    if (!password) local.password = 'Enter your password';
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    setFailure(null);
    try {
      await login({ email, password });
      signal(200);
      // <GuestOnly> sends the person on to `next` as soon as the session exists.
    } catch (error) {
      signal(error instanceof ApiError ? error.status : 0);
      setErrors(fieldErrorsFrom(error));
      setFailure(describeFailure(error));
      setPending(false);
    }
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
    setFailure(null);
  };

  const registerLink = params.get('next') ? `/register?next=${encodeURIComponent(params.get('next')!)}` : '/register';

  return (
    <>
      <title>{pageTitle('Sign in')}</title>
      <h1 className="font-display text-[1.75rem] leading-tight font-normal tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Open the API tester, your saved collections and your usage dashboard.
      </p>

      {ended === 'expired' && !failure ? (
        <Alert tone="info" className="mt-6">
          Your session expired. Sign in again to continue.
        </Alert>
      ) : null}
      {failure ? <Alert className="mt-6">{failure}</Alert> : null}

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          {pending ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.8125rem] text-ink-muted">
        No account yet?{' '}
        <Link to={registerLink} className="font-medium text-accent hover:underline">
          Create one
        </Link>
      </p>

      {SHOW_DEMO_ACCOUNTS ? (
        <section aria-labelledby="demo-title" className="mt-8 rounded-xl border border-dashed border-line-strong p-4">
          <h2 id="demo-title" className="text-[0.8125rem] font-medium text-ink">
            Demo accounts
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Seeded with the database. Pick one to fill in the form.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button key={account.email} variant="secondary" size="sm" onClick={() => fillDemo(account)}>
                {account.label}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
