import type { PaymentChallenge, PaymentOption, PaymentProof } from '@lumora/types';
import { submitPayment, getPublicKey } from '../stellar/wallet.js';
import { config, getAllowedPayToAddresses } from '../config.js';
import { logger } from './logger.js';
import { withTimeout } from './http.js';

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

/** Raised when a 402 payment challenge fails a spend-safety check. No transaction is submitted. */
export class PaymentRefusedError extends Error {
  constructor(
    public readonly reason:
      | 'NETWORK_MISMATCH'
      | 'ASSET_MISMATCH'
      | 'AMOUNT_EXCEEDS_CAP'
      | 'PAY_TO_NOT_ALLOWED',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentRefusedError';
  }
}

const FETCH_TIMEOUT_MS = 10_000;
const HORIZON_TIMEOUT_MS = 10_000;
const EXPECTED_X402_NETWORK = 'stellar';

/** Convert stroops string to USDC decimal string. BigInt — no float precision loss. */
function stroopsToUsdc(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / 10_000_000n;
  const remainder = n % 10_000_000n;
  return `${whole}.${remainder.toString().padStart(7, '0')}`;
}

/** Convert a USDC decimal string (e.g. "10" or "0.5000000") to stroops (bigint). */
function usdcToStroops(usdc: string): bigint {
  const trimmed = usdc.trim();
  const [whole = '0', decimals = ''] = trimmed.split('.');
  const paddedDecimals = decimals.padEnd(7, '0').slice(0, 7);
  return BigInt(whole || '0') * 10_000_000n + BigInt(paddedDecimals || '0');
}

/**
 * Validate a 402 payment option against configured spend-safety rules before any
 * transaction is built or submitted. Throws PaymentRefusedError on the first failing check.
 */
function validatePaymentOption(accept: PaymentOption): void {
  if (accept.network !== EXPECTED_X402_NETWORK) {
    throw new PaymentRefusedError(
      'NETWORK_MISMATCH',
      `Refusing payment: challenge network "${accept.network}" does not match expected "${EXPECTED_X402_NETWORK}"`,
    );
  }

  if (accept.asset !== 'USDC' || accept.extra.issuer !== config.USDC_ISSUER) {
    throw new PaymentRefusedError(
      'ASSET_MISMATCH',
      `Refusing payment: asset "${accept.asset}" issued by "${accept.extra.issuer}" does not match expected USDC issuer "${config.USDC_ISSUER}"`,
    );
  }

  const requestedStroops = BigInt(accept.maxAmountRequired);
  const capStroops = usdcToStroops(config.MAX_PAYMENT_USDC);
  if (requestedStroops > capStroops) {
    throw new PaymentRefusedError(
      'AMOUNT_EXCEEDS_CAP',
      `Refusing payment: requested ${stroopsToUsdc(accept.maxAmountRequired)} USDC exceeds MAX_PAYMENT_USDC cap of ${config.MAX_PAYMENT_USDC} USDC`,
    );
  }

  const allowed = getAllowedPayToAddresses();
  if (!allowed.includes(accept.payTo)) {
    throw new PaymentRefusedError(
      'PAY_TO_NOT_ALLOWED',
      `Refusing payment: payTo "${accept.payTo}" is not in the configured allowlist`,
    );
  }
}

export async function callServiceWithPayment(options: CallServiceOptions): Promise<CallServiceResult> {
  const routerUrl = options.routerUrl ?? config.ROUTER_URL;
  const url = `${routerUrl}/services/${options.serviceId}`;

  // Step 1: Initial request — expect 402
  const firstResponse = await withTimeout(
    (signal) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.payload),
        signal,
      }),
    'Initial service request',
    FETCH_TIMEOUT_MS,
  );

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

  // Refuse to submit any transaction unless the challenge passes spend-safety checks.
  validatePaymentOption(accept);

  logger.info({ requestId, amount: maxAmountRequired, payTo }, 'Received 402, submitting payment');

  // Step 2: Submit Stellar payment
  const txHash = await withTimeout(
    () =>
      submitPayment({
        destination: payTo,
        amountStroops: maxAmountRequired,
        asset: 'USDC',
        usdcIssuer: extra.issuer,
        memo: requestId,
      }),
    'Horizon payment submission',
    HORIZON_TIMEOUT_MS,
  );

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
  const paidResponse = await withTimeout(
    (signal) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': proofHeader,
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(options.payload),
        signal,
      }),
    'Paid service request',
    FETCH_TIMEOUT_MS,
  );

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
