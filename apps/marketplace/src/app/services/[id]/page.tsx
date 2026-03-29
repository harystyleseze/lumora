import type { Service } from '@lumora/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';

async function getService(id: string): Promise<Service | null> {
  const routerUrl =
    process.env['ROUTER_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_ROUTER_URL'] ??
    'http://localhost:3001';
  try {
    const res = await fetch(`${routerUrl}/services/${id}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { service: Service };
    return data.service;
  } catch {
    return null;
  }
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  const routerUrl = process.env['NEXT_PUBLIC_ROUTER_URL'] ?? 'http://localhost:3001';

  const curlExample = `# Step 1: Get payment challenge
curl -X POST ${routerUrl}/services/${service.id} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(service.inputSchema?.properties ? { url: 'https://example.com/sample.pdf' } : {})}'
# → HTTP 402 with requestId and payTo address

# Step 2: Pay ${service.priceUsdc} USDC on Stellar (memo = requestId from above)
# Then retry with X-PAYMENT and X-Request-ID headers`;

  const mcpExample = `// In Claude Code with Lumora MCP configured:
// "Extract text from https://example.com/sample.pdf"

// MCP calls:
await list_services({ tags: ["pdf"] });
await call_service({
  serviceId: "${service.id}",
  payload: { url: "https://example.com/sample.pdf" }
});
// → { result: { text: "...", pageCount: 5, wordCount: 1234 }, payment: { txHash: "...", cost: "${service.priceUsdc} USDC" } }`;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--color-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← All services
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>{service.name}</h1>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '1rem', lineHeight: 1.5 }}>{service.description}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(124, 58, 237, 0.15)', border: '1px solid var(--color-primary)', borderRadius: '12px', padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-light)' }}>{service.priceUsdc}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>USDC per request</div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {service.tags.map((tag) => (
          <span key={tag} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-muted)', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>{tag}</span>
        ))}
        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-muted)', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
          {service.method}
        </span>
      </div>

      {/* Stats */}
      {service.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Requests', value: service.stats.totalRequests.toLocaleString() },
            { label: 'Paid Requests', value: service.stats.paidRequests.toLocaleString() },
            { label: 'Total Revenue', value: `${service.stats.totalRevenue} USDC` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Usage examples */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Usage with Claude Code (MCP)</h2>
        <pre style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem', overflow: 'auto', fontSize: '0.82rem', lineHeight: 1.6, color: '#a8b4c8' }}>
          {mcpExample}
        </pre>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Usage with cURL</h2>
        <pre style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem', overflow: 'auto', fontSize: '0.82rem', lineHeight: 1.6, color: '#a8b4c8' }}>
          {curlExample}
        </pre>
      </div>

      {/* Schema */}
      {service.inputSchema && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Input Schema</h2>
          <pre style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem', overflow: 'auto', fontSize: '0.82rem', lineHeight: 1.6, color: '#a8b4c8' }}>
            {JSON.stringify(service.inputSchema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
