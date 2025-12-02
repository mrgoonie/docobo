import { Client, Events, Guild } from 'discord.js';
import { prisma } from '../../services/database.js';

export function handleGuildCreate(client: Client): void {
  client.on(Events.GuildCreate, (guild: Guild) => {
    console.warn(`🆕 Joined new guild: ${guild.name} (${guild.id})`);

    void (async (): Promise<void> => {
      try {
        // Create guild record with defaults
        await prisma.guild.upsert({
          where: { guildId: guild.id },
          update: { guildName: guild.name },
          create: {
            guildId: guild.id,
            guildName: guild.name,
            polarEnabled: false,
            sepayEnabled: false,
            settings: {
              onboarding_complete: false,
            },
          },
        });

        console.warn(`✅ Guild record created: ${guild.name}`);
      } catch (error) {
        console.error(`❌ Failed to create guild record:`, error);
      }
    })();
  });
}
