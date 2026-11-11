import { describe, expect, it } from 'vitest';
import { scoreCommand } from './command-score';
import { createInterpolator, findVariables, interpolate } from './interpolate';
import { pageWindow } from './pagination';
import { buildQuery, paramsFromUrl, parseQuery, splitUrl, urlFromParams, type ParamRow } from './query-string';

describe('interpolate', () => {
  const variables = new Map([
    ['baseUrl', 'http://localhost:4000/api'],
    ['id', '7'],
  ]);

  it('replaces known {{variables}}, tolerating inner spaces', () => {
    expect(interpolate('{{baseUrl}}/products/{{ id }}', variables)).toEqual({
      value: 'http://localhost:4000/api/products/7',
      missing: [],
    });
  });

  it('leaves unknown names as typed and reports each once', () => {
    expect(interpolate('{{token}} and {{token}} and {{other}}', variables)).toEqual({
      value: '{{token}} and {{token}} and {{other}}',
      missing: ['token', 'other'],
    });
  });

  it('collects missing names across several fields', () => {
    const interpolator = createInterpolator(variables);
    interpolator.resolve('{{baseUrl}}/{{a}}');
    interpolator.resolve('Bearer {{b}}');
    interpolator.resolve('{{a}}');
    expect(interpolator.missing).toEqual(['a', 'b']);
  });

  it('lists the variables a text uses', () => {
    expect(findVariables('{{a}} {{b.c}} {{a}} {not}')).toEqual(['a', 'b.c']);
  });
});

describe('URL and params sync', () => {
  const rows = (...pairs: Array<[string, string, boolean?]>): ParamRow[] =>
    pairs.map(([key, value, enabled = true], index) => ({ id: `r${index}`, key, value, enabled }));

  it('splits a URL into base, query and fragment', () => {
    expect(splitUrl('https://x.dev/a?b=1&c#top')).toEqual({ base: 'https://x.dev/a', query: 'b=1&c', hash: '#top' });
    expect(splitUrl('{{baseUrl}}/a')).toEqual({ base: '{{baseUrl}}/a', query: '', hash: '' });
  });

  it('parses and builds query strings losslessly', () => {
    const pairs = parseQuery('q=a%20b&flag&empty=&x={{v}}');
    expect(pairs).toEqual([
      { key: 'q', value: 'a%20b' },
      { key: 'flag', value: '' },
      { key: 'empty', value: '' },
      { key: 'x', value: '{{v}}' },
    ]);
    expect(buildQuery(pairs)).toBe('q=a%20b&flag&empty&x={{v}}');
  });

  it('re-reads enabled rows from the URL and keeps disabled rows and row ids', () => {
    const current = rows(['page', '1'], ['debug', 'true', false]);
    const next = paramsFromUrl('https://x.dev/items?page=2&limit=5', current);
    expect(next.map(({ key, value, enabled }) => [key, value, enabled])).toEqual([
      ['page', '2', true],
      ['limit', '5', true],
      ['debug', 'true', false],
    ]);
    expect(next[0]!.id).toBe('r0');
  });

  it('writes enabled rows back into the URL without touching variables', () => {
    expect(urlFromParams('{{baseUrl}}/items?old=1#frag', rows(['page', '{{page}}'], ['skip', 'x', false]))).toBe(
      '{{baseUrl}}/items?page={{page}}#frag',
    );
    expect(urlFromParams('https://x.dev/items?a=1', [])).toBe('https://x.dev/items');
  });
});

describe('scoreCommand', () => {
  it('ranks label prefixes over word starts over substrings over keywords', () => {
    const prefix = scoreCommand({ label: 'Environments' }, 'env');
    const word = scoreCommand({ label: 'Switch environment' }, 'env');
    const keyword = scoreCommand({ label: 'Settings', keywords: 'environment theme' }, 'env');
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(keyword);
    expect(keyword).toBeGreaterThan(0);
  });

  it('requires every term to match', () => {
    expect(scoreCommand({ label: 'API Tester' }, 'api docs')).toBe(0);
    expect(scoreCommand({ label: 'Anything' }, '')).toBe(1);
  });
});

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses distant pages into gaps', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, 'gap', 12]);
    expect(pageWindow(12, 12)).toEqual([1, 'gap', 9, 10, 11, 12]);
  });
});
