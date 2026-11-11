import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { ConfirmContext, type ConfirmOptions } from './confirm-context';

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** One shared confirmation dialog: `if (await confirm({...})) destroy()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ''}
        description={pending?.description}
        size="sm"
      >
        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => settle(false)}>
            {pending?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            ref={confirmButton}
            variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            autoFocus
          >
            {pending?.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </Dialog>
    </ConfirmContext>
  );
}
