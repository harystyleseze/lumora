import type { Service, RegisterServiceInput } from '@lumora/types';
import { getDb } from '../index.js';

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  upstream_url: string;
  method: string;
  price_usdc: string;
  price_xlm: string | null;
  asset: string;
  input_schema: string | null;
  output_schema: string | null;
  tags: string | null;
  enabled: number;
  created_at: number;
}

function rowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    upstreamUrl: row.upstream_url,
    method: row.method as 'GET' | 'POST',
    priceUsdc: row.price_usdc,
    priceXlm: row.price_xlm ?? undefined,
    asset: row.asset as 'USDC' | 'XLM',
    inputSchema: row.input_schema ? JSON.parse(row.input_schema) : undefined,
    outputSchema: row.output_schema ? JSON.parse(row.output_schema) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export function listServices(enabledOnly = true): Service[] {
  const db = getDb();
  const rows = enabledOnly
    ? db.prepare('SELECT * FROM services WHERE enabled = 1 ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM services ORDER BY created_at DESC').all();
  return (rows as ServiceRow[]).map(rowToService);
}

export function getService(id: string): Service | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow | undefined;
  return row ? rowToService(row) : null;
}

export function insertService(input: RegisterServiceInput): Service {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO services (id, name, description, upstream_url, method, price_usdc, price_xlm, asset, input_schema, output_schema, tags, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'USDC', ?, ?, ?, 1, ?)
  `).run(
    input.id,
    input.name,
    input.description ?? null,
    input.upstreamUrl,
    input.method ?? 'POST',
    input.priceUsdc,
    input.priceXlm ?? null,
    input.inputSchema ? JSON.stringify(input.inputSchema) : null,
    input.outputSchema ? JSON.stringify(input.outputSchema) : null,
    input.tags ? JSON.stringify(input.tags) : '[]',
    now,
  );
  return getService(input.id)!;
}

export function deleteService(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM services WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getServiceStats(serviceId: string): { totalRequests: number; paidRequests: number; totalRevenue: string } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM request_log WHERE service_id = ?').get(serviceId) as { cnt: number }).cnt;
  const paid = (db.prepare("SELECT COUNT(*) as cnt FROM request_log WHERE service_id = ? AND status = 'paid'").get(serviceId) as { cnt: number }).cnt;
  const revenue = (db.prepare("SELECT SUM(CAST(amount_raw AS INTEGER)) as total FROM payments WHERE service_id = ?").get(serviceId) as { total: number | null }).total ?? 0;
  const service = getService(serviceId);
  // Convert stroops to USDC (7 decimal places)
  const revenueUsdc = (revenue / 10_000_000).toFixed(7);
  return { totalRequests: total, paidRequests: paid, totalRevenue: revenueUsdc };
}
