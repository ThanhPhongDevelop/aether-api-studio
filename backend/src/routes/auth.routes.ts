import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { createRateLimiter, type RateLimitConfig } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { changePasswordBody, loginBody, registerBody, updateProfileBody } from '../models/auth.model.js';
import { createRouter } from '../utils/router.js';

export function createAuthRouter(limits: RateLimitConfig) {
  const router = createRouter();
  // Credential endpoints get a much tighter per-IP budget than the rest of the API.
  const credentials = createRateLimiter(limits, { message: 'Too many attempts from this address — try again later' });

  router.post('/register', credentials, validate({ body: registerBody }), auth.register);
  router.post('/login', credentials, validate({ body: loginBody }), auth.login);
  router.post('/refresh', auth.refresh);
  router.post('/logout', auth.logout);
  router.post('/logout-all', authenticate, auth.logoutAll);
  router.get('/profile', authenticate, auth.getProfile);
  router.patch('/profile', authenticate, validate({ body: updateProfileBody }), auth.updateProfile);
  router.post(
    '/change-password',
    authenticate,
    credentials,
    validate({ body: changePasswordBody }),
    auth.changePassword,
  );
  return router;
}
