import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../index.js';
import { prisma } from '../../../services/database.js';

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

    // Build role list embed
    const roleFields = guild.roles.map((r) => ({
      name: r.roleName,
      value: `**$${String(r.priceUsd)} ${r.currency}**\n${r.description ?? 'Premium role access'}`,
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x4a90e2)
      .setTitle('Premium Roles')
      .setDescription('Choose a role to unlock exclusive channels and perks.')
      .addFields(roleFields)
      .setFooter({ text: 'Click a role below to purchase' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      // Select menu for role selection will be added in Phase 05
    });
  },
};
