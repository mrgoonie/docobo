import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../index.js';
import { prisma } from '../../../services/database.js';

const builder = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure paid roles for your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const setupCommand: Command = {
  data: builder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer immediately (setup might take >3s)
    await interaction.deferReply({ ephemeral: true });

    // Check bot permissions
    const botMember = interaction.guild?.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({
        content:
          '❌ I need **Manage Roles** permission to set up paid roles.\n\n' +
          'Please grant this permission in Server Settings > Roles > Docobo.',
      });
      return;
    }

    // Get or create guild record
    const guild = await prisma.guild.upsert({
      where: { guildId: interaction.guildId! },
      update: { guildName: interaction.guild!.name },
      create: {
        guildId: interaction.guildId!,
        guildName: interaction.guild!.name,
      },
      include: {
        roles: true,
      },
    });

    // Welcome embed
    const embed = new EmbedBuilder()
      .setColor(0x4a90e2) // Docobo Blue
      .setTitle('Welcome to Docobo Setup')
      .setDescription(
        "Let's configure your community monetization. This takes about 3 minutes.\n\n" +
          "**We'll configure:**\n" +
          '1. Which roles to monetize\n' +
          '2. Pricing for each role\n' +
          '3. Payment methods (Polar/SePay)\n\n' +
          '**Current Status:**\n' +
          `- Paid roles: ${guild.roles.length}\n` +
          `- Polar.sh: ${guild.polarEnabled ? 'Enabled' : 'Disabled'}\n` +
          `- SePay: ${guild.sepayEnabled ? 'Enabled' : 'Disabled'}`
      )
      .setFooter({ text: 'Setup progress: Step 1/3' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      // Buttons for next step will be added in Phase 05
    });
  },
};
