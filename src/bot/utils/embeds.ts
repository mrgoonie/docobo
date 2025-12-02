import { EmbedBuilder } from 'discord.js';

// Colors from design guidelines
export const COLORS = {
  DOCOBO_BLUE: 0x4a90e2,
  SUCCESS_GREEN: 0x43b581,
  WARNING_AMBER: 0xf0a020,
  ERROR_RED: 0xf04747,
  INFO_PURPLE: 0x7289da,
};

export function createSetupEmbed(step: number, totalSteps: number): EmbedBuilder {
  const progress = Math.round((step / totalSteps) * 100);

  return new EmbedBuilder()
    .setColor(COLORS.DOCOBO_BLUE)
    .setFooter({ text: `Setup progress: Step ${step}/${totalSteps} • ${progress}% complete` })
    .setTimestamp();
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS_GREEN)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR_RED)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.INFO_PURPLE)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

export function createWarningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.WARNING_AMBER)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}
