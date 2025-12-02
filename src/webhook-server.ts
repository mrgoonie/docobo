import { createWebhookServer } from './webhooks/server.js';
import { prisma } from './services/database.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  console.warn('🚀 Starting Docobo Webhook Server...');

  // Test database connection
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.warn('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Create Fastify server
  const server = await createWebhookServer();

  // Start server
  try {
    const port = parseInt(env.WEBHOOK_PORT, 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.warn(`✅ Webhook server listening on port ${port}`);
    console.warn(`   Health check: http://localhost:${port}/health`);
    console.warn(`   Polar webhook: http://localhost:${port}/webhooks/polar`);
    console.warn(`   SePay webhook: http://localhost:${port}/webhooks/sepay`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.warn('\n🛑 Shutting down webhook server...');
    await server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
