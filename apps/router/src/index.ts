import express from 'express';
import { config } from './config.js';
import { mountRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { rateLimit } from './middleware/rate-limit.js';
import { getDb, closeDb } from './db/index.js';
import { logger } from './lib/logger.js';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);

mountRoutes(app);
app.use(errorHandler);

// Initialize DB on startup
getDb();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Lumora Router started');
});

// Seed default PDF services if none exist
async function seedDefaultServices() {
  const { listServices, insertService } = await import('./db/queries/services.js');
  const existing = listServices(false);
  if (existing.length === 0) {
    logger.info('Seeding default PDF services');
    insertService({
      id: 'pdf-extract-text',
      name: 'PDF Text Extractor',
      description: 'Extract plain text from any PDF. Accepts URL or base64.',
      upstreamUrl: process.env['PDF_SERVICE_URL'] ?? 'http://localhost:3002/extract-text',
      method: 'POST',
      priceUsdc: '0.0500000',
      tags: ['pdf', 'text', 'extraction'],
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Publicly accessible PDF URL' },
          base64: { type: 'string', description: 'Base64-encoded PDF content' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          pageCount: { type: 'number' },
          wordCount: { type: 'number' },
        },
      },
    });
    insertService({
      id: 'pdf-to-json',
      name: 'PDF to JSON',
      description: 'Convert PDF to structured JSON with per-page text and metadata.',
      upstreamUrl: process.env['PDF_SERVICE_URL_JSON'] ?? 'http://localhost:3002/to-json',
      method: 'POST',
      priceUsdc: '0.1000000',
      tags: ['pdf', 'json', 'structured'],
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Publicly accessible PDF URL' },
          base64: { type: 'string', description: 'Base64-encoded PDF content' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          pages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                num: { type: 'number' },
                text: { type: 'string' },
                wordCount: { type: 'number' },
              },
            },
          },
        },
      },
    });
  }
}

void seedDefaultServices();

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
