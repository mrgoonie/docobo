import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { prisma } from './services/database.js';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  },
});

// Security middleware
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

await fastify.register(cors, {
  origin: false, // Webhooks don't need CORS
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Health check endpoint
fastify.get('/health', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'error', error: String(error) };
  }
});

// Polar webhook endpoint (placeholder)
fastify.post('/webhooks/polar', async (request, reply) => {
  console.warn('Received Polar webhook');
  // TODO: Implement Polar webhook verification and processing
  return reply.code(200).send({ received: true });
});

// SePay webhook endpoint (placeholder)
fastify.post('/webhooks/sepay', async (request, reply) => {
  console.warn('Received SePay webhook');
  // TODO: Implement SePay webhook verification and processing
  return reply.code(200).send({ received: true });
});

// Start server
const start = async (): Promise<void> => {
  try {
    const port = parseInt(env.WEBHOOK_PORT);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.warn(`✅ Webhook server listening on port ${port}`);

    // Test database connection
    await prisma.$connect();
    console.warn('✅ Database connected');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

void start();
