import type { X402PaymentProof } from './types.js';
import { fetchAndVerifyPayment } from '../stellar/horizon.js';
import { isPaymentUsed } from '../db/queries/payments.js';
import { config } from '../config.js';
import { usdcToStroops } from '../stellar/utils.js';
import { logger } from '../lib/logger.js';

export interface VerifyResult {
  ok: boolean;
  error?: string;
  proof?: X402PaymentProof;
  fromAddress?: string;
}

export async function verifyPaymentHeader(
  xPaymentHeader: string,
  expectedRequestId: string,
  _serviceId: string,
  priceUsdc: string,
): Promise<VerifyResult> {
  // 1. Decode base64 header
  let proof: X402PaymentProof;
  try {
    const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
    proof = JSON.parse(decoded) as X402PaymentProof;
  } catch {
    return { ok: false, error: 'Invalid X-PAYMENT header encoding' };
  }

  const { txHash, from, amount } = proof.payload;

  if (!txHash || !from || !amount) {
    return { ok: false, error: 'Malformed payment proof: missing txHash, from, or amount' };
  }

  // 2. Check anti-replay: tx hash not already used
  if (isPaymentUsed(txHash)) {
    return { ok: false, error: 'Payment already used' };
  }

  // 3. Fetch and verify transaction from Horizon
  const payment = await fetchAndVerifyPayment(txHash);
  if (!payment) {
    return { ok: false, error: 'Transaction not found on network' };
  }

  // 4. Verify destination is router wallet
  if (payment.to !== config.ROUTER_WALLET_PUBLIC) {
    return { ok: false, error: 'Payment destination mismatch' };
  }

  // 5. Verify sender matches claim
  if (payment.from !== from) {
    return { ok: false, error: 'Payment sender mismatch' };
  }

  // 6. Verify memo matches requestId (nonce)
  if (payment.memo !== expectedRequestId) {
    logger.warn({ memo: payment.memo, expectedRequestId }, 'Memo mismatch');
    return { ok: false, error: 'Payment memo does not match request ID' };
  }

  // 7. Verify amount is sufficient using string-based conversion (no float precision loss)
  const requiredStroops = usdcToStroops(priceUsdc);
  const paidStroops = usdcToStroops(payment.amount); // Horizon returns decimal e.g. "0.0500000"
  if (paidStroops < requiredStroops) {
    return { ok: false, error: `Insufficient payment: paid ${paidStroops}, required ${requiredStroops}` };
  }

  // 8. Verify asset is USDC with correct issuer
  if (payment.asset !== 'USDC' || payment.issuer !== config.USDC_ISSUER) {
    return { ok: false, error: 'Invalid payment asset' };
  }

  // 9. Verify transaction is not too old (anti-replay time window)
  const ageMs = Date.now() - payment.createdAt.getTime();
  const maxAgeMs = config.PAYMENT_EXPIRY_SECONDS * 1000;
  if (ageMs > maxAgeMs) {
    return { ok: false, error: 'Payment expired' };
  }

  return { ok: true, proof, fromAddress: from };
}
