import type { Express } from 'express';
import healthRouter from './health.js';
import servicesRouter from './services.js';
import adminRouter from './admin.js';
import gatewayRouter from './gateway.js';

export function mountRoutes(app: Express): void {
  app.use(healthRouter);
  app.use(servicesRouter);
  app.use(adminRouter);
  app.use(gatewayRouter);
}
