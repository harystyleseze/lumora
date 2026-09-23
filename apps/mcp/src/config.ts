import { z } from 'zod';

const schema = z.object({
  ROUTER_URL: z.string().url().default('http://localhost:3001'),
  AGENT_WALLET_SECRET: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  SPENDING_POLICY_CONTRACT_ID: z.string().optional(),
  LOG_LEVEL: z.string().default('warn'),
  // USDC issuer the router is expected to be paid in. Defaults to the testnet USDC issuer.
  USDC_ISSUER: z.string().min(1).default('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  // The router's own wallet — the implicit default (and only) pay-to target when
  // ALLOWED_PAY_TO is not set.
  ROUTER_WALLET_PUBLIC: z.string().optional(),
  // Per-request spend cap, as a decimal USDC string (e.g. "10" = 10 USDC).
  MAX_PAYMENT_USDC: z.string().default('10'),
  // Optional comma-separated allowlist of Stellar public keys the agent may pay.
  // Empty/unset means "only ROUTER_WALLET_PUBLIC".
  ALLOWED_PAY_TO: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write(`Invalid MCP environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}\n`);
  process.exit(1);
}

export const config = parsed.data;

/**
 * The set of Stellar public keys this agent is allowed to pay.
 * Falls back to the configured router wallet when ALLOWED_PAY_TO is empty/unset,
 * so an unconfigured agent never pays an arbitrary address.
 */
export function getAllowedPayToAddresses(): string[] {
  const list = (config.ALLOWED_PAY_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (list.length > 0) return list;
  return config.ROUTER_WALLET_PUBLIC ? [config.ROUTER_WALLET_PUBLIC] : [];
}
