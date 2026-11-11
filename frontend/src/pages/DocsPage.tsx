import { useQuery } from '@tanstack/react-query';
import { BookOpen, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { JsonPreview } from '@/components/code/JsonPreview';
import { PageHeader } from '@/components/layout/PageHeader';
import { MethodBadge, ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { API_BASE_URL, pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useTester } from '@/hooks/useTester';
import { errorMessage } from '@/lib/form-errors';
import { toneForStatus } from '@/lib/http';
import { loginPath } from '@/lib/navigation';
import { exampleOf, groupByTag, listOperations, requestFromOperation, type DocOperation } from '@/lib/openapi';
import { draftFrom, testerStore } from '@/lib/tester-store';
import { testerService } from '@/services/workspace.service';
import type { AccessLevel, OpenApiSchema } from '@/types/openapi';

const ACCESS: Record<AccessLevel, { label: string; tone: 'ok' | 'redirect' | 'warn' | 'neutral' }> = {
  public: { label: 'Public', tone: 'ok' },
  optional: { label: 'Token optional', tone: 'neutral' },
  user: { label: 'Signed in', tone: 'redirect' },
  admin: { label: 'Administrators', tone: 'warn' },
};

function schemaType(schema: OpenApiSchema | undefined): string {
  if (!schema) return '';
  if (schema.enum) return schema.enum.map(String).join(' | ');
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type ?? '');
  return schema.format ? `${type} (${schema.format})` : type;
}

function OperationCard({ entry, onTry }: { entry: DocOperation; onTry: (entry: DocOperation) => void }) {
  const { operation } = entry;
  const parameters = operation.parameters ?? [];
  const body = exampleOf(operation.requestBody?.content?.['application/json']);
  const access = ACCESS[entry.access];

  return (
    <article id={entry.id} className="scroll-mt-24 border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2.5">
            <MethodBadge method={entry.method} />
            <code className="font-mono text-[0.8125rem] break-all text-ink">{entry.path}</code>
          </h3>
          <p className="mt-2 text-sm text-ink">{operation.summary}</p>
          {operation.description ? (
            <p className="mt-1 max-w-3xl text-[0.8125rem] text-ink-muted">{operation.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToneBadge tone={access.tone}>{access.label}</ToneBadge>
          <Button variant="secondary" size="sm" icon={<Send />} onClick={() => onTry(entry)}>
            Try it
          </Button>
        </div>
      </div>

      {parameters.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-[0.8125rem]">
            <caption className="sr-only">
              Parameters of {entry.method} {entry.path}
            </caption>
            <thead className="text-left text-xs text-ink-faint">
              <tr>
                <th className="py-1.5 pr-3 font-normal">Parameter</th>
                <th className="py-1.5 pr-3 font-normal">In</th>
                <th className="py-1.5 pr-3 font-normal">Type</th>
                <th className="py-1.5 font-normal">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {parameters.map((parameter) => (
                <tr key={`${parameter.in}-${parameter.name}`}>
                  <td className="py-1.5 pr-3 font-mono text-xs text-ink">
                    {parameter.name}
                    {parameter.required ? (
                      <span className="ml-1 text-fail" aria-label="required">
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-ink-muted">{parameter.in}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs text-ink-muted">{schemaType(parameter.schema)}</td>
                  <td className="py-1.5 text-ink-muted">{parameter.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {body !== undefined ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-ink-faint">Example body</p>
          <div className="max-h-64 overflow-auto rounded-xl border border-line bg-[color-mix(in_oklab,var(--canvas-deep)_55%,transparent)] p-3.5">
            <JsonPreview code={JSON.stringify(body, null, 2)} />
          </div>
        </div>
      ) : null}

      {operation.responses ? (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted" aria-label="Responses">
          {Object.entries(operation.responses).map(([code, response]) => (
            <li key={code} className="flex items-center gap-1.5">
              <ToneBadge tone={toneForStatus(Number(code))} className="px-1.5 py-0 text-[0.6875rem]">
                {code}
              </ToneBadge>
              {response.description}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function DocsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { status } = useAuth();
  const { dirty } = useTester();
  const [query, setQuery] = useState('');
  const docs = useQuery({
    queryKey: ['docs'],
    queryFn: ({ signal }) => testerService.docs(signal),
    staleTime: Infinity,
  });

  const groups = useMemo(() => {
    if (!docs.data) return [];
    const term = query.trim().toLowerCase();
    const operations = listOperations(docs.data).filter(
      (entry) =>
        !term ||
        entry.path.toLowerCase().includes(term) ||
        entry.method.toLowerCase() === term ||
        (entry.operation.summary ?? '').toLowerCase().includes(term) ||
        entry.tag.toLowerCase().includes(term),
    );
    return groupByTag(docs.data, operations);
  }, [docs.data, query]);

  const tryIt = async (entry: DocOperation) => {
    if (dirty) {
      const discard = await confirm({
        title: 'Replace the request in the tester?',
        description: 'The tester has unsaved changes that this example would replace.',
        confirmLabel: 'Replace it',
      });
      if (!discard) return;
    }
    testerStore.load(draftFrom(requestFromOperation(entry)));
    void navigate(status === 'authenticated' ? '/tester' : loginPath('/tester'));
  };

  const total = groups.reduce((sum, group) => sum + group.operations.length, 0);

  return (
    <>
      <title>{pageTitle('API docs')}</title>
      <PageHeader
        title="API docs"
        description={
          <>
            Every endpoint of the Aether API, generated from its OpenAPI description at{' '}
            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent hover:underline"
            >
              {API_BASE_URL}/docs
            </a>
            . “Try it” opens a ready-to-send request in the API Tester.
          </>
        }
      />

      {docs.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-64 rounded-[1.25rem]" />
          <Skeleton className="h-64 rounded-[1.25rem]" />
        </div>
      ) : docs.isError ? (
        <ErrorState
          message={errorMessage(docs.error, 'The API description could not be loaded.')}
          onRetry={() => void docs.refetch()}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav
            aria-label="Endpoints"
            className="glass top-22 max-h-[calc(100dvh-7.5rem)] space-y-4 overflow-y-auto rounded-[1.25rem] p-4 lg:sticky"
          >
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Filter endpoints"
              label="Filter endpoints"
              inputSize="sm"
              shortcut
            />
            <p className="text-xs text-ink-faint">
              {total} endpoint{total === 1 ? '' : 's'}, API version {docs.data.info.version}
            </p>
            {groups.map((group) => (
              <div key={group.name}>
                <p className="mb-1 text-xs text-ink-faint">{group.name}</p>
                <ul className="space-y-px">
                  {group.operations.map((entry) => (
                    <li key={entry.id}>
                      <a
                        href={`#${entry.id}`}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-ink-muted transition-colors hover:bg-line/60 hover:text-ink"
                      >
                        <MethodBadge method={entry.method} className="min-w-[3.1rem] text-[0.625rem]" />
                        <span className="truncate font-mono">{entry.path}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="min-w-0 space-y-5">
            <Panel>
              <h2 className="text-[0.9375rem] font-semibold">Authentication</h2>
              <p className="mt-1.5 max-w-3xl text-[0.8125rem] text-ink-muted">
                Sign in with <code className="font-mono text-ink">POST /auth/login</code> to get a short-lived access
                token, then send it as <code className="font-mono text-ink">Authorization: Bearer &lt;token&gt;</code>.
                In the tester, “Save token as {'{{accessToken}}'}” on the login response does this for every request at
                once. Errors always use the same shape:{' '}
                <code className="font-mono text-ink">{'{ success: false, error: { code, message, details } }'}</code>.
              </p>
            </Panel>
            {groups.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No endpoint matches"
                description="Try a path such as /products or a method such as POST."
                className="glass rounded-[1.25rem]"
              />
            ) : (
              groups.map((group) => (
                <Panel key={group.name} aria-labelledby={`tag-${group.name}`}>
                  <h2 id={`tag-${group.name}`} className="font-display text-lg font-normal tracking-tight">
                    {group.name}
                  </h2>
                  {group.description ? (
                    <p className="mt-1 text-[0.8125rem] text-ink-muted">{group.description}</p>
                  ) : null}
                  <div className="mt-5">
                    {group.operations.map((entry) => (
                      <OperationCard key={entry.id} entry={entry} onTry={(operation) => void tryIt(operation)} />
                    ))}
                  </div>
                </Panel>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
