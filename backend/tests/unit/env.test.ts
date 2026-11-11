import { describe, expect, it } from 'vitest';
import { hasPlaceholderSecrets, parseEnv } from '../../src/config/env.js';

const base = {
  DATABASE_URL: 'file:./data/unit.db',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
};

describe('parseEnv', () => {
  it('applies sensible defaults', () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      CORS_ORIGINS: ['http://localhost:5173'],
      TRUST_PROXY: 0,
      BCRYPT_SALT_ROUNDS: 12,
      METRICS_ENABLED: true,
      JWT_ACCESS_EXPIRES_IN: '15m',
    });
  });

  it('coerces numbers and booleans from strings', () => {
    const env = parseEnv({ ...base, PORT: '8080', TRUST_PROXY: '1', METRICS_ENABLED: 'false' });
    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.METRICS_ENABLED).toBe(false);
  });

  it('splits, trims and normalizes CORS origins', () => {
    const env = parseEnv({ ...base, CORS_ORIGINS: 'http://a.test/, https://b.test ,' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
  });

  it('rejects invalid CORS origins', () => {
    expect(() => parseEnv({ ...base, CORS_ORIGINS: 'not-a-url' })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects a short JWT secret with an actionable message', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET: must be at least 32 characters[\s\S]*npm run setup/,
    );
  });

  it('rejects a missing JWT secret', () => {
    const { JWT_REFRESH_SECRET: _omitted, ...withoutRefresh } = base;
    expect(() => parseEnv(withoutRefresh)).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => parseEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow(/must be different/);
  });

  it('only accepts SQLite database URLs', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: 'postgresql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('rejects malformed token durations', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_EXPIRES_IN: 'fifteen minutes' })).toThrow(/JWT_ACCESS_EXPIRES_IN/);
  });

  it('treats an empty PUBLIC_API_URL as unset and validates a given one', () => {
    expect(parseEnv({ ...base, PUBLIC_API_URL: '' }).PUBLIC_API_URL).toBeUndefined();
    expect(parseEnv({ ...base, PUBLIC_API_URL: 'https://aether.example.com/api' }).PUBLIC_API_URL).toBe(
      'https://aether.example.com/api',
    );
    expect(() => parseEnv({ ...base, PUBLIC_API_URL: 'not a url' })).toThrow(/PUBLIC_API_URL/);
  });

  it('refuses placeholder secrets in production only', () => {
    const placeholders = {
      ...base,
      JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-token-secret',
      JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-token-secret',
    };
    expect(() => parseEnv(placeholders)).not.toThrow();
    expect(() => parseEnv({ ...placeholders, NODE_ENV: 'production' })).toThrow(/placeholder secrets/);
  });
});

describe('hasPlaceholderSecrets', () => {
  it('detects the .env.example placeholders', () => {
    expect(hasPlaceholderSecrets({ JWT_ACCESS_SECRET: 'replace-with-xyz', JWT_REFRESH_SECRET: 'b'.repeat(40) })).toBe(
      true,
    );
    expect(hasPlaceholderSecrets({ JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) })).toBe(
      false,
    );
  });
});
