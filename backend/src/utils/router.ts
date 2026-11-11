import { Router } from 'express';

/**
 * Create an Express router that remembers its full mount path in
 * `res.locals.routeBase`. Express resets `req.baseUrl` while an error bubbles
 * up, so metrics would otherwise lose the prefix of failed requests
 * (e.g. `/api/users/:id` would be logged as `/:id`).
 */
export function createRouter(): Router {
  const router = Router();
  router.use((req, res, next) => {
    res.locals.routeBase = req.baseUrl;
    next();
  });
  return router;
}
