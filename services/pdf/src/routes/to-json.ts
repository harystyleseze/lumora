import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { toJson } from '../lib/pdf-parser.js';

const bodySchema = z.object({
  url: z.string().url().optional(),
  base64: z.string().optional(),
}).refine((d) => d.url || d.base64, { message: 'Either url or base64 must be provided' });

export async function toJsonRoute(fastify: FastifyInstance) {
  fastify.post('/to-json', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await toJson(parsed.data);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF processing failed';
      return reply.status(422).send({ error: message });
    }
  });
}
