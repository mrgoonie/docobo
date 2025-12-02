import { Client, Events, Interaction } from 'discord.js';
import { handleSlashCommand } from '../commands/index.js';
import { handleButton } from '../interactions/buttons.js';
import { handleSelectMenu } from '../interactions/selectMenus.js';
import { handleModal } from '../interactions/modals.js';

export function handleInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void (async (): Promise<void> => {
      try {
        // Slash command
        if (interaction.isChatInputCommand()) {
          await handleSlashCommand(interaction);
        }
        // Button click
        else if (interaction.isButton()) {
          await handleButton(interaction);
        }
        // Select menu selection (string or role)
        else if (interaction.isAnySelectMenu()) {
          await handleSelectMenu(interaction);
        }
        // Modal submission
        else if (interaction.isModalSubmit()) {
          await handleModal(interaction);
        }
      } catch (error) {
        console.error('❌ Interaction error:', error);

        // Error response (ephemeral)
        const errorMessage = {
          content: '⚠️ An error occurred while processing your request. Please try again.',
          ephemeral: true,
        };

        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        }
      }
    })();
  });
}
