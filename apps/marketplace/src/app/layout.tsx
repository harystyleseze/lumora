import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lumora — x402 API Marketplace',
  description: 'Pay-per-request APIs for AI agents. No API keys. Just Stellar USDC.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid var(--color-border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary-light)', textDecoration: 'none', letterSpacing: '-0.02em' }}>
            Lumora
          </a>
          <nav style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
            <a href="/register" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>Register Service</a>
            <a href="https://github.com/lumora-dev/lumora" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>GitHub</a>
          </nav>
        </header>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          {children}
        </main>
        <footer style={{ borderTop: '1px solid var(--color-border)', padding: '1.5rem 2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          Lumora — Open-source x402 gateway · Built on Stellar · {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
