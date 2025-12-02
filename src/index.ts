import { client, registerCommands } from './bot/client.js';
import { handleReady } from './bot/events/ready.js';
import { handleGuildCreate } from './bot/events/guildCreate.js';
import { handleInteractionCreate } from './bot/events/interactionCreate.js';
import { commandData } from './bot/commands/index.js';
import { env } from './config/env.js';
import { prisma } from './services/database.js';

async function main(): Promise<void> {
  console.warn('🚀 Starting Docobo Discord Bot...');

  // Register event handlers
  handleReady(client);
  handleGuildCreate(client);
  handleInteractionCreate(client);

  // Register slash commands
  await registerCommands(commandData);

  // Login to Discord
  await client.login(env.DISCORD_BOT_TOKEN);

  // Graceful shutdown handler - synchronous for signal handlers
  const shutdown = (): void => {
    console.warn('\n🛑 Shutting down...');
    // Disconnect from Discord gateway
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    client.destroy();
    // Close database connection
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
