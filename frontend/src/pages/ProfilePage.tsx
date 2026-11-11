import { LogOut } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { PasswordChecklist } from '@/components/auth/PasswordChecklist';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PASSWORD_RULES } from '@/components/ui/password-rules';
import { pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { errorMessage, fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { authService } from '@/services/auth.service';
import type { PublicUser } from '@/types/models';

function ProfileForm({ user }: { user: PublicUser }) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, bio: user.bio ?? '', avatarUrl: user.avatarUrl ?? '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const dirty = form.name !== user.name || form.bio !== (user.bio ?? '') || form.avatarUrl !== (user.avatarUrl ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local: FieldErrors = {};
    if (form.name.trim().length < 2) local.name = 'Enter at least 2 characters';
    if (form.avatarUrl && !/^https?:\/\//i.test(form.avatarUrl.trim()))
      local.avatarUrl = 'Use an http:// or https:// address';
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    try {
      const updated = await authService.updateProfile({
        name: form.name.trim(),
        bio: form.bio.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
      });
      updateUser(updated);
      toast.success('Profile saved');
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error('Profile not saved', errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={form.name || user.name} src={form.avatarUrl || null} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{form.name || user.name}</p>
          <p className="truncate text-[0.8125rem] text-ink-muted">{user.email}</p>
        </div>
      </div>
      <Field label="Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            autoComplete="name"
          />
        )}
      </Field>
      <Field label="Email" hint="Ask an administrator to change the email you sign in with.">
        {(control) => <Input {...control} value={user.email} readOnly disabled />}
      </Field>
      <Field
        label="Avatar URL"
        aside="Optional"
        error={errors.avatarUrl}
        hint="An image address; your initials are shown when it is empty or fails to load."
      >
        {(control) => (
          <Input
            {...control}
            value={form.avatarUrl}
            onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
            placeholder="https://…"
            className="font-mono"
          />
        )}
      </Field>
      <Field label="Bio" aside="Optional" error={errors.bio}>
        {(control) => (
          <Textarea
            {...control}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            maxLength={500}
            className="min-h-20"
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!dirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { applySession } = useAuth();
  const toast = useToast();
  const checklistId = useId();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!form.currentPassword) local.currentPassword = 'Enter your current password';
    const unmet = PASSWORD_RULES.find((rule) => !rule.test(form.newPassword));
    if (unmet) local.newPassword = `Password needs: ${unmet.label.toLowerCase()}`;
    else if (form.newPassword === form.currentPassword)
      local.newPassword = 'Choose a password different from the current one';
    if (form.confirm !== form.newPassword) local.confirm = 'The passwords do not match';
    setErrors(local);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      const session = await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      applySession(session);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed', 'Your other devices were signed out; this one stays signed in.');
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error('Password not changed', errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Current password" error={errors.currentPassword}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
          />
        )}
      </Field>
      <Field label="New password" error={errors.newPassword}>
        {(control) => (
          <div className="space-y-2.5">
            <PasswordInput
              {...control}
              aria-describedby={[control['aria-describedby'], checklistId].filter(Boolean).join(' ')}
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            />
            <PasswordChecklist value={form.newPassword} id={checklistId} />
          </div>
        )}
      </Field>
      <Field label="Confirm new password" error={errors.confirm}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user, logoutEverywhere } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;

  const signOutEverywhere = async () => {
    const confirmed = await confirm({
      title: 'Sign out of every device?',
      description: 'All sessions end, including this one. You will need your password to sign in again.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (!confirmed) return;
    setSigningOut(true);
    try {
      const count = await logoutEverywhere();
      toast.success('Signed out everywhere', `${count} session${count === 1 ? '' : 's'} ended.`);
      void navigate('/login', { replace: true });
    } catch (error) {
      toast.error('Could not sign out everywhere', errorMessage(error));
      setSigningOut(false);
    }
  };

  return (
    <>
      <title>{pageTitle('Profile')}</title>
      <PageHeader title="Profile" description="How you appear in Aether, your password and where you are signed in." />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="profile-title">
          <PanelHeader id="profile-title" title="Your details" />
          {/* Remount after a save so the form shows exactly what is stored. */}
          <ProfileForm key={user.updatedAt} user={user} />
        </Panel>
        <div className="space-y-5">
          <Panel aria-labelledby="account-title">
            <PanelHeader id="account-title" title="Account" />
            <dl className="space-y-3 text-[0.8125rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Role</dt>
                <dd>
                  <ToneBadge tone={user.role === 'ADMIN' ? 'redirect' : 'neutral'}>
                    {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
                  </ToneBadge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Member since</dt>
                <dd className="text-ink">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Last sign-in</dt>
                <dd className="text-ink">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'This session'}</dd>
              </div>
            </dl>
          </Panel>
          <Panel aria-labelledby="password-title">
            <PanelHeader
              id="password-title"
              title="Change password"
              description="Other devices are signed out when it changes."
            />
            <PasswordForm />
          </Panel>
          <Panel aria-labelledby="sessions-title">
            <PanelHeader
              id="sessions-title"
              title="Sessions"
              description="Lost a device or used a shared computer? End every session at once."
            />
            <Button variant="danger" icon={<LogOut />} loading={signingOut} onClick={() => void signOutEverywhere()}>
              Sign out everywhere
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
