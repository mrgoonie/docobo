import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { Command } from '../index.js';
import { prisma } from '../../../services/database.js';
import { COLORS } from '../../utils/embeds.js';

const builder = new SlashCommandBuilder()
  .setName('join')
  .setDescription('View and purchase premium roles')
  .setDMPermission(false);

export const joinCommand: Command = {
  data: builder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Get guild and paid roles
    const guild = await prisma.guild.findUnique({
      where: { guildId: interaction.guildId! },
      include: {
        roles: {
          where: { isActive: true },
          orderBy: { priceUsd: 'asc' },
        },
      },
    });

    if (!guild) {
      await interaction.editReply(
        '❌ This server is not configured. Ask an admin to run `/setup`.'
      );
      return;
    }

    if (guild.roles.length === 0) {
      await interaction.editReply(
        '❌ No paid roles available. Ask an admin to configure roles with `/setup`.'
      );
      return;
    }

    // Check if payment methods are configured
    if (!guild.polarEnabled && !guild.sepayEnabled) {
      await interaction.editReply(
        '❌ No payment methods configured. Ask an admin to complete `/setup`.'
      );
      return;
    }

    // Build role list embed
    const roleFields = guild.roles.slice(0, 5).map((r) => ({
      name: `🎭 ${r.roleName}`,
      value: `💰 **$${String(r.priceUsd)} ${r.currency}**\n${r.description ?? 'Premium role access'}`,
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setColor(COLORS.DOCOBO_BLUE)
      .setTitle('🎭 Premium Roles')
      .setDescription(
        'Choose a role below to unlock exclusive channels and perks.\n' +
          'Your role will be granted automatically after payment confirmation.'
      )
      .addFields(roleFields)
      .setFooter({ text: 'Click a button below to purchase' })
      .setTimestamp();

    // Build role buttons (max 5 per row, max 5 rows)
    const roleButtons = guild.roles
      .slice(0, 5) // Limit to 5 roles per row
      .map((role) =>
        new ButtonBuilder()
          .setCustomId(`purchase_role_${role.id}`)
          .setLabel(`${role.roleName} - $${String(role.priceUsd)}`)
          .setStyle(ButtonStyle.Primary)
      );

    // Add payment method indicators
    const paymentMethods: string[] = [];
    if (guild.polarEnabled) paymentMethods.push('Polar.sh');
    if (guild.sepayEnabled) paymentMethods.push('SePay (VN)');

    if (paymentMethods.length > 0) {
      embed.addFields({
        name: '💳 Payment Methods',
        value: paymentMethods.join(' • '),
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      components:
        roleButtons.length > 0
          ? [new ActionRowBuilder<ButtonBuilder>().addComponents(roleButtons)]
          : [],
    });
  },
};
