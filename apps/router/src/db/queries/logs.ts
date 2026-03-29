import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';

export type RequestStatus = '402' | 'paid' | 'error';

export interface LogEntry {
  serviceId: string;
  txHash?: string;
  fromAddress?: string;
  status: RequestStatus;
  durationMs?: number;
}

export function insertLog(entry: LogEntry): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO request_log (id, service_id, tx_hash, from_address, status, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    entry.serviceId,
    entry.txHash ?? null,
    entry.fromAddress ?? null,
    entry.status,
    entry.durationMs ?? null,
    Date.now(),
  );
}

export function getRecentLogs(serviceId: string, limit = 50): unknown[] {
  const db = getDb();
  return db.prepare('SELECT * FROM request_log WHERE service_id = ? ORDER BY created_at DESC LIMIT ?').all(serviceId, limit);
}
