import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callServiceWithPayment } from '../lib/x402-client.js';

export const callServiceTool: Tool = {
  name: 'call_service',
  description: 'Pay for and call an x402 service on Lumora. Automatically handles the Stellar USDC payment. Returns the service response plus the transaction hash and cost.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceId: {
        type: 'string',
        description: 'The service ID (e.g. "pdf-extract-text"). Get IDs from list_services.',
      },
      payload: {
        type: 'object',
        description: 'The request body to send to the service.',
        additionalProperties: true,
      },
    },
    required: ['serviceId', 'payload'],
  },
};

export async function handleCallService(args: { serviceId: string; payload: unknown }): Promise<unknown> {
  const result = await callServiceWithPayment({
    serviceId: args.serviceId,
    payload: args.payload,
  });

  return {
    result: result.result,
    payment: {
      txHash: result.txHash,
      cost: `${result.cost} USDC`,
      amountPaid: result.amountPaid,
    },
  };
}
