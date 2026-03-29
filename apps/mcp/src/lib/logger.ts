import pino from 'pino';

// MCP servers use stdio transport — log to stderr only
export const logger = pino(
  { level: process.env['LOG_LEVEL'] ?? 'warn' },
  pino.destination({ dest: 2, sync: false }), // stderr fd=2
);
