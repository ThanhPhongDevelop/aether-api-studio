import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

let decoyHash: Promise<string> | undefined;

/**
 * Spend the same time as a real password check when the account does not exist,
 * so response timing cannot reveal which emails are registered.
 */
export async function equalizeTiming(plain: string): Promise<void> {
  decoyHash ??= bcrypt.hash('aether-timing-decoy', env.BCRYPT_SALT_ROUNDS);
  await bcrypt.compare(plain, await decoyHash);
}
