import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from 'discord.js';
import type { Command } from '../index.js';
import { prisma } from '../../../services/database.js';
import { createSetupEmbed } from '../../utils/embeds.js';
import { getSetupState, updateSetupState } from '../../utils/setupState.js';

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

    // Ensure guild exists in database
    await prisma.guild.upsert({
      where: { guildId: interaction.guildId! },
      update: { guildName: interaction.guild!.name },
      create: {
        guildId: interaction.guildId!,
        guildName: interaction.guild!.name,
      },
    });

    // Get setup state (resume if incomplete)
    const state = await getSetupState(interaction.guildId!);

    if (state && !state.completed) {
      // Resume incomplete setup
      await interaction.editReply({
        content: `👋 You have an incomplete setup from earlier.\n\n**Progress:** Step ${state.step}/3`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('setup_resume')
              .setLabel('Resume Setup')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('setup_restart')
              .setLabel('Start Over')
              .setStyle(ButtonStyle.Secondary)
          ),
        ],
      });
      return;
    }

    // Step 1: Role Selection
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

    await interaction.editReply({
      embeds: [embed],
      components: [roleSelect],
    });

    // Initialize setup state
    await updateSetupState(interaction.guildId!, { step: 1, completed: false });
  },
};
