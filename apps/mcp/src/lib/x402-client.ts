import type { PaymentChallenge, PaymentProof } from '@lumora/types';
import { submitPayment, getPublicKey } from '../stellar/wallet.js';
import { config } from '../config.js';
import { logger } from './logger.js';

export interface CallServiceOptions {
  serviceId: string;
  payload: unknown;
  routerUrl?: string;
}

export interface CallServiceResult {
  result: unknown;
  txHash: string;
  cost: string;
  amountPaid: string;
}

/** Convert stroops string to USDC decimal string. BigInt — no float precision loss. */
function stroopsToUsdc(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / 10_000_000n;
  const remainder = n % 10_000_000n;
  return `${whole}.${remainder.toString().padStart(7, '0')}`;
}

export async function callServiceWithPayment(options: CallServiceOptions): Promise<CallServiceResult> {
  const routerUrl = options.routerUrl ?? config.ROUTER_URL;
  const url = `${routerUrl}/services/${options.serviceId}`;

  // Step 1: Initial request — expect 402
  const firstResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options.payload),
  });

  if (firstResponse.status !== 402) {
    if (firstResponse.ok) {
      return { result: await firstResponse.json(), txHash: '', cost: '0', amountPaid: '0' };
    }
    const err = await firstResponse.text();
    throw new Error(`Unexpected response ${firstResponse.status}: ${err}`);
  }

  const challenge = (await firstResponse.json()) as PaymentChallenge;
  const accept = challenge.accepts[0];
  if (!accept) throw new Error('No payment options in 402 response');

  const { maxAmountRequired, payTo, extra } = accept;
  const requestId = challenge.requestId;

  logger.info({ requestId, amount: maxAmountRequired, payTo }, 'Received 402, submitting payment');

  // Step 2: Submit Stellar payment
  const txHash = await submitPayment({
    destination: payTo,
    amountStroops: maxAmountRequired,
    asset: 'USDC',
    usdcIssuer: extra.issuer,
    memo: requestId,
  });

  logger.info({ txHash, requestId }, 'Payment submitted, retrying request');

  // Step 3: Build proof header (use static import — no dynamic re-import needed)
  const proof: PaymentProof = {
    x402Version: 1,
    scheme: 'exact',
    network: 'stellar',
    payload: {
      txHash,
      from: getPublicKey(),
      amount: maxAmountRequired,
    },
  };
  const proofHeader = Buffer.from(JSON.stringify(proof)).toString('base64');

  // Step 4: Retry with payment proof + request ID
  const paidResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': proofHeader,
      'X-Request-ID': requestId,
    },
    body: JSON.stringify(options.payload),
  });

  if (!paidResponse.ok) {
    const errBody = await paidResponse.text();
    throw new Error(`Service returned ${paidResponse.status} after payment: ${errBody}`);
  }

  const result = await paidResponse.json();
  const costUsdc = stroopsToUsdc(maxAmountRequired); // BigInt — no precision loss

  return {
    result,
    txHash,
    cost: costUsdc,
    amountPaid: maxAmountRequired,
  };
}
