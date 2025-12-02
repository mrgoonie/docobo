import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

// Discord client with required intents
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.GuildMember],
});

// REST client for slash command registration
export const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

// Register slash commands (guild-specific in dev, global in prod)
export async function registerCommands(
  commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]
): Promise<void> {
  try {
    console.warn(`🔄 Registering ${commands.length} slash commands...`);

    if (env.DISCORD_GUILD_ID) {
      // Guild-specific (instant updates for dev)
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
        body: commands,
      });
      console.warn(`✅ Guild commands registered (${env.DISCORD_GUILD_ID})`);
    } else {
      // Global (1hr cache, production)
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commands });
      console.warn('✅ Global commands registered');
    }
  } catch (error) {
    console.error('❌ Command registration failed:', error);
    throw error;
  }
}
