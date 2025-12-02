import { ModalSubmitInteraction } from 'discord.js';

// Modal handler registry
type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>;
const modalHandlers = new Map<string, ModalHandler>();

// Register modal handlers
// Example: modalHandlers.set('pricing_input', handlePricingInput);
// Will be populated in Phase 05 (Onboarding Flow)

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  // Extract handler prefix from customId
  const customId = interaction.customId;
  const handlerKey = customId.split('_').slice(0, 2).join('_');

  const handler = modalHandlers.get(handlerKey);

  if (!handler) {
    console.warn(`⚠️ Unknown modal interaction: ${customId}`);
    await interaction.reply({
      content: '❌ This form is no longer active.',
      ephemeral: true,
    });
    return;
  }

  await handler(interaction);
}

// Export for external registration
export function registerModalHandler(prefix: string, handler: ModalHandler): void {
  modalHandlers.set(prefix, handler);
}
