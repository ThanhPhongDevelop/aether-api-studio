/** Helpers for showing and exporting what the executor returned. */
import type { ExecuteResult } from '@/types/models';

export type BodyKind = 'json' | 'html' | 'xml' | 'text' | 'image' | 'binary' | 'empty';

export function bodyKind(result: Pick<ExecuteResult, 'body' | 'bodyEncoding' | 'contentType'>): BodyKind {
  const type = (result.contentType ?? '').toLowerCase();
  if (result.bodyEncoding === 'base64') return type.startsWith('image/') ? 'image' : 'binary';
  if (!result.body) return 'empty';
  if (type.includes('json') || looksLikeJson(result.body)) return 'json';
  if (type.includes('html')) return 'html';
  if (type.includes('xml')) return 'xml';
  return 'text';
}

export function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Indented JSON, or the original text when it does not parse. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** Where a JSON parse failed, as "line 3, column 7", for the body editor. */
export function jsonError(text: string): string | null {
  if (!text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const position = /position (\d+)/i.exec(message);
    if (position) {
      const index = Number(position[1]);
      const before = text.slice(0, index).split('\n');
      return `${message.replace(/\s*\(?(in JSON )?at position \d+.*$/i, '')} — line ${before.length}, column ${before.at(-1)!.length + 1}`;
    }
    return message.replace(/^JSON\.parse: /, '');
  }
}

const TOKEN_PATHS = [
  ['data', 'accessToken'],
  ['accessToken'],
  ['access_token'],
  ['token'],
  ['data', 'token'],
  ['data', 'access_token'],
];

/** An access token in a JSON response (login endpoints), if there is one. */
export function findAccessToken(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  for (const path of TOKEN_PATHS) {
    let node: unknown = parsed;
    for (const key of path)
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
    if (typeof node === 'string' && node.length >= 16) return node;
  }
  return null;
}

const EXTENSIONS: Record<BodyKind, string> = {
  json: 'json',
  html: 'html',
  xml: 'xml',
  text: 'txt',
  image: 'img',
  binary: 'bin',
  empty: 'txt',
};

export function fileExtension(result: Pick<ExecuteResult, 'body' | 'bodyEncoding' | 'contentType'>): string {
  const kind = bodyKind(result);
  if (kind === 'image') return (result.contentType ?? 'image/png').split('/')[1]?.split(/[;+]/)[0] ?? 'png';
  return EXTENSIONS[kind];
}

const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key']);

export const isSensitiveHeader = (name: string) => SENSITIVE_HEADERS.has(name.toLowerCase());
