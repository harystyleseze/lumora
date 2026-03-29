import { Horizon } from '@stellar/stellar-sdk';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let _server: Horizon.Server | null = null;

export function getHorizon(): Horizon.Server {
  if (!_server) {
    _server = new Horizon.Server(config.STELLAR_HORIZON_URL);
  }
  return _server;
}

export interface VerifiedPayment {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  issuer: string | null;
  memo: string;
  createdAt: Date;
}

export async function fetchAndVerifyPayment(txHash: string): Promise<VerifiedPayment | null> {
  try {
    const server = getHorizon();
    const tx = await server.transactions().transaction(txHash).call();

    const ops = await server.operations().forTransaction(txHash).call();
    const paymentOp = ops.records.find(
      (op) => op.type === 'payment'
    ) as Horizon.ServerApi.PaymentOperationRecord | undefined;

    if (!paymentOp) {
      logger.warn({ txHash }, 'No payment operation found in transaction');
      return null;
    }

    return {
      txHash,
      from: paymentOp.from,
      to: paymentOp.to,
      amount: paymentOp.amount,
      asset: paymentOp.asset_type === 'native' ? 'XLM' : paymentOp.asset_code ?? 'UNKNOWN',
      issuer: paymentOp.asset_issuer ?? null,
      memo: tx.memo ?? '',
      createdAt: new Date(tx.created_at),
    };
  } catch (err) {
    logger.error({ txHash, err }, 'Failed to fetch transaction from Horizon');
    return null;
  }
}
