import {
  AnySelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { createSetupEmbed } from '../utils/embeds.js';
import { updateSetupState } from '../utils/setupState.js';

// Select menu handler registry
type SelectMenuHandler = (interaction: AnySelectMenuInteraction) => Promise<void>;
const selectMenuHandlers = new Map<string, SelectMenuHandler>();

// Register setup role select handler
selectMenuHandlers.set('setup_role', handleRoleSelection);

export async function handleSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
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

async function handleRoleSelection(interaction: AnySelectMenuInteraction): Promise<void> {
  // Type guard for role select menu
  if (!interaction.isRoleSelectMenu()) {
    await interaction.reply({
      content: '❌ Invalid interaction type.',
      ephemeral: true,
    });
    return;
  }

  // Admin check
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ Only server admins can select roles for monetization.',
      ephemeral: true,
    });
    return;
  }

  const roleInteraction = interaction;
  await roleInteraction.deferUpdate();

  const selectedRoles = roleInteraction.roles;
  const roleIds = Array.from(selectedRoles.keys());

  // Check role hierarchy - bot must be able to manage these roles
  const botMember = interaction.guild?.members.me;
  if (!botMember) {
    await roleInteraction.editReply({
      content: '❌ Could not verify bot permissions. Please try again.',
      components: [],
    });
    return;
  }

  const botHighestRole = botMember.roles.highest;
  const invalidRoles: string[] = [];

  for (const [, role] of selectedRoles) {
    // Check if role is above bot's highest role
    if (role.position >= botHighestRole.position) {
      invalidRoles.push(role.name);
    }
    // Skip @everyone role
    if (role.id === interaction.guildId) {
      invalidRoles.push('@everyone (cannot be monetized)');
    }
    // Skip managed roles (bot roles, integrations)
    if (role.managed) {
      invalidRoles.push(`${role.name} (managed role)`);
    }
  }

  if (invalidRoles.length > 0) {
    await roleInteraction.editReply({
      content:
        '❌ Cannot monetize the following roles:\n' +
        invalidRoles.map((r) => `• ${r}`).join('\n') +
        '\n\n**Fix:** Move the Docobo bot role ABOVE the roles you want to monetize in Server Settings > Roles.',
      components: [],
    });
    return;
  }

  // Filter out invalid role IDs (just in case)
  const validRoleIds = roleIds.filter((id) => {
    const role = selectedRoles.get(id);
    return id !== interaction.guildId && role && role.position < botHighestRole.position;
  });

  if (validRoleIds.length === 0) {
    await roleInteraction.editReply({
      content: '❌ No valid roles selected. Please select roles below the bot role.',
      components: [],
    });
    return;
  }

  // Save selected roles to state
  await updateSetupState(roleInteraction.guildId!, {
    step: 2,
    selectedRoles: validRoleIds,
  });

  // Step 2: Pricing Configuration
  const roleList = validRoleIds
    .map((id) => {
      const role = selectedRoles.get(id);
      return `• ${role?.name ?? 'Unknown Role'}`;
    })
    .join('\n');

  const embed = createSetupEmbed(2, 3)
    .setTitle('💰 Step 2/3: Set Pricing')
    .setDescription(
      'Set a price for each role. Members will pay this amount once for permanent access.\n\n' +
        `**Selected Roles:**\n${roleList}\n\n` +
        'Click **Set Prices** to configure pricing for each role.'
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_pricing_modal')
      .setLabel('Set Prices')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup_back_step1')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  await roleInteraction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}
