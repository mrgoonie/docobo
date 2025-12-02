import { Client, Events } from 'discord.js';
import { prisma } from '../../services/database.js';

export function handleReady(client: Client): void {
  client.once(Events.ClientReady, (c) => {
    console.warn(`✅ Bot ready! Logged in as ${c.user.tag}`);
    console.warn(`📊 Serving ${c.guilds.cache.size} guilds`);

    // Test database connection
    void (async (): Promise<void> => {
      try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        console.warn('✅ Database connection successful');
      } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
      }
    })();

    // Set bot presence
    c.user.setPresence({
      activities: [{ name: '/help for commands' }],
      status: 'online',
    });
  });
}
