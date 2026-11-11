import { Braces, Info } from 'lucide-react';
import { useState } from 'react';
import { CodeEditor } from '@/components/code/CodeEditor';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { KeyValueEditor } from '@/components/ui/KeyValueEditor';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { MOD_KEY } from '@/lib/browser';
import type { ParamRow } from '@/lib/query-string';
import { jsonError } from '@/lib/response';
import type { DraftRequest } from '@/lib/tester-store';
import type { BodyType, RequestAuth } from '@/types/models';

type EditorTab = 'params' | 'headers' | 'auth' | 'body' | 'options';

const HEADER_SUGGESTIONS = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-API-Key',
  'X-Request-ID',
];

const AUTH_LABEL: Record<RequestAuth['type'], string> = { NONE: 'None', BEARER: 'Bearer', BASIC: 'Basic' };
const BODY_LABEL: Record<BodyType, string> = { NONE: 'None', JSON: 'JSON', RAW: 'Raw' };

const countEnabled = (rows: ParamRow[]) => rows.filter((row) => row.enabled && row.key).length || undefined;

function AuthEditor({ auth, onChange }: { auth: RequestAuth; onChange: (auth: RequestAuth) => void }) {
  return (
    <div className="space-y-5">
      <SegmentedControl
        label="Authorization type"
        value={auth.type}
        onChange={(type) => {
          if (type === auth.type) return;
          if (type === 'NONE') onChange({ type });
          else if (type === 'BEARER') onChange({ type, token: '{{accessToken}}' });
          else onChange({ type, username: '', password: '' });
        }}
        options={[
          { value: 'NONE', label: 'No auth' },
          { value: 'BEARER', label: 'Bearer token' },
          { value: 'BASIC', label: 'Basic auth' },
        ]}
      />
      {auth.type === 'NONE' ? (
        <p className="text-[0.8125rem] text-ink-muted">This request is sent without an Authorization header.</p>
      ) : auth.type === 'BEARER' ? (
        <Field
          label="Token"
          hint="Sent as “Authorization: Bearer …”. Use {{accessToken}} to read it from the active environment."
        >
          {(control) => (
            <Input
              {...control}
              value={auth.token}
              onChange={(event) => onChange({ ...auth, token: event.target.value })}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          )}
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username">
            {(control) => (
              <Input
                {...control}
                value={auth.username}
                onChange={(event) => onChange({ ...auth, username: event.target.value })}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <Field label="Password">
            {(control) => (
              <PasswordInput
                {...control}
                value={auth.password}
                onChange={(event) => onChange({ ...auth, password: event.target.value })}
                autoComplete="off"
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}

interface BodyEditorProps {
  draft: DraftRequest;
  onChange: (patch: Partial<DraftRequest>) => void;
  onFormat: () => void;
  isKnownVariable: (name: string) => boolean;
}

function BodyEditor({ draft, onChange, onFormat, isKnownVariable }: BodyEditorProps) {
  const error = draft.bodyType === 'JSON' && !/\{\{/.test(draft.body) ? jsonError(draft.body) : null;
  const ignoredByMethod = draft.bodyType !== 'NONE' && (draft.method === 'GET' || draft.method === 'HEAD');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Body type"
          value={draft.bodyType}
          onChange={(bodyType) => onChange({ bodyType })}
          options={[
            { value: 'NONE', label: 'None' },
            { value: 'JSON', label: 'JSON' },
            { value: 'RAW', label: 'Raw text' },
          ]}
        />
        {draft.bodyType === 'JSON' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Braces />}
            onClick={onFormat}
            title={`Format (${MOD_KEY} + Shift + F)`}
          >
            Format JSON
          </Button>
        ) : null}
      </div>

      {draft.bodyType === 'NONE' ? (
        <p className="text-[0.8125rem] text-ink-muted">This request has no body.</p>
      ) : (
        <>
          <CodeEditor
            value={draft.body}
            onChange={(body) => onChange({ body })}
            language={draft.bodyType === 'JSON' ? 'json' : 'text'}
            label="Request body"
            placeholder={draft.bodyType === 'JSON' ? '{\n  "name": "value"\n}' : 'Plain text sent as-is'}
            isKnownVariable={isKnownVariable}
          />
          {error ? (
            <p className="text-xs text-warn" role="status">
              Not valid JSON yet: {error}
            </p>
          ) : null}
          {ignoredByMethod ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              <Info className="size-3.5" aria-hidden />
              Many servers ignore a body on {draft.method} requests.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

interface RequestEditorProps {
  draft: DraftRequest;
  onChange: (patch: Partial<DraftRequest>) => void;
  onParamsChange: (rows: ParamRow[]) => void;
  onFormatBody: () => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (value: boolean) => void;
  isKnownVariable: (name: string) => boolean;
}

export function RequestEditor({
  draft,
  onChange,
  onParamsChange,
  onFormatBody,
  followRedirects,
  onFollowRedirectsChange,
  isKnownVariable,
}: RequestEditorProps) {
  const [tab, setTab] = useState<EditorTab>(draft.bodyType !== 'NONE' ? 'body' : 'params');

  return (
    <div>
      <Tabs<EditorTab>
        idBase="request-editor"
        label="Request settings"
        value={tab}
        onChange={setTab}
        size="sm"
        items={[
          { value: 'params', label: 'Params', badge: countEnabled(draft.params) },
          { value: 'headers', label: 'Headers', badge: countEnabled(draft.headers) },
          { value: 'auth', label: 'Auth', badge: draft.auth.type === 'NONE' ? undefined : AUTH_LABEL[draft.auth.type] },
          { value: 'body', label: 'Body', badge: draft.bodyType === 'NONE' ? undefined : BODY_LABEL[draft.bodyType] },
          { value: 'options', label: 'Options' },
        ]}
      />
      <TabPanel idBase="request-editor" value={tab} className="pt-4">
        {tab === 'params' ? (
          <div className="space-y-2">
            <KeyValueEditor
              rows={draft.params}
              onChange={onParamsChange}
              label="Query parameters"
              keyPlaceholder="Parameter"
            />
            <p className="text-xs text-ink-faint">
              Edits here and in the URL stay in sync. Unticked rows are kept but not sent.
            </p>
          </div>
        ) : tab === 'headers' ? (
          <KeyValueEditor
            rows={draft.headers}
            onChange={(headers) => onChange({ headers })}
            label="Request headers"
            keyPlaceholder="Header"
            keySuggestions={HEADER_SUGGESTIONS}
          />
        ) : tab === 'auth' ? (
          <AuthEditor auth={draft.auth} onChange={(auth) => onChange({ auth })} />
        ) : tab === 'body' ? (
          <BodyEditor draft={draft} onChange={onChange} onFormat={onFormatBody} isKnownVariable={isKnownVariable} />
        ) : (
          <div className="max-w-xl space-y-4">
            <Switch
              checked={followRedirects}
              onChange={onFollowRedirectsChange}
              label="Follow redirects"
              description="Up to 5 hops. Credentials are dropped when a redirect leaves the original host."
            />
            <p className="text-[0.8125rem] text-ink-muted">
              The timeout comes from your settings. Requests run on the Aether server, so browser CORS rules do not
              apply.
            </p>
          </div>
        )}
      </TabPanel>
    </div>
  );
}
