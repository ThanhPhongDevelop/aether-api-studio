import { createElement, type ReactNode } from 'react';

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
const VARIABLE = /\{\{\s*[A-Za-z0-9_.-]+\s*\}\}/g;

/** Above this size, highlighting costs more than it helps; text is shown plain. */
export const HIGHLIGHT_LIMIT = 200_000;

/**
 * Tokenize JSON into coloured spans. React elements only — never innerHTML —
 * so a response body can never inject markup into the page.
 */
export function highlightJson(source: string): ReactNode[] {
  if (source.length > HIGHLIGHT_LIMIT) return [source];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of source.matchAll(JSON_TOKEN)) {
    const [token, quoted, colon] = match;
    const index = match.index;
    if (index > cursor) nodes.push(source.slice(cursor, index));

    if (quoted && colon) {
      nodes.push(createElement('span', { key: key++, className: 'text-accent' }, quoted), colon);
    } else {
      const className = quoted ? 'text-ok' : /^(true|false|null)$/.test(token) ? 'text-flux' : 'text-warn';
      nodes.push(createElement('span', { key: key++, className }, token));
    }
    cursor = index + token.length;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

/** Mark `{{variables}}` in plain text (raw bodies, headers). */
export function highlightVariables(source: string, isKnown: (name: string) => boolean): ReactNode[] {
  if (source.length > HIGHLIGHT_LIMIT) return [source];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of source.matchAll(VARIABLE)) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const name = match[0].replace(/[{}\s]/g, '');
    nodes.push(
      createElement(
        'span',
        { key: key++, className: isKnown(name) ? 'text-accent' : 'text-warn underline decoration-dotted' },
        match[0],
      ),
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}
