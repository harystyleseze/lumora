import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { extractText } from '../lib/pdf-parser.js';

const bodySchema = z.object({
  url: z.string().url().optional(),
  base64: z.string().optional(),
}).refine((d) => d.url || d.base64, { message: 'Either url or base64 must be provided' });

export async function extractTextRoute(fastify: FastifyInstance) {
  fastify.post('/extract-text', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await extractText(parsed.data);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF processing failed';
      return reply.status(422).send({ error: message });
    }
  });
}
