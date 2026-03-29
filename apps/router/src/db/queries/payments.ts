import { getDb } from '../index.js';

export interface PaymentInsert {
  txHash: string;
  serviceId: string;
  requestId: string;
  fromAddress: string;
  amountRaw: string;
  asset: string;
}

export function recordPayment(payment: PaymentInsert): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO payments (tx_hash, service_id, request_id, from_address, amount_raw, asset, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.txHash,
    payment.serviceId,
    payment.requestId,
    payment.fromAddress,
    payment.amountRaw,
    payment.asset,
    Date.now(),
  );
}

export function isPaymentUsed(txHash: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM payments WHERE tx_hash = ?').get(txHash);
  return row !== undefined;
}

export function isRequestIdUsed(requestId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM payments WHERE request_id = ?').get(requestId);
  return row !== undefined;
}
