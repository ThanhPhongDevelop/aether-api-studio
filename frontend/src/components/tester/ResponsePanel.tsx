import { Clipboard, Download, Eye, EyeOff, KeyRound, Radio, Unplug } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { JsonPreview } from '@/components/code/JsonPreview';
import { ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Spinner } from '@/components/ui/Spinner';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/hooks/useToast';
import { base64ToBytes, copyText, downloadFile, slugify } from '@/lib/browser';
import { cn } from '@/lib/cn';
import { formatBytes, formatMs, formatRelative } from '@/lib/format';
import { STATUS_TEXT, toneForStatus } from '@/lib/http';
import { bodyKind, fileExtension, findAccessToken, isSensitiveHeader, prettyJson } from '@/lib/response';
import { hostAndPath, type TesterResponse } from '@/lib/tester-store';
import type { HeaderEntry } from '@/types/models';

type ResponseTab = 'body' | 'headers' | 'request';

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{formatMs(now - since)}</span>;
}

function HeaderTable({ headers, maskSecrets }: { headers: HeaderEntry[]; maskSecrets?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  if (headers.length === 0) return <p className="text-[0.8125rem] text-ink-faint">No headers.</p>;
  const hasSecrets = maskSecrets && headers.some((header) => isSensitiveHeader(header.key));

  return (
    <div className="space-y-2">
      {hasSecrets ? (
        <Button
          variant="ghost"
          size="xs"
          icon={revealed ? <EyeOff /> : <Eye />}
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? 'Hide credentials' : 'Show credentials'}
        </Button>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-[0.8125rem]">
          <tbody className="divide-y divide-line">
            {headers.map((header, index) => (
              <tr key={`${header.key}-${index}`} className="align-top">
                <th
                  scope="row"
                  className="w-[34%] px-3 py-2 text-left font-mono text-xs font-normal break-all text-ink-muted"
                >
                  {header.key}
                </th>
                <td className="px-3 py-2 font-mono text-xs break-all text-ink">
                  {maskSecrets && !revealed && isSensitiveHeader(header.key) ? '••••••••' : header.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Waiting for the first byte vs. downloading the rest. */
function TimingBar({ total, ttfb }: { total: number; ttfb: number | null }) {
  if (ttfb === null || total <= 0) return null;
  const waiting = Math.min(100, (ttfb / total) * 100);
  return (
    <div
      className="min-w-40 flex-1"
      aria-label={`Waiting ${formatMs(ttfb)}, downloading ${formatMs(Math.max(0, total - ttfb))}`}
    >
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
        <span className="h-full bg-accent/45" style={{ width: `${waiting}%` }} />
        <span className="ml-px h-full flex-1 bg-accent" />
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-ink-faint">
        <span>Waiting {formatMs(ttfb)}</span>
        <span>Download {formatMs(Math.max(0, total - ttfb))}</span>
      </div>
    </div>
  );
}

interface ResponsePanelProps {
  response: TesterResponse | null;
  sending: boolean;
  startedAt: number | null;
  /** Store a token found in the body as {{accessToken}}; null when there is no active environment. */
  onSaveToken: ((token: string) => void) | null;
  savingToken: boolean;
}

export function ResponsePanel({ response, sending, startedAt, onSaveToken, savingToken }: ResponsePanelProps) {
  const toast = useToast();
  const [tab, setTab] = useState<ResponseTab>('body');
  const [format, setFormat] = useState<'pretty' | 'raw'>('pretty');
  const result = response?.result ?? null;

  const kind = result ? bodyKind(result) : 'empty';
  const pretty = useMemo(() => (result && kind === 'json' ? prettyJson(result.body) : ''), [result, kind]);
  const token = useMemo(() => (result && kind === 'json' ? findAccessToken(result.body) : null), [result, kind]);

  if (sending) {
    return (
      <div className="grid min-h-64 place-items-center text-center" role="status">
        <div>
          <Spinner className="mx-auto size-6 text-accent" />
          <p className="mt-3 text-sm text-ink">Waiting for the response</p>
          {startedAt !== null ? (
            <p className="mt-1 text-xs text-ink-faint">
              <Elapsed since={startedAt} />
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <EmptyState
        icon={Radio}
        title="Send a request to see the response"
        description="Status, timing, size, headers and body appear here. Every request is also saved to your history."
      />
    );
  }

  if (result.status === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToneBadge tone="fail">No response</ToneBadge>
          <span className="text-[0.8125rem] text-ink-muted">after {formatMs(result.durationMs)}</span>
        </div>
        <EmptyState
          icon={Unplug}
          title={result.error?.message ?? 'The request failed before a response arrived.'}
          description={
            result.error?.code === 'TIMEOUT'
              ? 'Raise the timeout in Settings, or check that the server is up.'
              : result.error?.code === 'DNS_LOOKUP_FAILED'
                ? 'Check the host name for typos.'
                : 'Check that the server is running and the URL, port and protocol are right.'
          }
          compact
        />
      </div>
    );
  }

  const tone = toneForStatus(result.status);
  const body = kind === 'json' && format === 'pretty' ? pretty : result.body;
  const fileName = `${slugify(`${result.method} ${hostAndPath(result.finalUrl)}`)}.${fileExtension(result)}`;

  const copyBody = async () => {
    try {
      await copyText(kind === 'json' ? pretty : result.body);
      toast.success('Response body copied');
    } catch (error) {
      toast.error('Could not copy', error instanceof Error ? error.message : undefined);
    }
  };

  const download = () => {
    if (result.bodyEncoding === 'base64')
      downloadFile(fileName, base64ToBytes(result.body), result.contentType ?? 'application/octet-stream');
    else
      downloadFile(
        fileName,
        kind === 'json' ? pretty : result.body,
        `${result.contentType ?? 'text/plain'};charset=utf-8`,
      );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <ToneBadge tone={tone} className="px-3 py-1 text-[0.8125rem]">
          {result.status} {result.statusText || STATUS_TEXT[result.status] || ''}
        </ToneBadge>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
          <div className="flex gap-1.5">
            <dt className="text-ink-faint">Time</dt>
            <dd className="text-ink tabular-nums">{formatMs(result.durationMs)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-faint">Size</dt>
            <dd className="text-ink tabular-nums">{formatBytes(result.sizeBytes)}</dd>
          </div>
          {result.redirects > 0 ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-faint">Redirects</dt>
              <dd className="text-ink tabular-nums">{result.redirects}</dd>
            </div>
          ) : null}
        </dl>
        <TimingBar total={result.durationMs} ttfb={result.ttfbMs} />
      </div>

      {response?.source === 'history' ? (
        <p className="mt-3 text-xs text-ink-faint">
          From your history, {formatRelative(response.receivedAt)}. Send again for a fresh response.
        </p>
      ) : null}
      {result.finalUrl !== result.requestUrl ? (
        <p className="mt-3 truncate text-xs text-ink-faint" title={result.finalUrl}>
          Ended at <span className="font-mono text-ink-muted">{result.finalUrl}</span>
        </p>
      ) : null}
      {result.truncated ? (
        <p className="mt-3 text-xs text-warn">
          The body was larger than the size limit; only the first {formatBytes(result.sizeBytes)} are shown.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs<ResponseTab>
          idBase="response"
          label="Response details"
          value={tab}
          onChange={setTab}
          size="sm"
          className="flex-1 border-b-0"
          items={[
            { value: 'body', label: 'Body' },
            { value: 'headers', label: 'Headers', badge: result.headers.length },
            { value: 'request', label: 'Request sent' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {token && onSaveToken ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<KeyRound />}
              loading={savingToken}
              onClick={() => onSaveToken(token)}
            >
              Save token as {'{{accessToken}}'}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon={<Clipboard />}
            onClick={() => void copyBody()}
            disabled={!result.body || result.bodyEncoding === 'base64'}
          >
            Copy
          </Button>
          <Button variant="ghost" size="sm" icon={<Download />} onClick={download} disabled={!result.body}>
            Download
          </Button>
        </div>
      </div>
      <div className="border-t border-line" />

      <TabPanel idBase="response" value={tab} className="pt-4">
        {tab === 'body' ? (
          <div className="space-y-3">
            {kind === 'json' ? (
              <SegmentedControl
                label="Body format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'pretty', label: 'Pretty' },
                  { value: 'raw', label: 'Raw' },
                ]}
              />
            ) : null}
            {kind === 'empty' ? (
              <p className="text-[0.8125rem] text-ink-faint">The response has no body.</p>
            ) : kind === 'image' ? (
              <img
                src={`data:${result.contentType ?? 'image/png'};base64,${result.body}`}
                alt="Image returned by the request"
                className="max-h-96 rounded-xl border border-line"
              />
            ) : kind === 'binary' ? (
              <p className="text-[0.8125rem] text-ink-muted">
                Binary content ({result.contentType ?? 'unknown type'}, {formatBytes(result.sizeBytes)}). Use Download
                to save it.
              </p>
            ) : (
              <div className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-[color-mix(in_oklab,var(--canvas-deep)_55%,transparent)] p-4">
                <JsonPreview
                  code={body}
                  language={kind === 'json' && format === 'pretty' ? 'json' : 'text'}
                  wrap={format === 'raw' || kind !== 'json'}
                  className={cn('text-ink-muted', kind !== 'json' && 'text-ink')}
                />
              </div>
            )}
          </div>
        ) : tab === 'headers' ? (
          <HeaderTable headers={result.headers} />
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-xs break-all text-ink">
              <span className="font-semibold">{result.method}</span> {result.requestUrl}
            </p>
            <HeaderTable headers={result.requestHeaders} maskSecrets />
          </div>
        )}
      </TabPanel>
    </div>
  );
}
