import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('glass rounded-[1.25rem] p-5 sm:p-6', className)} {...rest}>
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  id?: string;
}

export function PanelHeader({ title, description, actions, id }: PanelHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-[0.9375rem] font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
