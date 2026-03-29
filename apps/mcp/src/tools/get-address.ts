import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getPublicKey } from '../stellar/wallet.js';

export const getAddressTool: Tool = {
  name: 'get_wallet_address',
  description: "Get the agent's Stellar wallet public address.",
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export function handleGetAddress(): unknown {
  return { address: getPublicKey() };
}
