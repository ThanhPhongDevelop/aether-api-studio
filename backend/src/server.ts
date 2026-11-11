import { createServer } from 'node:http';
import { createApp } from './app.js';
import { prisma } from './config/database.js';
import { env, hasPlaceholderSecrets } from './config/env.js';
import { logger } from './config/logger.js';
import { apiMetricsRecorder } from './services/metrics.service.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createServer(createApp());

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.fatal(`Port ${env.PORT} is already in use. Stop the other process or change PORT in backend/.env.`);
  } else {
    logger.fatal({ err: error }, 'HTTP server failed');
  }
  process.exit(1);
});

async function verifyDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.count();
  } catch (error) {
    logger.error(
      { err: error },
      'Database is not ready. Run "npm run setup" (or "npm run db:deploy && npm run db:seed") and restart.',
    );
  }
}

async function start(): Promise<void> {
  if (hasPlaceholderSecrets(env)) {
    logger.warn(
      'JWT secrets still use the placeholder values from .env.example — run "npm run setup" to generate strong ones.',
    );
  }

  await verifyDatabase();

  if (apiMetricsRecorder) {
    apiMetricsRecorder
      .prune(env.METRICS_RETENTION_DAYS)
      .then(
        (removed) =>
          removed > 0 && logger.info(`Pruned ${removed} API log rows older than ${env.METRICS_RETENTION_DAYS} days`),
      )
      .catch((err: unknown) => logger.warn({ err }, 'Could not prune old API logs'));
  }

  server.listen({ port: env.PORT, host: env.HOST }, () => {
    logger.info(`${env.APP_NAME} ready on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (error) => {
    await apiMetricsRecorder?.stop();
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
  server.closeIdleConnections();
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — exiting');
  process.exit(1);
});

void start();
