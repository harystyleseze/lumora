import { z } from 'zod';

const schema = z.object({
  ROUTER_URL: z.string().url().default('http://localhost:3001'),
  AGENT_WALLET_SECRET: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  SPENDING_POLICY_CONTRACT_ID: z.string().optional(),
  LOG_LEVEL: z.string().default('warn'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write(`Invalid MCP environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}\n`);
  process.exit(1);
}

export const config = parsed.data;
