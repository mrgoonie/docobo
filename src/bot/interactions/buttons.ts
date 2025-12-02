import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { getSetupState, updateSetupState, clearSetupState } from '../utils/setupState.js';
import { createSetupEmbed, createSuccessEmbed } from '../utils/embeds.js';
import { prisma } from '../../services/database.js';
import { Decimal } from '@prisma/client/runtime/library';

// Button handler registry - maps customId prefixes to handlers
type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;
const buttonHandlers = new Map<string, ButtonHandler>();

// Register setup flow handlers
buttonHandlers.set('setup_resume', handleSetupResume);
buttonHandlers.set('setup_restart', handleSetupRestart);
buttonHandlers.set('setup_pricing', handlePricingModal);
buttonHandlers.set('setup_back', handleSetupBack);
buttonHandlers.set('setup_complete', handleSetupComplete);
buttonHandlers.set('payment_polar', handlePaymentPolar);
buttonHandlers.set('payment_sepay', handlePaymentSepay);
buttonHandlers.set('payment_both', handlePaymentBoth);
buttonHandlers.set('purchase_role', handlePurchaseRole);

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // Extract handler prefix from customId (e.g., 'setup_pricing_modal' -> 'setup_pricing')
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

// Helper: Check if user has ManageGuild permission
function isAdmin(interaction: ButtonInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

async function handlePricingModal(interaction: ButtonInteraction): Promise<void> {
  // Admin check
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can configure setup.',
      ephemeral: true,
    });
    return;
  }

  const state = await getSetupState(interaction.guildId!);
  if (!state?.selectedRoles || state.selectedRoles.length === 0) {
    await interaction.reply({
      content: '❌ No roles selected. Please restart setup.',
      ephemeral: true,
    });
    return;
  }

  // Create modal with text inputs for each role (max 5 roles, max 5 inputs per modal)
  const modal = new ModalBuilder().setCustomId('pricing_modal').setTitle('Set Role Pricing');

  // Add text input for each role (up to 5)
  const rolesToPrice = state.selectedRoles.slice(0, 5);
  for (let i = 0; i < rolesToPrice.length; i++) {
    const roleId = rolesToPrice[i];
    const role = await interaction.guild!.roles.fetch(roleId);

    if (role) {
      const priceInput = new TextInputBuilder()
        .setCustomId(`price_${roleId}`)
        .setLabel(`Price for ${role.name.substring(0, 40)} (USD)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('15.00')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput));
    }
  }

  await interaction.showModal(modal);
}

async function handleSetupComplete(interaction: ButtonInteraction): Promise<void> {
  // Admin check
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can complete setup.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const state = await getSetupState(interaction.guildId!);
  if (!state) {
    await interaction.editReply({
      content: '❌ Setup state not found. Please restart setup.',
      components: [],
    });
    return;
  }

  // Create paid roles in database
  const guild = await prisma.guild.findUnique({
    where: { guildId: interaction.guildId! },
  });

  if (!guild) {
    await interaction.editReply({
      content: '❌ Guild not found in database.',
      components: [],
    });
    return;
  }

  // Create PaidRole records
  if (state.selectedRoles && state.pricing) {
    for (const roleId of state.selectedRoles) {
      const discordRole = await interaction.guild!.roles.fetch(roleId);
      const price = state.pricing[roleId] || 0;

      if (discordRole) {
        await prisma.paidRole.upsert({
          where: {
            guildId_roleId: {
              guildId: guild.id,
              roleId: roleId,
            },
          },
          update: {
            priceUsd: new Decimal(price),
            roleName: discordRole.name,
            isActive: true,
          },
          create: {
            guildId: guild.id,
            roleId: roleId,
            roleName: discordRole.name,
            priceUsd: new Decimal(price),
            currency: 'USD',
            isActive: true,
          },
        });
      }
    }
  }

  // Update guild payment methods
  await prisma.guild.update({
    where: { guildId: interaction.guildId! },
    data: {
      polarEnabled: state.paymentMethods?.includes('polar') ?? false,
      sepayEnabled: state.paymentMethods?.includes('sepay') ?? false,
    },
  });

  // Mark setup as complete
  await updateSetupState(interaction.guildId!, { completed: true });

  const embed = createSuccessEmbed(
    'Setup Complete!',
    'Your server is now ready to accept payments for premium roles.\n\n' +
      `**Configured Roles:** ${state.selectedRoles?.length || 0}\n` +
      `**Payment Methods:** ${state.paymentMethods?.join(', ') || 'None'}\n\n` +
      '**Next Steps:**\n' +
      '• Share `/join` command with your members\n' +
      '• Monitor payments in your admin dashboard\n' +
      '• Test the flow with a small purchase'
  );

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}

async function handleSetupRestart(interaction: ButtonInteraction): Promise<void> {
  // Admin check
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can restart setup.',
      ephemeral: true,
    });
    return;
  }

  await clearSetupState(interaction.guildId!);

  // Show step 1 again
  const embed = createSetupEmbed(1, 3)
    .setTitle('🔧 Step 1/3: Select Paid Roles')
    .setDescription(
      'Choose which roles members can purchase. These roles will be automatically assigned when payment is confirmed.\n\n' +
        '**Tips:**\n' +
        '• Select only roles you want to monetize\n' +
        '• Ensure bot role is above selected roles in hierarchy\n' +
        '• You can add more roles later'
    );

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('setup_role_select')
      .setPlaceholder('Choose roles to monetize...')
      .setMinValues(1)
      .setMaxValues(5)
  );

  await interaction.update({
    content: null,
    embeds: [embed],
    components: [roleSelect],
  });

  await updateSetupState(interaction.guildId!, { step: 1, completed: false });
}

async function handleSetupResume(interaction: ButtonInteraction): Promise<void> {
  // Admin check
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can resume setup.',
      ephemeral: true,
    });
    return;
  }

  const state = await getSetupState(interaction.guildId!);

  if (!state) {
    await interaction.reply({
      content: '❌ No setup state found. Please run `/setup` again.',
      ephemeral: true,
    });
    return;
  }

  // Resume based on current step
  switch (state.step) {
    case 1: {
      // Show role selection
      const embed1 = createSetupEmbed(1, 3)
        .setTitle('🔧 Step 1/3: Select Paid Roles')
        .setDescription(
          'Choose which roles members can purchase.\n\n' +
            '**Tips:**\n' +
            '• Select only roles you want to monetize\n' +
            '• Ensure bot role is above selected roles in hierarchy'
        );

      const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_role_select')
          .setPlaceholder('Choose roles to monetize...')
          .setMinValues(1)
          .setMaxValues(5)
      );

      await interaction.update({
        content: null,
        embeds: [embed1],
        components: [roleSelect],
      });
      break;
    }

    case 2: {
      // Show pricing step
      const roleNames = await Promise.all(
        (state.selectedRoles || []).map(async (roleId) => {
          const role = await interaction.guild!.roles.fetch(roleId);
          return role ? `• ${role.name}` : '• Unknown Role';
        })
      );

      const embed2 = createSetupEmbed(2, 3)
        .setTitle('💰 Step 2/3: Set Pricing')
        .setDescription(
          `**Selected Roles:**\n${roleNames.join('\n')}\n\n` +
            'Click **Set Prices** to configure pricing.'
        );

      const buttons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('setup_pricing_modal')
          .setLabel('Set Prices')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_back_step1')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        content: null,
        embeds: [embed2],
        components: [buttons2],
      });
      break;
    }

    case 3: {
      // Show payment method selection
      const embed3 = createSetupEmbed(3, 3)
        .setTitle('💳 Step 3/3: Payment Integration')
        .setDescription(
          'Choose which payment methods to enable:\n' +
            '• **Polar.sh** - International payments, subscriptions\n' +
            '• **SePay** - Vietnamese bank transfers\n' +
            '• **Both** - Maximum flexibility'
        );

      const buttons3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

      await interaction.update({
        content: null,
        embeds: [embed3],
        components: [buttons3],
      });
      break;
    }

    default:
      await interaction.reply({
        content: '❌ Invalid setup state. Please run `/setup` again.',
        ephemeral: true,
      });
  }
}

async function handleSetupBack(interaction: ButtonInteraction): Promise<void> {
  // Admin check (called from handleSetupResume, but check here for direct calls)
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can navigate setup.',
      ephemeral: true,
    });
    return;
  }

  const customId = interaction.customId;
  const targetStep = customId.includes('step1') ? 1 : customId.includes('step2') ? 2 : 1;

  await updateSetupState(interaction.guildId!, { step: targetStep });

  // Resume will check admin again, but that's OK - belt and suspenders
  await handleSetupResume(interaction);
}

async function handlePaymentPolar(interaction: ButtonInteraction): Promise<void> {
  await setPaymentMethod(interaction, ['polar']);
}

async function handlePaymentSepay(interaction: ButtonInteraction): Promise<void> {
  await setPaymentMethod(interaction, ['sepay']);
}

async function handlePaymentBoth(interaction: ButtonInteraction): Promise<void> {
  await setPaymentMethod(interaction, ['polar', 'sepay']);
}

async function setPaymentMethod(
  interaction: ButtonInteraction,
  methods: ('polar' | 'sepay')[]
): Promise<void> {
  // Admin check
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Only server admins can configure payment methods.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  await updateSetupState(interaction.guildId!, {
    paymentMethods: methods,
  });

  // Show completion confirmation
  const state = await getSetupState(interaction.guildId!);
  const roleCount = state?.selectedRoles?.length || 0;

  const embed = createSetupEmbed(3, 3)
    .setTitle('✨ Review & Complete')
    .setDescription(
      '**Setup Summary:**\n' +
        `• Paid Roles: ${roleCount}\n` +
        `• Payment Methods: ${methods.map((m) => (m === 'polar' ? 'Polar.sh' : 'SePay')).join(', ')}\n\n` +
        'Click **Complete Setup** to save your configuration.'
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_complete')
      .setLabel('Complete Setup')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup_back_step2')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}

async function handlePurchaseRole(interaction: ButtonInteraction): Promise<void> {
  const roleDbId = interaction.customId.replace('purchase_role_', '');

  await interaction.deferReply({ ephemeral: true });

  // Fetch the paid role
  const paidRole = await prisma.paidRole.findUnique({
    where: { id: roleDbId },
    include: { guild: true },
  });

  if (!paidRole || !paidRole.isActive) {
    await interaction.editReply({
      content: '❌ This role is no longer available for purchase.',
    });
    return;
  }

  // Generate payment reference code
  const refCode = `DOCOBO-${paidRole.guild.guildId}-${paidRole.roleId}-${interaction.user.id}`;

  // Build payment options
  const buttons: ButtonBuilder[] = [];

  if (paidRole.guild.polarEnabled) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Pay with Polar.sh')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://polar.sh/checkout?ref=${refCode}`) // Placeholder URL
    );
  }

  if (paidRole.guild.sepayEnabled) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Pay with SePay (VN)')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://sepay.vn/pay?ref=${refCode}`) // Placeholder URL
    );
  }

  if (buttons.length === 0) {
    await interaction.editReply({
      content: '❌ No payment methods configured. Please contact a server admin.',
    });
    return;
  }

  await interaction.editReply({
    content:
      `**${paidRole.roleName}** - $${String(paidRole.priceUsd)} USD\n\n` +
      'Choose a payment method below. Your role will be granted automatically after payment confirmation.\n\n' +
      `Reference Code: \`${refCode}\``,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
  });
}
