import * as systemController from '../controllers/system.controller.js';
import { createRouter } from '../utils/router.js';

export const systemRouter = createRouter();

systemRouter.get('/health', systemController.getHealth);
systemRouter.get('/status', systemController.getStatus);
