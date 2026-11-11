/**
 * Two-way sync between the URL field and the Params table of the API Tester.
 *
 * The URL text is the source of truth for enabled parameters; disabled rows live
 * only in the table. Values are kept exactly as typed (no decoding/encoding), so
 * `{{variables}}` and pre-encoded values survive a round trip untouched — the
 * server encodes whatever still needs it when the request is sent.
 */

export interface ParamRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

let sequence = 0;
/** Stable keys for editable rows (works in insecure contexts, unlike crypto.randomUUID). */
export const rowId = () => `row-${++sequence}`;

export function splitUrl(url: string): { base: string; query: string; hash: string } {
  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return { base: withoutHash, query: '', hash };
  return { base: withoutHash.slice(0, queryIndex), query: withoutHash.slice(queryIndex + 1), hash };
}

export function parseQuery(query: string): Array<{ key: string; value: string }> {
  if (!query) return [];
  return query
    .split('&')
    .filter((part) => part !== '')
    .map((part) => {
      const equals = part.indexOf('=');
      return equals === -1 ? { key: part, value: '' } : { key: part.slice(0, equals), value: part.slice(equals + 1) };
    });
}

export function buildQuery(pairs: Array<{ key: string; value: string }>): string {
  return pairs
    .filter((pair) => pair.key !== '' || pair.value !== '')
    .map((pair) => (pair.value === '' ? pair.key : `${pair.key}=${pair.value}`))
    .join('&');
}

/** Rows after the URL was edited: enabled rows re-read from the URL, disabled rows kept. */
export function paramsFromUrl(url: string, current: ParamRow[]): ParamRow[] {
  const pairs = parseQuery(splitUrl(url).query);
  const enabled = current.filter((row) => row.enabled);
  const rows = pairs.map((pair, index) => {
    const previous = enabled[index];
    // Reuse row ids by position so focus stays in the cell being edited.
    return { id: previous?.id ?? rowId(), key: pair.key, value: pair.value, enabled: true };
  });
  return [...rows, ...current.filter((row) => !row.enabled)];
}

/** The URL after the Params table was edited. */
export function urlFromParams(url: string, rows: ParamRow[]): string {
  const { base, hash } = splitUrl(url);
  const query = buildQuery(rows.filter((row) => row.enabled));
  return `${base}${query ? `?${query}` : ''}${hash}`;
}
