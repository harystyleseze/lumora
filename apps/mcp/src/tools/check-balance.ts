import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getBalances } from '../stellar/wallet.js';

export const checkBalanceTool: Tool = {
  name: 'check_balance',
  description: "Check the agent's Stellar wallet USDC and XLM balances.",
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function handleCheckBalance(): Promise<unknown> {
  return getBalances();
}
