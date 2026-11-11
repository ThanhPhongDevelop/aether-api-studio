import { use } from 'react';
import { ConfirmContext } from '@/contexts/confirm/confirm-context';

export function useConfirm() {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
