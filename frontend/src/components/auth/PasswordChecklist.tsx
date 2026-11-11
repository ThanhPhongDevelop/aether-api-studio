import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/components/ui/password-rules';
import { cn } from '@/lib/cn';

/** Live list of the password rules the API enforces. */
export function PasswordChecklist({ value, id }: { value: string; id?: string }) {
  return (
    <ul id={id} className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className={cn('flex items-center gap-1.5', met ? 'text-ok' : 'text-ink-faint')}>
            {met ? <Check className="size-3" aria-hidden /> : <Circle className="size-2.5" aria-hidden />}
            {rule.label}
            <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
