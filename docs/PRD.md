# Lumora — Product Requirements Document

---

## Problem

### For AI Agents

Every external API requires authentication setup — API keys, credit cards, OAuth flows. AI agents hit a wall the moment they need real data or computation outside their context window. They cannot autonomously pay for services; a human must intervene for every new integration.

### For Service Providers

Building per-user billing, auth middleware, and rate limiting is expensive and slow. Most genuinely useful APIs are locked behind subscription walls that agents cannot navigate. There is no zero-friction way to monetize a REST endpoint per-call.

### For the Stellar Ecosystem

The x402 protocol exists and works, but there is no self-hostable, open-source gateway + marketplace that demonstrates end-to-end agent-to-API payments. The ecosystem lacks a reference implementation that developers can fork, deploy, and build on.

---

## Solution

Lumora is a self-hosted x402 payment router that:

1. Wraps any REST API with a per-request USDC paywall (via service registration)
2. Verifies Stellar USDC payments and proxies verified requests to the upstream service
3. Exposes an MCP server so AI agents (Claude Code, local LLMs) pay automatically
4. Lets agents set on-chain spending limits via a Soroban contract

---

## Users

| User | Core Need |
|---|---|
| **AI Agent** | Autonomously call paid APIs without human auth setup |
| **Service Provider** | Monetize any REST API per-request, zero billing infrastructure |
| **Developer** | Self-host the entire stack on laptop or VPS |
| **Lumora Operator** | Run a marketplace of x402 services |

---

## Core Features (MVP)

| # | Feature | Why Critical |
|---|---|---|
| 1 | x402 payment gateway | Core protocol — verifies Stellar tx, proxies to upstream |
| 2 | Service registry (SQLite) | Agents need discovery; providers need registration |
| 3 | MCP server | Claude Code / LLMs need autonomous payment capability |
| 4 | PDF demo service | Concrete, recurring agent demand; proves the stack works |
| 5 | Soroban spending policy | On-chain budget control; demonstrates Soroban integration |
| 6 | Marketplace UI | Humans and agents browse available services |
| 7 | Admin API | Register services, view payment logs |

---

## Deferred (Post-MVP)

- Multi-tenant service provider accounts / auth
- MPP bulk/session payments (x402 only for now)
- Webhook notifications to service providers
- Automatic payouts to service providers
- Smart Account Kit passkey wallets
- On-chain reputation scoring

---

## x402 Payment Flow

```
Step 1:  Agent → POST /services/pdf-extract-text
         Body: { "url": "https://example.com/doc.pdf" }

Step 2:  Router → HTTP 402
         Body: {
           "x402Version": 1,
           "accepts": [{
             "scheme": "exact",
             "network": "stellar",
             "maxAmountRequired": "500000",     ← 0.05 USDC in stroops
             "resource": "https://router/services/pdf-extract-text",
             "description": "PDF text extraction",
             "payTo": "GROUTER_WALLET",
             "maxTimeoutSeconds": 300,
             "asset": "USDC",
             "extra": { "issuer": "GBBD47..." }
           }],
           "requestId": "req_abc123"            ← unique nonce per request
         }

Step 3:  Agent (via MCP/SDK):
         a. Creates Stellar payment: 0.05 USDC → GROUTER_WALLET, memo: "req_abc123"
         b. Submits to Horizon → gets txHash

Step 4:  Agent → POST /services/pdf-extract-text
         Headers:
           X-PAYMENT: base64({ txHash, from: "GAGENT...", amount: "500000" })
           X-Request-ID: req_abc123
         Body: { "url": "https://example.com/doc.pdf" }

Step 5:  Router verification:
         ✓ Decode X-PAYMENT header
         ✓ Fetch tx from Horizon
         ✓ Verify destination = GROUTER_WALLET
         ✓ Verify amount >= 500000 stroops
         ✓ Verify asset = USDC (correct issuer)
         ✓ Verify memo = "req_abc123" (nonce match)
         ✓ Verify tx created < 5 minutes ago
         ✓ Verify txHash NOT in payments table (anti-replay)
         → Record payment in SQLite
         → Proxy to upstream PDF service

Step 6:  PDF service processes → returns response
         Router returns response to agent
```

---

## Anti-Replay Protection

1. Unique `requestId` per 402 response (UUID-based)
2. Transaction memo must match `requestId`
3. Transaction timestamp must be < `PAYMENT_EXPIRY_SECONDS` (default 300s) old
4. `txHash` stored as PRIMARY KEY in SQLite `payments` table — checked before every proxy

---

## PDF Demo Service

Two endpoints, both wrapped by the router:

| Endpoint | Input | Output | Price |
|---|---|---|---|
| `POST /services/pdf-extract-text` | `{ url } \| { base64 }` | `{ text, pageCount, wordCount }` | 0.05 USDC |
| `POST /services/pdf-to-json` | `{ url } \| { base64 }` | `{ pages: [{ num, text, wordCount }] }` | 0.10 USDC |

---

## MCP Tools

| Tool | Description | Inputs | Returns |
|---|---|---|---|
| `list_services` | Browse available x402 services | `tags?: string[]` | `Service[]` |
| `call_service` | Pay for and call a service | `serviceId, payload` | `{ result, txHash, cost }` |
| `check_balance` | Agent wallet USDC + XLM | — | `{ usdc, xlm, address }` |
| `get_wallet_address` | Agent's public key | — | `string` |

---

## Soroban Spending Policy

Contract functions for agent-controlled daily budget:

```rust
fn set_limit(env, agent, daily_limit_stroops)  // agent signs
fn get_limit(env, agent) -> i128
fn is_within_limit(env, agent, amount) -> bool  // free simulation
fn record_spend(env, agent, amount, service_id) // agent signs after success
fn get_daily_spent(env, agent) -> i128
fn get_remaining(env, agent) -> i128
```

Day number = `ledger_sequence / 17280` (≈24h on mainnet at 5s/ledger).
