import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listServicesTool, handleListServices } from './tools/list-services.js';
import { callServiceTool, handleCallService } from './tools/call-service.js';
import { checkBalanceTool, handleCheckBalance } from './tools/check-balance.js';
import { getAddressTool, handleGetAddress } from './tools/get-address.js';
import { logger } from './lib/logger.js';

const server = new Server(
  { name: 'lumora', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [listServicesTool, callServiceTool, checkBalanceTool, getAddressTool],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'list_services':
        result = await handleListServices((args ?? {}) as { tags?: string[] });
        break;
      case 'call_service':
        result = await handleCallService(args as { serviceId: string; payload: unknown });
        break;
      case 'check_balance':
        result = await handleCheckBalance();
        break;
      case 'get_wallet_address':
        result = handleGetAddress();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    logger.error({ tool: name, err }, 'Tool error');
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
logger.info('Lumora MCP server running on stdio');
