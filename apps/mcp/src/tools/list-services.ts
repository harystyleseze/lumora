import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { config } from '../config.js';

export const listServicesTool: Tool = {
  name: 'list_services',
  description: 'List all available x402 services on the Lumora router. Returns service IDs, names, descriptions, and prices in USDC.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: filter services by tags (e.g. ["pdf", "text"])',
      },
    },
  },
};

export async function handleListServices(args: { tags?: string[] }): Promise<unknown> {
  const routerUrl = config.ROUTER_URL;
  const response = await fetch(`${routerUrl}/services`);

  if (!response.ok) {
    throw new Error(`Router unavailable: ${response.status}`);
  }

  const data = (await response.json()) as { services: Array<{ tags: string[]; [key: string]: unknown }> };
  let services = data.services;

  if (args.tags && args.tags.length > 0) {
    services = services.filter((s) =>
      args.tags!.some((tag) => s.tags.includes(tag)),
    );
  }

  return services;
}
