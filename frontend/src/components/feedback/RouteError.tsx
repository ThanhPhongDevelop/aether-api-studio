import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { Panel } from '@/components/ui/Panel';

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

/** Root error boundary: a crash in any screen lands here instead of a blank page. */
export function RouteError() {
  const error = useRouteError();

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <Panel className="max-w-lg text-center">
        <h1 className="font-display text-2xl font-normal">This screen stopped working</h1>
        <p className="mt-2 text-ink-muted">
          The interface hit an unexpected error. Reloading usually fixes it; if it keeps happening, the browser console
          has the details.
        </p>
        <pre className="mt-5 overflow-auto rounded-lg bg-line p-3 text-left font-mono text-xs text-fail">
          {describe(error)}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <a href="/" className={buttonStyles({ variant: 'secondary' })}>
            Go to overview
          </a>
        </div>
      </Panel>
    </div>
  );
}
