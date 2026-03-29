import { Router, type Request, type Response } from 'express';
import { getService } from '../db/queries/services.js';
import { recordPayment } from '../db/queries/payments.js';
import { insertLog } from '../db/queries/logs.js';
import { buildChallenge } from '../x402/challenge.js';
import { verifyPaymentHeader } from '../x402/verify.js';
import { createServiceProxy } from '../lib/proxy.js';
import { notifySpend } from '../stellar/soroban.js';
import { logger } from '../lib/logger.js';

const router = Router();

// In-memory store for pending request IDs (maps requestId → serviceId)
// These are only valid for PAYMENT_EXPIRY_SECONDS
const pendingRequests = new Map<string, { serviceId: string; expiresAt: number }>();

// Clean up expired pending requests every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, val] of pendingRequests) {
    if (now > val.expiresAt) pendingRequests.delete(id);
  }
}, 60_000);

router.all('/services/:serviceId', async (req: Request, res: Response) => {
  const start = Date.now();
  const { serviceId } = req.params;
  const service = getService(serviceId!);

  if (!service || !service.enabled) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }

  const xPayment = req.headers['x-payment'] as string | undefined;

  // ── No payment header: issue 402 challenge ────────────────────────────────
  if (!xPayment) {
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    const challenge = buildChallenge(service, resourceUrl);

    // Store pending request so we can verify the requestId later
    const expiryMs = (parseInt(process.env['PAYMENT_EXPIRY_SECONDS'] ?? '300', 10)) * 1000;
    pendingRequests.set(challenge.requestId, {
      serviceId: service.id,
      expiresAt: Date.now() + expiryMs,
    });

    insertLog({ serviceId: service.id, status: '402', durationMs: Date.now() - start });
    res.status(402).json(challenge);
    return;
  }

  // ── Payment header present: verify ───────────────────────────────────────
  // Extract requestId from the X-PAYMENT header
  let requestId: string;
  try {
    const decoded = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf-8'));
    // The request ID must be passed by the client; we look it up from pending
    // Clients must include x-request-id header matching the 402 requestId
    requestId = (req.headers['x-request-id'] as string) ?? decoded.requestId ?? '';
  } catch {
    res.status(400).json({ error: 'Malformed X-PAYMENT header' });
    return;
  }

  if (!requestId) {
    res.status(400).json({ error: 'Missing X-Request-ID header' });
    return;
  }

  const result = await verifyPaymentHeader(xPayment, requestId, service.id, service.priceUsdc);

  if (!result.ok) {
    logger.warn({ serviceId, requestId, error: result.error }, 'Payment verification failed');
    insertLog({ serviceId: service.id, status: 'error', durationMs: Date.now() - start });
    res.status(402).json({ error: result.error });
    return;
  }

  // ── Record payment ────────────────────────────────────────────────────────
  recordPayment({
    txHash: result.proof!.payload.txHash,
    serviceId: service.id,
    requestId,
    fromAddress: result.fromAddress!,
    amountRaw: result.proof!.payload.amount,
    asset: 'USDC',
  });

  pendingRequests.delete(requestId);

  logger.info({ serviceId, txHash: result.proof!.payload.txHash, from: result.fromAddress }, 'Payment verified, proxying');

  // Fire-and-forget Soroban notification
  void notifySpend(result.fromAddress!, result.proof!.payload.amount, service.id);

  // ── Proxy to upstream ─────────────────────────────────────────────────────
  const proxy = createServiceProxy(service);

  // Remove payment headers before forwarding
  delete req.headers['x-payment'];
  delete req.headers['x-request-id'];

  insertLog({
    serviceId: service.id,
    txHash: result.proof!.payload.txHash,
    fromAddress: result.fromAddress,
    status: 'paid',
    durationMs: Date.now() - start,
  });

  proxy(req, res, (err) => {
    if (err) {
      logger.error({ err }, 'Proxy error after payment');
      res.status(502).json({ error: 'Upstream service unavailable' });
    }
  });
});

export default router;
