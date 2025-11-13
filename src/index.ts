import { Client, Events, GatewayIntentBits } from 'discord.js';
import { env } from './config/env.js';
import { prisma } from './services/database.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (readyClient) => {
  console.warn(`✅ Docobo bot ready! Logged in as ${readyClient.user.tag}`);

  // Test database connection
  void (async (): Promise<void> => {
    try {
      await prisma.$connect();
      console.warn('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  })();
});

client.on(Events.GuildCreate, (guild) => {
  console.warn(`Joined new guild: ${guild.name} (${guild.id})`);

  // Auto-register guild in database
  void (async (): Promise<void> => {
    try {
      await prisma.guild.upsert({
        where: { guildId: guild.id },
        update: { guildName: guild.name },
        create: {
          guildId: guild.id,
          guildName: guild.name,
        },
      });
      console.warn(`✅ Guild ${guild.name} registered in database`);
    } catch (error) {
      console.error('Failed to register guild:', error);
    }
  })();
});

void client.login(env.DISCORD_BOT_TOKEN);
