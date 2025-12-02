import { StringSelectMenuInteraction } from 'discord.js';

// Select menu handler registry
type SelectMenuHandler = (interaction: StringSelectMenuInteraction) => Promise<void>;
const selectMenuHandlers = new Map<string, SelectMenuHandler>();

// Register select menu handlers
// Example: selectMenuHandlers.set('role_selection', handleRoleSelection);
// Will be populated in Phase 05 (Onboarding Flow)

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  // Extract handler prefix from customId
  const customId = interaction.customId;
  const handlerKey = customId.split('_').slice(0, 2).join('_');

  const handler = selectMenuHandlers.get(handlerKey);

  if (!handler) {
    console.warn(`⚠️ Unknown select menu interaction: ${customId}`);
    await interaction.reply({
      content: '❌ This menu is no longer active.',
      ephemeral: true,
    });
    return;
  }

  await handler(interaction);
}

// Export for external registration
export function registerSelectMenuHandler(prefix: string, handler: SelectMenuHandler): void {
  selectMenuHandlers.set(prefix, handler);
}
