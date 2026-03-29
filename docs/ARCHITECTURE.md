# Lumora — Architecture

## System Overview

```
AI Agent (Claude Code / any LLM)
         │
         │ MCP tools: list_services, call_service, check_balance
         │ (stdio transport)
         ▼
┌─────────────────────────┐
│    Lumora MCP Server    │  Node.js process, runs on developer's machine
│    apps/mcp             │  Handles full x402 handshake + Stellar payment
└──────────┬──────────────┘
           │ HTTP (x402 protocol)
           ▼
┌─────────────────────────┐        ┌───────────────────────┐
│    Lumora Router        │        │  Upstream Services    │
│    apps/router          │──────▶ │  services/pdf         │
│                         │        │  (any REST API)       │
│  Express 5              │        └───────────────────────┘
│  SQLite (better-sqlite3)│
│  x402 verifier          │
│  Service registry       │
└──────────┬──────────────┘
           │
           │ Horizon API           Soroban RPC
           ▼                       ▼
    Stellar Testnet / Mainnet
    (payment verification)   (spending policy contract)

┌─────────────────────────┐
│    Marketplace          │  Next.js 15, reads from router REST API
│    apps/marketplace     │  Browse services, register new ones
│    port :3000           │
└─────────────────────────┘
```

---

## Component Responsibilities

### apps/router (Port 3001)

The core of Lumora. Every paid API call flows through here.

- **Service registry**: SQLite `services` table. Providers register upstream URLs + prices via admin API.
- **x402 gateway**: `POST /services/:serviceId` — issues 402 challenge or verifies payment and proxies.
- **Payment verifier**: Fetches tx from Horizon, checks destination, amount, asset, memo nonce, age, dedup.
- **Anti-replay**: `payments` table with `tx_hash` PRIMARY KEY + `request_id` UNIQUE.
- **Request log**: Every request (402 or paid) written to `request_log` for stats.
- **Admin API**: `POST/DELETE /admin/services` protected by `X-Admin-Key` header.

### apps/mcp (stdio)

Runs as a subprocess attached to the AI agent (Claude Code, etc.).

- **list_services**: Fetches `GET /services` from router.
- **call_service**: Full x402 flow — initial POST → receive 402 → pay on Stellar → retry with proof.
- **check_balance**: Loads agent's Stellar account balances.
- **get_wallet_address**: Returns agent's public key.
- Does NOT run in Docker. Configured via `~/.claude.json` (or equivalent).

### services/pdf (Port 3002)

Fastify service, internally accessible only. NOT directly x402-protected — the router wraps it.

- `POST /extract-text` — pdfjs-dist text extraction
- `POST /to-json` — structured per-page JSON output
- Accepts `{ url }` or `{ base64 }` input

### apps/marketplace (Port 3000)

Next.js 15 read-mostly UI. Minimal: 3 pages.

- `/` — Service grid with prices, tags, live stats
- `/services/[id]` — Detail page with usage examples (MCP + cURL)
- `/register` — Form to call admin API and register a new service

### contracts/spending-policy

Soroban Rust contract on Stellar. Optional — router still works without it.

- Agents self-manage daily USDC spending limits
- `record_spend` called fire-and-forget after successful service call
- Day tracking via `ledger_sequence / 17280`

---

## Database Schema

```sql
-- Service registry
CREATE TABLE services (
  id           TEXT PRIMARY KEY,   -- "pdf-extract-text"
  name         TEXT NOT NULL,
  description  TEXT,
  upstream_url TEXT NOT NULL,      -- internal URL router proxies to
  method       TEXT DEFAULT 'POST',
  price_usdc   TEXT NOT NULL,      -- "0.0500000"
  price_xlm    TEXT,
  asset        TEXT DEFAULT 'USDC',
  input_schema TEXT,               -- JSON string
  output_schema TEXT,
  tags         TEXT,               -- JSON array string
  enabled      INTEGER DEFAULT 1,
  created_at   INTEGER NOT NULL
);

-- Anti-replay: one row per paid request
CREATE TABLE payments (
  tx_hash      TEXT PRIMARY KEY,   -- Stellar tx hash
  service_id   TEXT NOT NULL,
  request_id   TEXT NOT NULL UNIQUE, -- nonce from 402 response
  from_address TEXT NOT NULL,
  amount_raw   TEXT NOT NULL,      -- stroops
  asset        TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

-- Request log for stats
CREATE TABLE request_log (
  id           TEXT PRIMARY KEY,
  service_id   TEXT NOT NULL,
  tx_hash      TEXT,
  from_address TEXT,
  status       TEXT NOT NULL,      -- '402' | 'paid' | 'error'
  duration_ms  INTEGER,
  created_at   INTEGER NOT NULL
);
```

---

## Key File Map

| File | Purpose |
|---|---|
| `apps/router/src/x402/verify.ts` | Payment verification — most critical logic |
| `apps/router/src/x402/challenge.ts` | Build 402 response body with requestId nonce |
| `apps/router/src/routes/gateway.ts` | Main x402 flow handler (402 or proxy) |
| `apps/router/src/db/queries/payments.ts` | Anti-replay dedup (`isPaymentUsed`) |
| `apps/mcp/src/lib/x402-client.ts` | Client-side x402 handshake (pays and retries) |
| `apps/mcp/src/tools/call-service.ts` | MCP tool: full end-to-end flow |
| `contracts/spending-policy/src/lib.rs` | Soroban spending policy contract |
| `services/pdf/src/lib/pdf-parser.ts` | pdfjs-dist wrappers |
| `apps/router/src/db/schema.sql` | SQLite schema (3 tables + 4 indexes) |

---

## Technology Choices

| Decision | Choice | Why |
|---|---|---|
| Database | SQLite (better-sqlite3) | Zero setup, single file, runs on any laptop |
| PDF parsing | pdfjs-dist | Pure JS — no native binaries, works in Docker |
| Logging | pino | Lightweight, structured, works in both Node services |
| MCP transport | stdio | Required for Claude Code integration |
| No Redis | — | Rate limiting in-memory; SQLite handles dedup |
| No Postgres | — | SQLite is sufficient at MVP scale |
| No message queues | — | Synchronous proxy; no async processing needed |
| Soroban integration | Optional | Non-blocking: failure doesn't break payment flow |

---

## Docker Topology

```
docker-compose.yml
├── router    :3001  (depends_on: pdf healthcheck)
├── pdf       :3002  (internal; healthcheck on /health)
└── marketplace :3000 (depends_on: router healthcheck)

mcp  ← NOT in Docker (stdio process on developer machine)
```

SQLite database is volume-mounted at `./lumora.db` so it persists across container restarts.
