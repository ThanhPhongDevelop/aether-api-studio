import { signAccessToken } from '../../src/services/token.service.js';

/** "Bearer <jwt>" for a user, without going through the login endpoint. */
export const bearer = (user: { id: number; role: 'USER' | 'ADMIN' }) => `Bearer ${signAccessToken(user)}`;

/** Extract the refresh cookie ("aether_rt=…") from a response so it can be replayed. */
export function refreshCookie(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'] as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith('aether_rt='));
  if (!cookie) throw new Error('Response did not set a refresh cookie');
  return cookie.split(';')[0]!;
}

/** Paths of every validation issue in an error response. */
export const issuePaths = (response: { body: { error?: { details?: Array<{ path: string }> } } }) =>
  (response.body.error?.details ?? []).map((issue) => issue.path);
