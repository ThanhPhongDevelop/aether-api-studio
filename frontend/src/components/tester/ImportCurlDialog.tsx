import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { CurlParseError, parseCurl } from '@/lib/curl';
import { draftFrom, hostAndPath, testerStore } from '@/lib/tester-store';

const EXAMPLE = `curl -X POST 'https://api.example.com/v1/orders' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer <token>' \\
  --data-raw '{"productId": 3, "quantity": 2}'`;

function ImportForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed = parseCurl(command);
      testerStore.load(draftFrom({ ...parsed, name: `${parsed.method} ${hostAndPath(parsed.url)}` }));
      toast.success(
        'Request imported',
        parsed.warnings.length ? parsed.warnings.join(' ') : 'Review it, then press Send.',
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof CurlParseError ? caught.message : 'That command could not be read.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Textarea
        autoFocus
        value={command}
        onChange={(event) => {
          setCommand(event.target.value);
          setError(null);
        }}
        aria-label="cURL command"
        placeholder={EXAMPLE}
        spellCheck={false}
        className="min-h-48 font-mono text-[0.8125rem]"
      />
      <p className="text-xs text-ink-faint">
        Works with “Copy as cURL (bash)” from browser developer tools. Bearer and Basic credentials move to the Auth
        tab.
      </p>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!command.trim()}>
          Import request
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ImportCurlDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import from cURL"
      description="Paste a cURL command; it replaces the current draft."
      size="lg"
    >
      <ImportForm onClose={onClose} />
    </Dialog>
  );
}
