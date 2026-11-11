import * as account from '../controllers/account.controller.js';
import * as products from '../controllers/product.controller.js';
import * as users from '../controllers/user.controller.js';
import { authenticate, authorize, optionalAuthenticate, selfOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationListQuery, updateSettingsBody } from '../models/account.model.js';
import { productBody, productListQuery, updateProductBody } from '../models/product.model.js';
import { createUserBody, replaceUserBody, updateUserBody, userListQuery } from '../models/user.model.js';
import { intIdParams, stringIdParams } from '../utils/pagination.js';
import { createRouter } from '../utils/router.js';

// ─── /api/users ─────────────────────────────────────────────────────────────
export const userRouter = createRouter();
userRouter.use(authenticate);
userRouter.get('/', authorize('ADMIN'), validate({ query: userListQuery }), users.list);
userRouter.post('/', authorize('ADMIN'), validate({ body: createUserBody }), users.create);
userRouter.get('/:id', selfOrAdmin, validate({ params: intIdParams }), users.get);
userRouter.put('/:id', selfOrAdmin, validate({ params: intIdParams, body: replaceUserBody }), users.update);
userRouter.patch('/:id', selfOrAdmin, validate({ params: intIdParams, body: updateUserBody }), users.update);
userRouter.delete('/:id', authorize('ADMIN'), validate({ params: intIdParams }), users.remove);

// ─── /api/products ──────────────────────────────────────────────────────────
export const productRouter = createRouter();
const admin = [authenticate, authorize('ADMIN')];
productRouter.get('/', optionalAuthenticate, validate({ query: productListQuery }), products.list);
productRouter.get('/categories', products.categories);
productRouter.get('/:id', optionalAuthenticate, validate({ params: intIdParams }), products.get);
productRouter.post('/', ...admin, validate({ body: productBody }), products.create);
productRouter.put('/:id', ...admin, validate({ params: intIdParams, body: productBody }), products.replace);
productRouter.patch('/:id', ...admin, validate({ params: intIdParams, body: updateProductBody }), products.update);
productRouter.delete('/:id', ...admin, validate({ params: intIdParams }), products.remove);

// ─── /api/settings ──────────────────────────────────────────────────────────
export const settingsRouter = createRouter();
settingsRouter.use(authenticate);
settingsRouter.get('/', account.getSettings);
settingsRouter.patch('/', validate({ body: updateSettingsBody }), account.updateSettings);
settingsRouter.put('/', validate({ body: updateSettingsBody }), account.updateSettings);

// ─── /api/notifications ─────────────────────────────────────────────────────
export const notificationRouter = createRouter();
notificationRouter.use(authenticate);
notificationRouter.get('/', validate({ query: notificationListQuery }), account.listNotifications);
notificationRouter.get('/unread-count', account.unreadCount);
notificationRouter.post('/read-all', account.markAllRead);
notificationRouter.patch('/:id/read', validate({ params: stringIdParams }), account.markRead);
notificationRouter.delete('/:id', validate({ params: stringIdParams }), account.deleteNotification);
