import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { processPolarEvent } from '../services/polar-service.js';
import { checkDuplication } from '../utils/deduplication.js';
import { verifyWebhookSignature, WebhookVerificationError } from '../utils/signature.js';

// Polar webhook event structure
interface PolarWebhookEvent {
  id: string;
  type: string;
  data: {
    id: string;
    [key: string]: unknown;
  };
}

export default function polarRoutes(
  server: FastifyInstance,
  _options: unknown,
  done: () => void
): void {
  // Add raw body hook for signature verification
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      try {
        done(null, { raw: body, parsed: JSON.parse(body) as PolarWebhookEvent });
      } catch (err) {
        done(err as Error);
      }
    }
  );

  server.post(
    '/polar',
    async (
      request: FastifyRequest<{ Body: { raw: string; parsed: PolarWebhookEvent } }>,
      reply: FastifyReply
    ) => {
      const { raw: rawBody, parsed: event } = request.body;

      try {
        // 1. Verify webhook signature (Standard Webhooks HMAC)
        verifyWebhookSignature(
          rawBody,
          request.headers as Record<string, string | string[] | undefined>,
          env.POLAR_WEBHOOK_SECRET
        );

        // 2. Check deduplication
        const isDuplicate = await checkDuplication(event.id, 'POLAR');
        if (isDuplicate) {
          server.log.info(`Duplicate Polar event: ${event.id}`);
          return reply.code(200).send({ success: true, message: 'Duplicate event' });
        }

        // 3. Acknowledge receipt immediately (prevent timeout)
        void reply.code(202).send({ success: true, message: 'Event received' });

        // 4. Process async (non-blocking)
        setImmediate(() => {
          processPolarEvent(event).catch((error: Error) => {
            server.log.error({ err: error }, `Failed to process Polar event ${event.id}`);
          });
        });
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          server.log.warn({ err: error }, 'Polar webhook verification failed');
          return reply.code(403).send({ error: 'Invalid signature' });
        }

        server.log.error({ err: error }, 'Polar webhook error');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  done();
}
