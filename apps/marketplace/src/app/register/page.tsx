'use client';

import { useState } from 'react';

interface FormData {
  id: string;
  name: string;
  description: string;
  upstreamUrl: string;
  method: 'GET' | 'POST';
  priceUsdc: string;
  tags: string;
  adminKey: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormData>({
    id: '',
    name: '',
    description: '',
    upstreamUrl: '',
    method: 'POST',
    priceUsdc: '0.05',
    tags: '',
    adminKey: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const routerUrl = process.env['NEXT_PUBLIC_ROUTER_URL'] ?? 'http://localhost:3001';

    try {
      const res = await fetch(`${routerUrl}/admin/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': form.adminKey,
        },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          description: form.description,
          upstreamUrl: form.upstreamUrl,
          method: form.method,
          priceUsdc: form.priceUsdc,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('Service registered successfully!');
      } else {
        const err = (await res.json()) as { error: string };
        setStatus('error');
        setMessage(err.error ?? 'Registration failed');
      }
    } catch {
      setStatus('error');
      setMessage('Could not connect to router');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: 'var(--color-foreground)',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.85rem',
    color: 'var(--color-muted)',
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Register a Service</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
        Wrap any REST API with an x402 paywall. Your service receives proxied requests after payment is verified.
      </p>

      {status === 'success' && (
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#4ade80' }}>
          {message}
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#f87171' }}>
          {message}
        </div>
      )}

      <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Service ID *</label>
          <input style={inputStyle} placeholder="my-api-service" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" />
          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>Lowercase letters, numbers, hyphens (e.g. pdf-extract-text)</div>
        </div>

        <div>
          <label style={labelStyle}>Name *</label>
          <input style={inputStyle} placeholder="My API Service" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} placeholder="What does this service do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div>
          <label style={labelStyle}>Upstream URL *</label>
          <input style={inputStyle} type="url" placeholder="https://my-api.example.com/endpoint" value={form.upstreamUrl} onChange={(e) => setForm({ ...form, upstreamUrl: e.target.value })} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Method</label>
            <select style={inputStyle} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as 'GET' | 'POST' })}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Price (USDC) *</label>
            <input style={inputStyle} type="text" placeholder="0.05" value={form.priceUsdc} onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })} required pattern="\d+(\.\d{1,7})?" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tags (comma-separated)</label>
          <input style={inputStyle} placeholder="pdf, text, extraction" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>

        <div>
          <label style={labelStyle}>Admin API Key *</label>
          <input style={inputStyle} type="password" placeholder="Your router admin key" value={form.adminKey} onChange={(e) => setForm({ ...form, adminKey: e.target.value })} required />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            background: status === 'loading' ? 'var(--color-muted)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            padding: '0.875rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'loading' ? 'Registering...' : 'Register Service'}
        </button>
      </form>
    </div>
  );
}
