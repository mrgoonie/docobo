import { ButtonInteraction } from 'discord.js';

// Button handler registry - maps customId prefixes to handlers
type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;
const buttonHandlers = new Map<string, ButtonHandler>();

// Register button handlers
// Example: buttonHandlers.set('confirm_payment', handlePaymentConfirm);
// Will be populated in Phase 05 (Onboarding Flow)

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // Extract handler prefix from customId (e.g., 'confirm_payment_123' -> 'confirm_payment')
  const customId = interaction.customId;
  const handlerKey = customId.split('_').slice(0, 2).join('_');

  const handler = buttonHandlers.get(handlerKey);

  if (!handler) {
    // Unknown button - log for debugging
    console.warn(`⚠️ Unknown button interaction: ${customId}`);
    await interaction.reply({
      content: '❌ This button is no longer active.',
      ephemeral: true,
    });
    return;
  }

  await handler(interaction);
}

// Export for external registration
export function registerButtonHandler(prefix: string, handler: ButtonHandler): void {
  buttonHandlers.set(prefix, handler);
}
