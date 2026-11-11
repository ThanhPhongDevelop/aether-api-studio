import { afterAll } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { apiMetricsRecorder } from '../../src/services/metrics.service.js';

// Each test file runs in its own module scope with its own Prisma client.
afterAll(async () => {
  await apiMetricsRecorder?.stop();
  await prisma.$disconnect();
});
