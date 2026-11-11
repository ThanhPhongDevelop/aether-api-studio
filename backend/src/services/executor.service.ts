/**
 * The API Tester's request engine: sends a real HTTP request on the server, measures
 * it, and guards against SSRF (server-side request forgery).
 *
 * SSRF protection — a public "fetch any URL" endpoint could otherwise be used to
 * reach internal services or cloud metadata (169.254.169.254):
 *  • only http/https;
 *  • the target is resolved and rejected if any address is private/reserved;
 *  • the same check runs again inside the socket's DNS lookup, so a hostname that
 *    changes its answer between check and connect (DNS rebinding) is still blocked;
 *  • every redirect hop is re-validated; credentials are dropped on cross-origin hops;
 *  • time and response size are capped.
 * Private networks are allowed outside production so the local API can be tested.
 */
import { lookup as lookupCallback, type LookupAddress, type LookupAllOptions } from 'node:dns';
import { lookup as lookupAsync } from 'node:dns/promises';
import http, { type IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { env, executorAllowsPrivateNetworks } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ExecuteInput } from '../models/workspace.model.js';
import { AppError, ErrorCode } from '../utils/app-error.js';
import { roundTo } from '../utils/format.js';
import type { ValidationIssue } from '../utils/validation.js';
import { recordHistory } from './history.service.js';

export interface ExecutorPolicy {
  allowPrivateNetworks: boolean;
  allowedHosts: readonly string[];
  maxResponseBytes: number;
  defaultTimeoutMs: number;
  maxRedirects: number;
}

export const defaultExecutorPolicy = (): ExecutorPolicy => ({
  allowPrivateNetworks: executorAllowsPrivateNetworks,
  allowedHosts: env.EXECUTOR_ALLOWED_HOSTS.map((host) => host.toLowerCase()),
  maxResponseBytes: env.EXECUTOR_MAX_RESPONSE_BYTES,
  defaultTimeoutMs: env.EXECUTOR_TIMEOUT_MS,
  maxRedirects: 5,
});

// A type alias (not an interface) so it is assignable to Prisma's JSON input type.
export type HeaderEntry = {
  key: string;
  value: string;
};

export interface ExecuteResult {
  method: string;
  requestUrl: string;
  finalUrl: string;
  /** HTTP status, or 0 when no response was received. */
  status: number;
  statusText: string;
  ok: boolean;
  headers: HeaderEntry[];
  body: string;
  bodyEncoding: 'utf8' | 'base64';
  contentType: string | null;
  sizeBytes: number;
  headersSizeBytes: number;
  truncated: boolean;
  durationMs: number;
  ttfbMs: number | null;
  redirects: number;
  requestHeaders: HeaderEntry[];
  error: { code: string; message: string } | null;
  historyId: string | null;
}

// ─── Address policy ─────────────────────────────────────────────────────────

const RESERVED = new net.BlockList();
const IPV4_RESERVED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const IPV6_RESERVED: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];
for (const [address, prefix] of IPV4_RESERVED) RESERVED.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of IPV6_RESERVED) RESERVED.addSubnet(address, prefix, 'ipv6');

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true;
  // BlockList also matches IPv4-mapped IPv6 (::ffff:127.0.0.1) against the IPv4 rules.
  return RESERVED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

class BlockedTargetError extends Error {
  readonly host: string;
  constructor(host: string) {
    super(`Blocked target ${host}`);
    this.name = 'BlockedTargetError';
    this.host = host;
  }
}

class ExecutorTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`No complete response within ${timeoutMs} ms`);
    this.name = 'ExecutorTimeoutError';
  }
}

const targetNotAllowed = (host: string) =>
  new AppError(
    400,
    ErrorCode.TARGET_NOT_ALLOWED,
    `Requests to ${host} are blocked because it points to a private or reserved network address`,
  );

const bypassesChecks = (host: string, policy: ExecutorPolicy) =>
  policy.allowPrivateNetworks || policy.allowedHosts.includes(host.toLowerCase());

function guardedLookup(policy: ExecutorPolicy): net.LookupFunction {
  return ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    lookupCallback(hostname, { ...options, all: true } as LookupAllOptions, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error);
      if (!bypassesChecks(hostname, policy) && addresses.some((entry) => isPrivateAddress(entry.address))) {
        return callback(new BlockedTargetError(hostname));
      }
      if (options.all) return callback(null, addresses);
      return callback(null, addresses[0]?.address, addresses[0]?.family);
    });
  }) as unknown as net.LookupFunction;
}

async function assertTargetAllowed(url: URL, policy: ExecutorPolicy): Promise<void> {
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  if (bypassesChecks(host, policy)) return;
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw targetNotAllowed(url.host);
    return;
  }
  let addresses: LookupAddress[];
  try {
    addresses = await lookupAsync(host, { all: true });
  } catch {
    return; // Unresolvable: the request itself will report the DNS failure.
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw targetNotAllowed(url.host);
}

// ─── Request preparation ────────────────────────────────────────────────────

const USER_AGENT = 'AetherApiStudio/1.0 (+https://github.com)';
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const MANAGED_HEADERS = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-connection',
]);
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key']);
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const HISTORY_TEXT_LIMIT = 64 * 1024;

type Headers = Record<string, string>;

const findHeader = (headers: Headers, name: string) =>
  Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());

function setHeader(headers: Headers, name: string, value: string) {
  const existing = findHeader(headers, name);
  if (existing) delete headers[existing];
  headers[name] = value;
}

function withoutHeaders(headers: Headers, names: string[]): Headers {
  const drop = new Set(names);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !drop.has(key.toLowerCase())));
}

function buildUrl(raw: string, input: ExecuteInput): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw AppError.validation([
      {
        path: 'body.url',
        message: 'must be an absolute URL such as https://api.example.com/users',
        code: 'invalid_url',
      },
    ]);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw AppError.validation([
      { path: 'body.url', message: 'only http:// and https:// URLs are supported', code: 'invalid_protocol' },
    ]);
  }
  for (const param of input.queryParams) {
    if (param.enabled && param.key.trim()) url.searchParams.append(param.key.trim(), param.value);
  }
  return url;
}

function buildHeaders(input: ExecuteInput, body: Buffer | null): Headers {
  const headers: Headers = {};
  const issues: ValidationIssue[] = [];

  input.headers.forEach((header, index) => {
    const name = header.key.trim();
    if (!header.enabled || !name) return;
    if (!HEADER_NAME.test(name)) {
      issues.push({ path: `body.headers.${index}.key`, message: 'is not a valid header name', code: 'invalid_header' });
    } else if (/[\r\n\0]/.test(header.value)) {
      issues.push({
        path: `body.headers.${index}.value`,
        message: 'must not contain line breaks',
        code: 'invalid_header',
      });
    } else if (!MANAGED_HEADERS.has(name.toLowerCase())) {
      setHeader(headers, name, header.value);
    }
  });

  if (input.auth.type === 'BEARER' && input.auth.token.trim()) {
    if (/[\r\n\0]/.test(input.auth.token)) {
      issues.push({ path: 'body.auth.token', message: 'must not contain line breaks', code: 'invalid_header' });
    } else {
      setHeader(headers, 'Authorization', `Bearer ${input.auth.token.trim()}`);
    }
  } else if (input.auth.type === 'BASIC') {
    const credentials = Buffer.from(`${input.auth.username}:${input.auth.password}`, 'utf8').toString('base64');
    setHeader(headers, 'Authorization', `Basic ${credentials}`);
  }
  if (issues.length > 0) throw AppError.validation(issues);

  if (!findHeader(headers, 'user-agent')) headers['User-Agent'] = USER_AGENT;
  if (!findHeader(headers, 'accept')) headers.Accept = '*/*';
  if (!findHeader(headers, 'accept-encoding')) headers['Accept-Encoding'] = 'gzip, deflate, br';
  if (body) {
    if (!findHeader(headers, 'content-type')) {
      headers['Content-Type'] = input.bodyType === 'JSON' ? 'application/json' : 'text/plain; charset=utf-8';
    }
    headers['Content-Length'] = String(body.length);
  }
  return headers;
}

// ─── Transport ──────────────────────────────────────────────────────────────

interface RawResponse {
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  rawHeaders: string[];
  body: Buffer;
  truncated: boolean;
  ttfbMs: number;
}

function sendOnce(
  url: URL,
  method: string,
  headers: Headers,
  body: Buffer | null,
  policy: ExecutorPolicy,
  deadline: number,
  timeoutMs: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const started = performance.now();
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const request = transport.request(
      url,
      { method, headers, lookup: guardedLookup(policy), agent: false },
      (response) => {
        const ttfbMs = performance.now() - started;
        const chunks: Buffer[] = [];
        let received = 0;
        let truncated = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            statusCode: response.statusCode ?? 0,
            statusMessage: response.statusMessage ?? '',
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            body: Buffer.concat(chunks),
            truncated,
            ttfbMs,
          });
        };

        response.on('data', (chunk: Buffer) => {
          if (truncated) return;
          const room = policy.maxResponseBytes - received;
          received += chunk.length;
          if (chunk.length > room) {
            chunks.push(chunk.subarray(0, Math.max(0, room)));
            truncated = true;
            response.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', finish);
        response.on('error', (error) => (truncated ? finish() : fail(error)));
      },
    );

    const timer = setTimeout(
      () => request.destroy(new ExecutorTimeoutError(timeoutMs)),
      Math.max(0, deadline - Date.now()),
    );
    request.on('error', fail);
    if (body) request.write(body);
    request.end();
  });
}

const TEXTUAL_TYPE =
  /^(text\/|application\/(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|[\w.-]+\+(json|xml))|image\/svg\+xml)/i;

function decodeContent(raw: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  const options = { maxOutputLength: maxBytes };
  try {
    switch (encoding?.trim().toLowerCase()) {
      case 'gzip':
      case 'x-gzip':
        return zlib.gunzipSync(raw, options);
      case 'deflate':
        try {
          return zlib.inflateSync(raw, options);
        } catch {
          return zlib.inflateRawSync(raw, options);
        }
      case 'br':
        return zlib.brotliDecompressSync(raw, options);
      default:
        return raw;
    }
  } catch {
    return raw; // Truncated or malformed compressed data: show the bytes as received.
  }
}

function toHeaderEntries(rawHeaders: string[]): HeaderEntry[] {
  const entries: HeaderEntry[] = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    entries.push({ key: rawHeaders[index]!, value: rawHeaders[index + 1]! });
  }
  return entries;
}

function describeNetworkError(error: unknown, url: URL): { code: string; message: string } {
  if (error instanceof ExecutorTimeoutError) return { code: 'TIMEOUT', message: error.message };
  const code = (error as NodeJS.ErrnoException).code ?? '';
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return { code: 'DNS_LOOKUP_FAILED', message: `Could not resolve host ${url.hostname}` };
    case 'ECONNREFUSED':
      return { code: 'CONNECTION_REFUSED', message: `Connection refused by ${url.host}` };
    case 'ECONNRESET':
    case 'EPIPE':
      return { code: 'CONNECTION_RESET', message: 'The server closed the connection unexpectedly' };
    case 'ETIMEDOUT':
      return { code: 'TIMEOUT', message: `Connection to ${url.host} timed out` };
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return { code: 'HOST_UNREACHABLE', message: `${url.host} is unreachable` };
    default:
      if (/CERT|SSL|TLS/i.test(code)) return { code: 'TLS_ERROR', message: `TLS handshake failed: ${code}` };
      return { code: code || 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Network error' };
  }
}

const truncateText = (value: string | null, limit = HISTORY_TEXT_LIMIT) =>
  value === null ? null : value.length > limit ? `${value.slice(0, limit)}…` : value;

const maskHeaders = (headers: Headers): HeaderEntry[] =>
  Object.entries(headers).map(([key, value]) => ({
    key,
    value: SENSITIVE_HEADERS.has(key.toLowerCase()) ? '••••••' : value,
  }));

// ─── Public API ─────────────────────────────────────────────────────────────

export async function executeRequest(
  input: ExecuteInput,
  options: { userId?: number; policy?: ExecutorPolicy } = {},
): Promise<ExecuteResult> {
  const policy = options.policy ?? defaultExecutorPolicy();
  const timeoutMs = input.timeoutMs ?? policy.defaultTimeoutMs;
  const requestUrl = buildUrl(input.url, input);
  const payload =
    input.bodyType !== 'NONE' && input.body !== null && input.body !== '' && input.method !== 'HEAD'
      ? Buffer.from(input.body, 'utf8')
      : null;
  const initialHeaders = buildHeaders(input, payload);

  const deadline = Date.now() + timeoutMs;
  const started = performance.now();
  let currentUrl = requestUrl;
  let redirects = 0;

  const perform = async (): Promise<ExecuteResult> => {
    let method: string = input.method;
    let headers = initialHeaders;
    let body = payload;
    for (;;) {
      await assertTargetAllowed(currentUrl, policy);
      const raw = await sendOnce(currentUrl, method, headers, body, policy, deadline, timeoutMs);
      const location = raw.headers.location;

      if (input.followRedirects && REDIRECT_CODES.has(raw.statusCode) && location && redirects < policy.maxRedirects) {
        const next = new URL(location, currentUrl);
        redirects += 1;
        if (raw.statusCode === 303 || ((raw.statusCode === 301 || raw.statusCode === 302) && method === 'POST')) {
          method = 'GET';
          body = null;
          headers = withoutHeaders(headers, ['content-type', 'content-length']);
        }
        if (next.origin !== currentUrl.origin) headers = withoutHeaders(headers, ['authorization', 'cookie']);
        currentUrl = next;
        continue;
      }

      const contentEncoding = raw.headers['content-encoding'];
      const decoded = raw.truncated ? raw.body : decodeContent(raw.body, contentEncoding, policy.maxResponseBytes);
      const contentType = raw.headers['content-type'] ?? null;
      const textual = contentType ? TEXTUAL_TYPE.test(contentType) : !decoded.subarray(0, 1024).includes(0);

      return {
        method: input.method,
        requestUrl: requestUrl.toString(),
        finalUrl: currentUrl.toString(),
        status: raw.statusCode,
        statusText: raw.statusMessage || http.STATUS_CODES[raw.statusCode] || '',
        ok: raw.statusCode >= 200 && raw.statusCode < 300,
        headers: toHeaderEntries(raw.rawHeaders),
        body: textual ? decoded.toString('utf8') : decoded.toString('base64'),
        bodyEncoding: textual ? 'utf8' : 'base64',
        contentType,
        sizeBytes: decoded.length,
        headersSizeBytes: raw.rawHeaders.reduce((total, part) => total + Buffer.byteLength(part) + 2, 0),
        truncated: raw.truncated,
        durationMs: 0,
        ttfbMs: roundTo(raw.ttfbMs, 2),
        redirects,
        requestHeaders: Object.entries(headers).map(([key, value]) => ({ key, value })),
        error: null,
        historyId: null,
      };
    }
  };

  let result: ExecuteResult;
  try {
    result = await perform();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof BlockedTargetError) throw targetNotAllowed(error.host);
    result = {
      method: input.method,
      requestUrl: requestUrl.toString(),
      finalUrl: currentUrl.toString(),
      status: 0,
      statusText: '',
      ok: false,
      headers: [],
      body: '',
      bodyEncoding: 'utf8',
      contentType: null,
      sizeBytes: 0,
      headersSizeBytes: 0,
      truncated: false,
      durationMs: 0,
      ttfbMs: null,
      redirects,
      requestHeaders: Object.entries(initialHeaders).map(([key, value]) => ({ key, value })),
      error: describeNetworkError(error, currentUrl),
      historyId: null,
    };
  }
  result.durationMs = roundTo(performance.now() - started, 2);

  if (options.userId && input.saveToHistory) {
    result.historyId = await recordHistory(options.userId, {
      method: input.method,
      url: requestUrl.toString(),
      requestHeaders: maskHeaders(initialHeaders) as Prisma.InputJsonValue,
      bodyType: input.bodyType,
      requestBody: truncateText(input.body),
      statusCode: result.error ? null : result.status,
      statusText: result.error ? null : result.statusText,
      durationMs: Math.round(result.durationMs),
      responseSize: result.sizeBytes,
      responseHeaders: result.headers as Prisma.InputJsonValue,
      responseBody:
        result.bodyEncoding === 'utf8' ? truncateText(result.body) : `[binary content, ${result.sizeBytes} bytes]`,
      errorMessage: result.error?.message ?? null,
    });
  }
  return result;
}
