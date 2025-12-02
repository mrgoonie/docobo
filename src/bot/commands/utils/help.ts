import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../index.js';

const builder = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View available commands and documentation');

export const helpCommand: Command = {
  data: builder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x7289da) // Discord Blurple
      .setTitle('Docobo Help')
      .setDescription('Professional paid community management bot')
      .addFields(
        {
          name: 'Member Commands',
          value:
            '`/join` - View and purchase premium roles\n' +
            '`/status` - Check your subscription status\n' +
            '`/help` - Show this help message',
          inline: false,
        },
        {
          name: 'Admin Commands',
          value:
            '`/setup` - Configure paid roles and payment methods\n' +
            '`/config` - Modify role pricing and settings',
          inline: false,
        },
        {
          name: 'Resources',
          value:
            '[Documentation](https://docs.docobo.com)\n' +
            '[Support Server](https://discord.gg/docobo)\n' +
            '[GitHub](https://github.com/docobo/bot)',
          inline: false,
        }
      )
      .setFooter({ text: 'Docobo - Type /help for assistance' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
