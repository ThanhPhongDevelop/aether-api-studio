import { createRequire } from 'node:module';
import { pino, type LoggerOptions } from 'pino';
import { env, isDevelopment } from './env.js';

function canResolve(specifier: string): boolean {
  try {
    createRequire(import.meta.url).resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

const options: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'aether-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write credentials to the logs, even by accident.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
};

// Human-friendly output in development; structured JSON everywhere else.
if (isDevelopment && canResolve('pino-pretty')) {
  options.transport = {
    target: 'pino-pretty',
    // The access-log message already contains method, URL, status and timing.
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env,req,res,responseTime' },
  };
}

export const logger = pino(options);
