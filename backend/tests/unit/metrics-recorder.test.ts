import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { ApiMetricsRecorder, type ApiLogEntry } from '../../src/services/metrics.service.js';

function fakeDb(createMany = vi.fn().mockResolvedValue({ count: 0 })) {
  return { db: { apiLog: { createMany } } as unknown as PrismaClient, createMany };
}

const entry = (statusCode = 200): ApiLogEntry => ({
  method: 'GET',
  path: '/api/status',
  route: '/api/status',
  statusCode,
  durationMs: 1.5,
});

describe('ApiMetricsRecorder', () => {
  it('buffers entries and writes them in one batch on flush', async () => {
    const { db, createMany } = fakeDb();
    const recorder = new ApiMetricsRecorder(db, { flushIntervalMs: 60_000 });

    recorder.record(entry());
    recorder.record(entry(404));
    expect(createMany).not.toHaveBeenCalled();
    expect(recorder.pendingCount).toBe(2);

    await recorder.flush();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(2);
    expect(recorder.pendingCount).toBe(0);
  });

  it('flushes automatically once the batch size is reached', async () => {
    const { db, createMany } = fakeDb();
    const recorder = new ApiMetricsRecorder(db, { flushIntervalMs: 60_000, maxBatchSize: 3 });

    for (let i = 0; i < 3; i += 1) recorder.record(entry());
    await recorder.flush();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(3);
  });

  it('flushes on a timer', async () => {
    vi.useFakeTimers();
    try {
      const { db, createMany } = fakeDb();
      const recorder = new ApiMetricsRecorder(db, { flushIntervalMs: 1_000 });
      recorder.record(entry());
      await vi.advanceTimersByTimeAsync(1_000);
      expect(createMany).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never throws when the database write fails', async () => {
    const { db } = fakeDb(vi.fn().mockRejectedValue(new Error('disk full')));
    const recorder = new ApiMetricsRecorder(db);
    recorder.record(entry());
    await expect(recorder.flush()).resolves.toBeUndefined();
  });

  it('caps the buffer by dropping the oldest entries', async () => {
    const { db, createMany } = fakeDb();
    const recorder = new ApiMetricsRecorder(db, { flushIntervalMs: 60_000, maxBatchSize: 100, maxBufferSize: 2 });
    recorder.record(entry(200));
    recorder.record(entry(201));
    recorder.record(entry(202));
    await recorder.flush();
    const codes = createMany.mock.calls[0]?.[0].data.map((row: ApiLogEntry) => row.statusCode);
    expect(codes).toEqual([201, 202]);
  });
});
