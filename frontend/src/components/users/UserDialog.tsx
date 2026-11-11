import { useState, type FormEvent } from 'react';
import { PasswordChecklist } from '@/components/auth/PasswordChecklist';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PASSWORD_RULES } from '@/components/ui/password-rules';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Switch';
import { useAuth } from '@/hooks/useAuth';
import { useUserMutations } from '@/hooks/useCatalog';
import { useToast } from '@/hooks/useToast';
import { errorMessage, fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import type { UpdateUserInput } from '@/services/catalog.service';
import type { PublicUser, Role } from '@/types/models';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function UserForm({ user, onClose }: { user: PublicUser | null; onClose: () => void }) {
  const { user: me, updateUser } = useAuth();
  const { create, update } = useUserMutations();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: (user?.role ?? 'USER') as Role,
    isActive: user?.isActive ?? true,
    bio: user?.bio ?? '',
    password: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const isSelf = user !== null && user.id === me?.id;
  const pending = create.isPending || update.isPending;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local: FieldErrors = {};
    if (form.name.trim().length < 2) local.name = 'Enter at least 2 characters';
    if (!EMAIL.test(form.email.trim())) local.email = 'Enter a valid email address';
    if (!user || form.password) {
      const unmet = PASSWORD_RULES.find((rule) => !rule.test(form.password));
      if (unmet) local.password = `Password needs: ${unmet.label.toLowerCase()}`;
    }
    setErrors(local);
    if (Object.keys(local).length) return;

    try {
      if (user) {
        const input: UpdateUserInput = {
          name: form.name.trim(),
          email: form.email.trim(),
          bio: form.bio.trim() || null,
          ...(isSelf ? {} : { role: form.role, isActive: form.isActive }),
          ...(form.password ? { password: form.password } : {}),
        };
        const updated = await update.mutateAsync({ id: user.id, input });
        if (isSelf) updateUser(updated);
        toast.success('User updated', form.name.trim());
      } else {
        await create.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          bio: form.bio.trim() || null,
        });
        toast.success(
          'User created',
          `${form.name.trim()} can sign in now. They start with the Quick Start collection.`,
        );
      }
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error(user ? 'User not updated' : 'User not created', errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          {(control) => (
            <Input {...control} autoFocus value={form.name} onChange={(event) => set('name', event.target.value)} />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>
        <Field label="Role" error={errors.role} hint={isSelf ? 'You cannot change your own role.' : undefined}>
          {(control) => (
            <Select
              {...control}
              value={form.role}
              disabled={isSelf}
              onChange={(event) => set('role', event.target.value as Role)}
            >
              <option value="USER">Member</option>
              <option value="ADMIN">Administrator</option>
            </Select>
          )}
        </Field>
        <Field
          label={user ? 'New password' : 'Password'}
          aside={user ? 'Leave empty to keep it' : undefined}
          error={errors.password}
        >
          {(control) => (
            <PasswordInput
              {...control}
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>
      </div>
      {!user || form.password ? <PasswordChecklist value={form.password} /> : null}
      <Field label="Bio" aside="Optional" error={errors.bio}>
        {(control) => (
          <Textarea
            {...control}
            value={form.bio}
            onChange={(event) => set('bio', event.target.value)}
            maxLength={500}
            className="min-h-20"
          />
        )}
      </Field>
      {user && !isSelf ? (
        <Checkbox
          checked={form.isActive}
          onChange={(checked) => set('isActive', checked)}
          label="Account is active (deactivating signs the person out everywhere)"
        />
      ) : null}
      {user && form.password ? (
        <p className="text-xs text-ink-faint">Setting a new password signs this person out of every device.</p>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {user ? 'Save user' : 'Create user'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserDialog({ open, user, onClose }: { open: boolean; user: PublicUser | null; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={user ? `Edit ${user.name}` : 'New user'} size="lg">
      <UserForm user={user} onClose={onClose} />
    </Dialog>
  );
}
