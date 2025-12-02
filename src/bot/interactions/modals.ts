import {
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { getSetupState, updateSetupState } from '../utils/setupState.js';
import { createSetupEmbed } from '../utils/embeds.js';

// Modal handler registry
type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>;
const modalHandlers = new Map<string, ModalHandler>();

// Register pricing modal handler
modalHandlers.set('pricing_modal', handlePricingModalSubmit);

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  // Extract handler prefix from customId
  const customId = interaction.customId;

  // Try exact match first
  let handler = modalHandlers.get(customId);

  // Fallback to prefix match
  if (!handler) {
    const handlerKey = customId.split('_').slice(0, 2).join('_');
    handler = modalHandlers.get(handlerKey);
  }

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

async function handlePricingModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  // Admin check
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ Only server admins can set pricing.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const state = await getSetupState(interaction.guildId!);
  if (!state?.selectedRoles) {
    await interaction.followUp({
      content: '❌ Setup state lost. Please restart with `/setup`.',
      ephemeral: true,
    });
    return;
  }

  // Parse all price inputs
  const pricing: Record<string, number> = {};
  const errors: string[] = [];

  // Regex for valid price format: digits, optionally followed by decimal and up to 2 digits
  const priceRegex = /^\d+(\.\d{1,2})?$/;

  for (const roleId of state.selectedRoles) {
    try {
      const priceInput = interaction.fields.getTextInputValue(`price_${roleId}`).trim();

      // Validate format first (before parseFloat to reject Infinity, scientific notation, etc.)
      if (!priceRegex.test(priceInput)) {
        errors.push(`Invalid format for role: use numbers only (e.g., 15.00)`);
        continue;
      }

      const price = parseFloat(priceInput);

      // Validate price range
      if (isNaN(price) || price <= 0) {
        errors.push(`Price must be greater than 0`);
        continue;
      }

      if (price > 999999.99) {
        errors.push(`Price exceeds maximum ($999,999.99)`);
        continue;
      }

      // Additional safety check for Infinity/NaN edge cases
      if (!Number.isFinite(price)) {
        errors.push(`Invalid price value`);
        continue;
      }

      pricing[roleId] = Math.round(price * 100) / 100; // Round to 2 decimal places
    } catch {
      // Field might not exist if role count changed
      console.warn(`Price field not found for role ${roleId}`);
    }
  }

  // Check for validation errors
  if (errors.length > 0) {
    await interaction.followUp({
      content:
        '❌ Invalid price format.\n\n' +
        '**Examples:**\n' +
        '✅ 15 or 15.00\n' +
        '✅ 9.99\n' +
        '❌ $15 (remove $ symbol)\n' +
        '❌ 15,00 (use . not ,)\n\n' +
        `**Errors:**\n${errors.join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  // Ensure we have at least one valid price
  if (Object.keys(pricing).length === 0) {
    await interaction.followUp({
      content: '❌ No valid prices entered. Please try again.',
      ephemeral: true,
    });
    return;
  }

  // Save pricing to state
  await updateSetupState(interaction.guildId!, {
    step: 3,
    pricing,
  });

  // Build price summary
  const priceList = await Promise.all(
    Object.entries(pricing).map(async ([roleId, price]) => {
      const role = await interaction.guild!.roles.fetch(roleId);
      return `• ${role?.name || 'Unknown Role'}: $${price.toFixed(2)}`;
    })
  );

  // Step 3: Payment Integration
  const embed = createSetupEmbed(3, 3)
    .setTitle('💳 Step 3/3: Payment Integration')
    .setDescription(
      `**Pricing Set:**\n${priceList.join('\n')}\n\n` +
        'Choose which payment methods to enable:\n' +
        '• **Polar.sh** - International payments, subscriptions\n' +
        '• **SePay** - Vietnamese bank transfers\n' +
        '• **Both** - Maximum flexibility'
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('payment_polar')
      .setLabel('Polar.sh Only')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('payment_sepay')
      .setLabel('SePay Only')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('payment_both')
      .setLabel('Enable Both')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}
