import { Fragment } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Kbd } from '@/components/ui/Kbd';
import { ALL_NAV_ITEMS } from '@/config/navigation';
import { MOD_KEY } from '@/lib/browser';

interface Shortcut {
  keys: string[];
  /** Keys pressed one after the other rather than together. */
  sequence?: boolean;
  label: string;
}

const SECTIONS: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: 'Anywhere',
    shortcuts: [
      { keys: [MOD_KEY, 'K'], label: 'Search screens, actions and saved requests' },
      { keys: ['?'], label: 'Show this list' },
      { keys: ['/'], label: 'Focus the search box on lists' },
      { keys: ['Esc'], label: 'Close a dialog or menu' },
    ],
  },
  {
    title: 'API Tester',
    shortcuts: [
      { keys: [MOD_KEY, 'Enter'], label: 'Send the request' },
      { keys: [MOD_KEY, 'S'], label: 'Save the request' },
      { keys: [MOD_KEY, 'Shift', 'F'], label: 'Format the JSON body' },
    ],
  },
  {
    title: 'Go to',
    shortcuts: ALL_NAV_ITEMS.filter((item) => item.shortcut).map((item) => ({
      keys: item.shortcut!.toUpperCase().split(' '),
      sequence: true,
      label: item.label,
    })),
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.title} className={section.title === 'Go to' ? 'sm:row-span-2' : undefined}>
            <h3 className="mb-2.5 text-[0.8125rem] font-medium text-ink">{section.title}</h3>
            <dl className="space-y-2">
              {section.shortcuts.map((shortcut) => (
                <div key={shortcut.label} className="flex items-center justify-between gap-4 text-[0.8125rem]">
                  <dt className="text-ink-muted">{shortcut.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key, index) => (
                      <Fragment key={key + index}>
                        {index > 0 && shortcut.sequence ? <span className="text-xs text-ink-faint">then</span> : null}
                        <Kbd>{key}</Kbd>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
