import type { AuthUser } from '../models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` / `optionalAuthenticate` middleware. */
      user?: AuthUser;
    }

    interface Locals {
      /** Full mount path of the router that handled the request (see utils/router.ts). */
      routeBase?: string;
      /** Parsed + coerced request parts produced by the `validate()` middleware. */
      validated?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
