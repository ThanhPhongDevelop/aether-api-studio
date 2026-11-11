#!/usr/bin/env node
/**
 * One-command project setup — works the same on Windows, macOS and Linux.
 *
 *   npm run setup                  env files + Prisma client + migrations + demo data
 *   npm run setup -- --skip-seed   same, without demo data
 *   npm run setup -- --skip-db     only create the .env files
 *
 * Existing .env files are never overwritten.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

const paint = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const cyan = paint(36);
const green = paint(32);
const yellow = paint(33);
const red = paint(31);
const bold = paint(1);
const log = (message) => console.log(`${cyan('[setup]')} ${message}`);

function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 22)) {
    console.warn(yellow(`[setup] Node ${process.versions.node} detected — Node 22.22+ (or 24 LTS+) is required.`));
  }
}

function createEnvFile(workspace, transform = (content) => content) {
  const target = path.join(root, workspace, '.env');
  if (existsSync(target)) {
    log(`${workspace}/.env already exists — kept as is`);
    return;
  }
  const template = readFileSync(path.join(root, workspace, '.env.example'), 'utf8');
  writeFileSync(target, transform(template));
  log(green(`created ${workspace}/.env`));
}

const randomSecret = () => randomBytes(48).toString('base64url');

function run(command) {
  log(bold(`$ ${command}`));
  execSync(command, { cwd: root, stdio: 'inherit' });
}

try {
  checkNodeVersion();

  createEnvFile('backend', (content) =>
    content
      .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${randomSecret()}`)
      .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${randomSecret()}`),
  );
  createEnvFile('frontend');

  if (!args.has('--skip-db')) {
    run('npm run db:generate');
    run('npm run db:deploy');
    if (!args.has('--skip-seed')) run('npm run db:seed');
  }

  console.log(
    `\n${green('✔ Setup complete.')} Start both servers with ${bold('npm run dev')}\n` +
      '  • Web app:  http://localhost:5173\n' +
      '  • REST API: http://localhost:4000/api\n',
  );
} catch (error) {
  console.error(red(`\n✖ Setup failed: ${error instanceof Error ? error.message : String(error)}`));
  console.error('  See the "Troubleshooting" section of README.md.');
  process.exit(1);
}
