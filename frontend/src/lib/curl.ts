/**
 * Import and export of cURL commands for the API Tester.
 *
 * The parser understands what browsers' "Copy as cURL (bash)" and API docs
 * produce: quoted arguments, `$'…'` strings, line continuations, combined short
 * flags (`-sSL`, `-XPOST`) and the common request options.
 */
import type { BodyType, KeyValue, RequestAuth } from '@/types/models';
import { isHttpMethod, type HttpMethod } from './http';

export interface CurlRequest {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  bodyType: BodyType;
  body: string;
  auth: RequestAuth;
  /** Options that were understood but cannot be reproduced exactly. */
  warnings: string[];
}

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurlParseError';
  }
}

const ANSI_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' };

/** Split a shell command line into arguments, honouring bash quoting rules. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const text = input.replace(/\\\r?\n/g, ' ');
  let current = '';
  let hasToken = false;
  let index = 0;

  const readHex = (length: number) => {
    const digits = text.slice(index + 2, index + 2 + length);
    return new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)
      ? String.fromCharCode(Number.parseInt(digits, 16))
      : null;
  };

  while (index < text.length) {
    const char = text[index]!;

    if (/\s/.test(char)) {
      if (hasToken) tokens.push(current);
      current = '';
      hasToken = false;
      index += 1;
    } else if (char === '$' && text[index + 1] === "'") {
      // ANSI-C quoting: $'line one\nline two'
      index += 2;
      hasToken = true;
      while (index < text.length && text[index] !== "'") {
        if (text[index] === '\\' && index + 1 < text.length) {
          const next = text[index + 1]!;
          const hex = next === 'x' ? readHex(2) : next === 'u' ? readHex(4) : null;
          if (hex !== null) {
            current += hex;
            index += next === 'x' ? 4 : 6;
          } else {
            current += ANSI_ESCAPES[next] ?? next;
            index += 2;
          }
        } else {
          current += text[index];
          index += 1;
        }
      }
      if (index >= text.length) throw new CurlParseError("A $'…' string is missing its closing quote.");
      index += 1;
    } else if (char === "'") {
      const end = text.indexOf("'", index + 1);
      if (end === -1) throw new CurlParseError('A single-quoted value is missing its closing quote.');
      current += text.slice(index + 1, end);
      hasToken = true;
      index = end + 1;
    } else if (char === '"') {
      index += 1;
      hasToken = true;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === '\\' && index + 1 < text.length && '"\\$`'.includes(text[index + 1]!)) {
          current += text[index + 1];
          index += 2;
        } else {
          current += text[index];
          index += 1;
        }
      }
      if (index >= text.length) throw new CurlParseError('A double-quoted value is missing its closing quote.');
      index += 1;
    } else if (char === '\\' && index + 1 < text.length) {
      current += text[index + 1];
      hasToken = true;
      index += 2;
    } else {
      current += char;
      hasToken = true;
      index += 1;
    }
  }

  if (hasToken) tokens.push(current);
  return tokens;
}

type OptionKind =
  | 'method'
  | 'header'
  | 'data'
  | 'data-raw'
  | 'data-urlencode'
  | 'json'
  | 'user'
  | 'user-agent'
  | 'referer'
  | 'cookie'
  | 'url'
  | 'form'
  | 'ignore';

/** Options that consume a value, by every name curl accepts. */
const OPTIONS: Record<string, OptionKind> = {
  '-X': 'method',
  '--request': 'method',
  '-H': 'header',
  '--header': 'header',
  '-d': 'data',
  '--data': 'data',
  '--data-ascii': 'data',
  '--data-binary': 'data-raw',
  '--data-raw': 'data-raw',
  '--data-urlencode': 'data-urlencode',
  '--json': 'json',
  '-u': 'user',
  '--user': 'user',
  '-A': 'user-agent',
  '--user-agent': 'user-agent',
  '-e': 'referer',
  '--referer': 'referer',
  '-b': 'cookie',
  '--cookie': 'cookie',
  '--url': 'url',
  '-F': 'form',
  '--form': 'form',
  '-o': 'ignore',
  '--output': 'ignore',
  '-m': 'ignore',
  '--max-time': 'ignore',
  '--connect-timeout': 'ignore',
  '-w': 'ignore',
  '--write-out': 'ignore',
  '-x': 'ignore',
  '--proxy': 'ignore',
  '--retry': 'ignore',
  '--cacert': 'ignore',
  '--cert': 'ignore',
  '--key': 'ignore',
  '-c': 'ignore',
  '--cookie-jar': 'ignore',
};

function splitHeader(raw: string): KeyValue | null {
  const colon = raw.indexOf(':');
  if (colon <= 0) return null;
  return { key: raw.slice(0, colon).trim(), value: raw.slice(colon + 1).trim(), enabled: true };
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!/^[[{]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function decodeBase64(value: string): string | null {
  try {
    return atob(value);
  } catch {
    return null;
  }
}

export function parseCurl(command: string): CurlRequest {
  const tokens = tokenize(command.trim());
  if (tokens[0] !== 'curl') throw new CurlParseError('Paste a command that starts with "curl".');

  const headers: KeyValue[] = [];
  const data: string[] = [];
  const warnings: string[] = [];
  let method: string | null = null;
  let url: string | null = null;
  let auth: RequestAuth = { type: 'NONE' };
  let useGet = false;
  let head = false;
  let jsonFlag = false;

  const apply = (kind: OptionKind, value: string) => {
    switch (kind) {
      case 'method':
        method = value.toUpperCase();
        break;
      case 'header': {
        const header = splitHeader(value);
        if (header) headers.push(header);
        else warnings.push(`Skipped a header without a name: "${value}".`);
        break;
      }
      case 'data':
        if (value.startsWith('@')) warnings.push(`"${value}" reads a file; paste the file's content into the body.`);
        data.push(value.replace(/\r?\n/g, '')); // curl strips newlines from -d values
        break;
      case 'data-raw':
        data.push(value);
        break;
      case 'data-urlencode': {
        const equals = value.indexOf('=');
        data.push(
          equals === -1
            ? encodeURIComponent(value)
            : `${value.slice(0, equals)}=${encodeURIComponent(value.slice(equals + 1))}`,
        );
        break;
      }
      case 'json':
        data.push(value);
        jsonFlag = true;
        break;
      case 'user': {
        const colon = value.indexOf(':');
        auth =
          colon === -1
            ? { type: 'BASIC', username: value, password: '' }
            : { type: 'BASIC', username: value.slice(0, colon), password: value.slice(colon + 1) };
        break;
      }
      case 'user-agent':
        headers.push({ key: 'User-Agent', value, enabled: true });
        break;
      case 'referer':
        headers.push({ key: 'Referer', value, enabled: true });
        break;
      case 'cookie':
        if (value.includes('=')) headers.push({ key: 'Cookie', value, enabled: true });
        else warnings.push(`Cookie file "${value}" was ignored.`);
        break;
      case 'url':
        url = value;
        break;
      case 'form':
        warnings.push('Multipart form fields (-F) are not supported; they were left out.');
        break;
      case 'ignore':
        break;
    }
  };

  const flag = (name: string) => {
    if (name === '-G' || name === '--get') useGet = true;
    if (name === '-I' || name === '--head') head = true;
    // Everything else (-s, -L, -k, --compressed, …) does not change the request.
  };

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const next = () => {
      const value = tokens[++i];
      if (value === undefined) throw new CurlParseError(`${token} needs a value.`);
      return value;
    };

    if (token.startsWith('--')) {
      const equals = token.indexOf('=');
      const name = equals === -1 ? token : token.slice(0, equals);
      const kind = OPTIONS[name];
      if (kind) apply(kind, equals === -1 ? next() : token.slice(equals + 1));
      else flag(name);
    } else if (/^-[A-Za-z]/.test(token)) {
      // One or more short options: -sSL, -XPOST, -H'Accept: */*'
      for (let letter = 1; letter < token.length; letter += 1) {
        const name = `-${token[letter]}`;
        const kind = OPTIONS[name];
        if (kind) {
          const rest = token.slice(letter + 1);
          apply(kind, rest || next());
          break;
        }
        flag(name);
      }
    } else if (url === null) {
      url = token;
    } else {
      warnings.push(`Ignored extra argument "${token}".`);
    }
  }

  let target = url as string | null;
  if (!target) throw new CurlParseError('The command has no URL.');
  if (!/^https?:\/\//i.test(target) && !target.startsWith('{{')) target = `http://${target}`;

  let body = jsonFlag ? data.join('') : data.join('&');
  if (jsonFlag) {
    if (!headers.some((h) => h.key.toLowerCase() === 'content-type'))
      headers.push({ key: 'Content-Type', value: 'application/json', enabled: true });
    if (!headers.some((h) => h.key.toLowerCase() === 'accept'))
      headers.push({ key: 'Accept', value: 'application/json', enabled: true });
  }

  if (useGet && body) {
    target += (target.includes('?') ? '&' : '?') + body;
    body = '';
  }

  // An Authorization header becomes the Auth tab, where it can use variables.
  const authorization = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
  if (authorization !== -1) {
    const value = headers[authorization]!.value;
    const bearer = /^Bearer\s+(.+)$/i.exec(value);
    const basic = /^Basic\s+(.+)$/i.exec(value);
    const decoded = basic ? decodeBase64(basic[1]!.trim()) : null;
    if (bearer) {
      auth = { type: 'BEARER', token: bearer[1]!.trim() };
      headers.splice(authorization, 1);
    } else if (decoded !== null && decoded.includes(':')) {
      const colon = decoded.indexOf(':');
      auth = { type: 'BASIC', username: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
      headers.splice(authorization, 1);
    }
  }

  const resolvedMethod = ((method as string | null) ?? (head ? 'HEAD' : body ? 'POST' : 'GET')).toUpperCase();
  if (!isHttpMethod(resolvedMethod)) throw new CurlParseError(`The method ${resolvedMethod} is not supported.`);

  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() ?? '';
  const isJson = contentType.includes('json') || (!contentType && looksLikeJson(body));
  if (body && !contentType && !isJson) {
    // What curl itself sends for -d without a Content-Type.
    headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true });
  }

  let bodyType: BodyType = 'NONE';
  if (body) bodyType = isJson ? 'JSON' : 'RAW';
  if (bodyType === 'JSON' && looksLikeJson(body)) body = JSON.stringify(JSON.parse(body), null, 2);

  return { method: resolvedMethod, url: target, headers, bodyType, body, auth, warnings };
}

// ─── Export ───────────────────────────────────────────────────────────────────

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export interface CurlSource {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean }>;
  bodyType: BodyType;
  body: string | null;
  auth: RequestAuth;
}

/** A copy-pasteable bash command for the (already interpolated) request. */
export function toCurl(request: CurlSource): string {
  const lines = [`curl${request.method === 'GET' ? '' : ` -X ${request.method}`} ${quote(request.url)}`];
  const activeHeaders = request.headers.filter((header) => header.enabled !== false && header.key);

  for (const header of activeHeaders) lines.push(`-H ${quote(`${header.key}: ${header.value}`)}`);
  if (request.auth.type === 'BEARER') lines.push(`-H ${quote(`Authorization: Bearer ${request.auth.token}`)}`);
  if (request.auth.type === 'BASIC') lines.push(`-u ${quote(`${request.auth.username}:${request.auth.password}`)}`);

  if (request.bodyType !== 'NONE' && request.body) {
    const hasContentType = activeHeaders.some((header) => header.key.toLowerCase() === 'content-type');
    if (request.bodyType === 'JSON' && !hasContentType) lines.push(`-H ${quote('Content-Type: application/json')}`);
    lines.push(`--data-raw ${quote(request.body)}`);
  }
  return lines.join(' \\\n  ');
}
