import { ChatInputCommandInteraction, Collection, SlashCommandBuilder } from 'discord.js';
import { setupCommand } from './admin/setup.js';
import { joinCommand } from './member/join.js';
import { helpCommand } from './utils/help.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>();

// Register commands
commands.set(setupCommand.data.name, setupCommand);
commands.set(joinCommand.data.name, joinCommand);
commands.set(helpCommand.data.name, helpCommand);

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: '❌ Unknown command.',
      ephemeral: true,
    });
    return;
  }

  await command.execute(interaction);
}

// Export command data for registration
export const commandData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON());
