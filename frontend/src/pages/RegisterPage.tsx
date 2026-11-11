import { useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PasswordChecklist } from '@/components/auth/PasswordChecklist';
import { Alert } from '@/components/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PASSWORD_RULES } from '@/components/ui/password-rules';
import { pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthSignal } from '@/layouts/auth-outlet';
import { errorMessage, fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import { ApiError } from '@/services/api-client';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const signal = useAuthSignal();
  const [params] = useSearchParams();
  const checklistId = useId();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const validate = (): FieldErrors => {
    const local: FieldErrors = {};
    if (form.name.trim().length < 2) local.name = 'Enter at least 2 characters';
    if (!EMAIL.test(form.email.trim())) local.email = 'Enter a valid email address';
    const unmet = PASSWORD_RULES.find((rule) => !rule.test(form.password));
    if (unmet) local.password = `Password needs: ${unmet.label.toLowerCase()}`;
    if (form.confirm !== form.password) local.confirm = 'The passwords do not match';
    return local;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    setFailure(null);
    try {
      const user = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      signal(201);
      toast.success(
        `Welcome, ${user.name.split(' ')[0]}`,
        'Your account is ready. A starter environment is waiting in the tester.',
      );
    } catch (error) {
      signal(error instanceof ApiError ? error.status : 0);
      setErrors(fieldErrorsFrom(error));
      setFailure(
        error instanceof ApiError && error.isUnreachable
          ? 'The API server is not answering. Start it with "npm run dev", then try again.'
          : errorMessage(error),
      );
      setPending(false);
    }
  };

  const next = params.get('next');

  return (
    <>
      <title>{pageTitle('Create an account')}</title>
      <h1 className="font-display text-[1.75rem] leading-tight font-normal tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Free, local and yours: requests, collections and history are stored in your own database.
      </p>

      {failure ? <Alert className="mt-6">{failure}</Alert> : null}

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              autoFocus
              value={form.name}
              onChange={(event) => set('name')(event.target.value)}
              placeholder="Linh Tran"
            />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(event) => set('email')(event.target.value)}
              placeholder="you@company.com"
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(control) => (
            <div className="space-y-2.5">
              <PasswordInput
                {...control}
                aria-describedby={[control['aria-describedby'], checklistId].filter(Boolean).join(' ')}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => set('password')(event.target.value)}
              />
              <PasswordChecklist value={form.password} id={checklistId} />
            </div>
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {(control) => (
            <PasswordInput
              {...control}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(event) => set('confirm')(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          {pending ? 'Creating account' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.8125rem] text-ink-muted">
        Already have an account?{' '}
        <Link
          to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-medium text-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
