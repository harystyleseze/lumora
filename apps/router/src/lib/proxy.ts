import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Service } from '@lumora/types';
import { logger } from './logger.js';

export function createServiceProxy(service: Service) {
  const target = new URL(service.upstreamUrl);
  const baseTarget = `${target.protocol}//${target.host}`;
  const pathSuffix = target.pathname;

  return createProxyMiddleware({
    target: baseTarget,
    changeOrigin: true,
    pathRewrite: () => pathSuffix,
    on: {
      error: (err, _req, res) => {
        logger.error({ err, serviceId: service.id }, 'Proxy error');
        if ('status' in res && typeof res.status === 'function') {
          (res as import('express').Response).status(502).json({ error: 'Upstream service unavailable' });
        }
      },
    },
  });
}
