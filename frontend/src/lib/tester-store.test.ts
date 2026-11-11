import { beforeEach, describe, expect, it } from 'vitest';
import type { HistoryDetail } from '@/types/models';
import { draftFrom, draftFromHistory, isDirty, resultFromHistory, testerStore, toSavedInput } from './tester-store';

describe('draftFrom and toSavedInput', () => {
  it('merges the URL query with saved params and splits them again on save', () => {
    const draft = draftFrom({
      name: 'Search',
      method: 'GET',
      url: '{{baseUrl}}/products?category=Audio',
      queryParams: [
        { key: 'limit', value: '5', enabled: true },
        { key: 'debug', value: '1', enabled: false },
      ],
    });
    expect(draft.url).toBe('{{baseUrl}}/products?category=Audio&limit=5');
    expect(draft.params.map((row) => row.key)).toEqual(['category', 'limit', 'debug']);

    const saved = toSavedInput(draft);
    expect(saved.url).toBe('{{baseUrl}}/products');
    expect(saved.queryParams).toEqual([
      { key: 'category', value: 'Audio', enabled: true },
      { key: 'limit', value: '5', enabled: true },
      { key: 'debug', value: '1', enabled: false },
    ]);
    expect(saved.body).toBeNull();
  });
});

describe('draftFromHistory', () => {
  const entry: HistoryDetail = {
    id: 'h1',
    method: 'POST',
    url: 'http://localhost:4000/api/products?dry=1',
    statusCode: 201,
    statusText: 'Created',
    durationMs: 12,
    responseSize: 40,
    errorMessage: null,
    createdAt: '2026-11-06T10:00:00.000Z',
    bodyType: 'JSON',
    requestHeaders: [
      { key: 'Authorization', value: '••••••' },
      { key: 'User-Agent', value: 'AetherApiStudio/1.0' },
      { key: 'Accept', value: '*/*' },
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Content-Length', value: '12' },
      { key: 'X-Trace', value: 'abc' },
    ],
    requestBody: '{"name":"x"}',
    responseHeaders: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
    responseBody: '{"success":true}',
  };

  it('keeps only the headers a person would have typed and flags masked credentials', () => {
    const { draft, droppedCredentials } = draftFromHistory(entry);
    expect(droppedCredentials).toBe(true);
    expect(draft.headers.map((header) => header.key)).toEqual(['X-Trace']);
    expect(draft).toMatchObject({
      method: 'POST',
      bodyType: 'JSON',
      body: '{"name":"x"}',
      name: 'POST localhost:4000/api/products',
    });
    expect(draft.params.map((row) => [row.key, row.value])).toEqual([['dry', '1']]);
  });

  it('rebuilds a viewable result', () => {
    expect(resultFromHistory(entry)).toMatchObject({
      status: 201,
      ok: true,
      contentType: 'application/json; charset=utf-8',
      historyId: 'h1',
    });
    expect(resultFromHistory({ ...entry, statusCode: null, errorMessage: 'Connection refused' })).toMatchObject({
      status: 0,
      ok: false,
      error: { message: 'Connection refused' },
    });
  });
});

describe('testerStore', () => {
  beforeEach(() => testerStore.reset());

  it('keeps the URL and the Params table in sync both ways', () => {
    testerStore.setUrl('https://x.dev/items?page=2');
    expect(testerStore.get().draft.params.map((row) => [row.key, row.value])).toEqual([['page', '2']]);

    const [page] = testerStore.get().draft.params;
    testerStore.setParams([
      { ...page!, value: '3' },
      { id: 'n', key: 'limit', value: '10', enabled: true },
    ]);
    expect(testerStore.get().draft.url).toBe('https://x.dev/items?page=3&limit=10');
  });

  it('tracks unsaved changes against the saved version', () => {
    expect(isDirty(testerStore.get())).toBe(false);
    testerStore.update({ name: 'Renamed' });
    expect(isDirty(testerStore.get())).toBe(true);
    testerStore.markSaved({
      ...toSavedInput(testerStore.get().draft),
      id: 's1',
      name: 'Renamed',
      collectionId: 'c1',
      description: null,
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
    });
    expect(isDirty(testerStore.get())).toBe(false);
    expect(testerStore.get().draft.savedRequestId).toBe('s1');

    testerStore.detach('s1');
    expect(testerStore.get().draft.savedRequestId).toBeNull();
  });

  it('opens and closes the cURL import dialog on request', () => {
    testerStore.openImport();
    expect(testerStore.get().importOpen).toBe(true);
    testerStore.closeImport();
    expect(testerStore.get().importOpen).toBe(false);
  });
});
