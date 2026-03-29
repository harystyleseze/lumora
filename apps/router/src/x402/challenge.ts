import { v4 as uuidv4 } from 'uuid';
import type { Service } from '@lumora/types';
import type { X402Challenge } from './types.js';
import { config } from '../config.js';
import { usdcToStroops } from '../stellar/utils.js';

export function buildChallenge(service: Service, resourceUrl: string): X402Challenge {
  const amountStroops = usdcToStroops(service.priceUsdc).toString();

  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'stellar',
        maxAmountRequired: amountStroops,
        resource: resourceUrl,
        description: service.description || service.name,
        payTo: config.ROUTER_WALLET_PUBLIC,
        maxTimeoutSeconds: config.PAYMENT_EXPIRY_SECONDS,
        asset: 'USDC',
        extra: {
          issuer: config.USDC_ISSUER,
          name: 'USD Coin',
        },
      },
    ],
    requestId: `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    error: 'Payment required',
  };
}
