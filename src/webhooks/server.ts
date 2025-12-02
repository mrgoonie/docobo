import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';
import { prisma } from '../services/database.js';

export async function createWebhookServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(cors, {
    origin: false, // Webhooks don't need CORS
  });

  // Rate limiting (prevent abuse)
  await server.register(rateLimit, {
    max: 100, // 100 requests per minute
    timeWindow: '1 minute',
  });

  // Health check endpoint
  server.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  });

  // Register webhook routes
  await server.register((await import('./routes/polar.js')).default, { prefix: '/webhooks' });
  await server.register((await import('./routes/sepay.js')).default, { prefix: '/webhooks' });

  return server;
}
