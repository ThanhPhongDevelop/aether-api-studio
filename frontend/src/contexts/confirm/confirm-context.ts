import { createContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Name the action exactly, e.g. "Delete collection". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
