import type { Service } from '@lumora/types';
import Link from 'next/link';

async function getServices(): Promise<Service[]> {
  // Use ROUTER_INTERNAL_URL for server-side fetches (e.g. http://router:3001 inside Docker)
  // Fall back to NEXT_PUBLIC_ROUTER_URL for non-Docker local dev
  const routerUrl =
    process.env['ROUTER_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_ROUTER_URL'] ??
    'http://localhost:3001';
  try {
    const res = await fetch(`${routerUrl}/services`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { services: Service[] };
    return data.services;
  } catch {
    return [];
  }
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/services/${service.id}`}
      style={{
        display: 'block',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '1.5rem',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{service.name}</h3>
        <span style={{
          background: 'rgba(124, 58, 237, 0.15)',
          color: 'var(--color-primary-light)',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.85rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {service.priceUsdc} USDC
        </span>
      </div>
      <p style={{ margin: '0 0 1rem', color: 'var(--color-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
        {service.description}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {service.tags.map((tag) => (
          <span key={tag} style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--color-muted)',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
          }}>
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const services = await getServices();

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '4rem 0 3rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, margin: '0 0 1rem', lineHeight: 1.1 }}>
          APIs for AI Agents.{' '}
          <span style={{ color: 'var(--color-primary-light)' }}>No Keys.</span>
          <br />Just Stellar USDC.
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--color-muted)', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Lumora is an open-source x402 payment router. Service providers wrap any REST API with a paywall.
          AI agents discover and pay per-request — no sign-up required.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="#services"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Browse Services
          </a>
          <a
            href="/register"
            style={{
              background: 'transparent',
              color: 'var(--color-foreground)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              border: '1px solid var(--color-border)',
            }}
          >
            Register a Service
          </a>
        </div>
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem', padding: '2rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        {[
          { step: '1', label: 'Agent calls service', detail: 'POST /services/pdf-extract-text' },
          { step: '2', label: 'Router returns 402', detail: 'With Stellar payment instructions' },
          { step: '3', label: 'Agent pays in USDC', detail: 'Stellar tx, memo = requestId' },
          { step: '4', label: 'Service responds', detail: 'Payment verified, proxied upstream' },
        ].map(({ step, label, detail }) => (
          <div key={step} style={{ textAlign: 'center' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontWeight: 700, fontSize: '0.85rem' }}>{step}</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{detail}</div>
          </div>
        ))}
      </div>

      {/* Service grid */}
      <div id="services">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          Available Services{' '}
          <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: '1rem' }}>
            ({services.length})
          </span>
        </h2>

        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
            <p>No services registered yet.</p>
            <Link href="/register" style={{ color: 'var(--color-primary-light)' }}>Register the first one</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
