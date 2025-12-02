/**
 * Knowledge Base Command - /kb add, list, remove, update, search
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { Command } from '../index.js';
import { env } from '../../../config/env.js';
import { COLORS, createErrorEmbed, createInfoEmbed } from '../../utils/embeds.js';
import * as knowledgeBase from '../../../services/knowledge-base.js';
import { generateDocument } from '../../../services/openrouter.js';
import { processUrl, processText, isValidUrl } from '../../../services/url-processor.js';

const builder = new SlashCommandBuilder()
  .setName('kb')
  .setDescription('Manage knowledge base documents')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a document from URL or text')
      .addStringOption((opt) =>
        opt
          .setName('input')
          .setDescription('URL or text content to add')
          .setRequired(true)
          .setMaxLength(4000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List all knowledge documents')
      .addIntegerOption((opt) => opt.setName('page').setDescription('Page number').setMinValue(1))
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a document')
      .addStringOption((opt) => opt.setName('id').setDescription('Document ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Search knowledge base')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('Search query').setRequired(true).setMaxLength(200)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View a document')
      .addStringOption((opt) => opt.setName('id').setDescription('Document ID').setRequired(true))
  );

async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check for OpenRouter API key
  if (!env.OPENROUTER_API_KEY) {
    await interaction.editReply({
      embeds: [
        createErrorEmbed(
          'OpenRouter API key not configured.\n\n' +
            'Please set `OPENROUTER_API_KEY` in your environment variables.'
        ),
      ],
    });
    return;
  }

  const input = interaction.options.getString('input', true);
  const guildId = interaction.guildId!;

  // Send initial processing message
  await interaction.editReply({
    embeds: [
      createInfoEmbed(
        'Processing...',
        isValidUrl(input) ? `Fetching ${input}...` : 'Processing text content...'
      ),
    ],
  });

  try {
    // Process input (URL or text)
    let content: string;
    let sourceUrl: string | undefined;

    if (isValidUrl(input)) {
      const processed = await processUrl(input);
      content = processed.content;
      sourceUrl = processed.sourceUrl;

      if (processed.usedLlmsTxt) {
        console.log(`[KB] Using llms.txt for ${sourceUrl}`);
      }
    } else {
      content = processText(input);
    }

    // Generate document using OpenRouter
    await interaction.editReply({
      embeds: [createInfoEmbed('Generating...', 'Creating structured document with AI...')],
    });

    const generated = await generateDocument(content, {
      apiKey: env.OPENROUTER_API_KEY,
    });

    // Get internal guild ID
    const guild = await knowledgeBase.ensureGuild(guildId, interaction.guild!.name);

    // Save to database
    const document = await knowledgeBase.createDocument({
      guildId: guild,
      title: generated.title,
      description: generated.description,
      content: generated.content,
      sourceUrl,
      metadata: generated.metadata,
    });

    // Success embed
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS_GREEN)
      .setTitle('Document Added')
      .setDescription(generated.description)
      .addFields(
        { name: 'Title', value: generated.title, inline: true },
        { name: 'Category', value: generated.metadata.category || 'general', inline: true },
        { name: 'ID', value: `\`${document.id}\``, inline: true }
      )
      .setFooter({ text: `Words: ${generated.metadata.wordCount || 0}` })
      .setTimestamp();

    if (sourceUrl) {
      embed.addFields({ name: 'Source', value: sourceUrl });
    }

    if (generated.metadata.tags?.length) {
      embed.addFields({ name: 'Tags', value: generated.metadata.tags.join(', ') });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[KB] Add error:', error);
    await interaction.editReply({
      embeds: [
        createErrorEmbed(
          error instanceof Error ? error.message : 'Failed to add document. Please try again.'
        ),
      ],
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const page = interaction.options.getInteger('page') || 1;
  const guildId = interaction.guildId!;

  try {
    // Get guild internal ID
    const guild = await knowledgeBase.ensureGuild(guildId, interaction.guild!.name);
    const { documents, total, pages } = await knowledgeBase.listDocuments(guild, page);

    if (documents.length === 0) {
      await interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Knowledge Base Empty',
            'No documents found. Use `/kb add` to add your first document.'
          ),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.DOCOBO_BLUE)
      .setTitle('Knowledge Base')
      .setDescription(`${total} document${total !== 1 ? 's' : ''} total`)
      .setFooter({ text: `Page ${page}/${pages}` })
      .setTimestamp();

    for (const doc of documents) {
      const metadata = doc.metadata as { category?: string } | null;
      embed.addFields({
        name: doc.title,
        value:
          `${doc.description.slice(0, 100)}${doc.description.length > 100 ? '...' : ''}\n` +
          `ID: \`${doc.id}\` • ${metadata?.category || 'general'}`,
      });
    }

    // Pagination buttons
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (page > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`kb_list_${page - 1}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (page < pages) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`kb_list_${page + 1}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    await interaction.editReply({
      embeds: [embed],
      components: row.components.length > 0 ? [row] : [],
    });
  } catch (error) {
    console.error('[KB] List error:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Failed to list documents.')],
    });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const docId = interaction.options.getString('id', true);
  const guildId = interaction.guildId!;

  try {
    // Verify document belongs to guild
    const belongsToGuild = await knowledgeBase.documentBelongsToGuild(docId, guildId);
    if (!belongsToGuild) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Document not found or does not belong to this server.')],
      });
      return;
    }

    // Get document for confirmation
    const doc = await knowledgeBase.getDocument(docId);
    if (!doc) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Document not found.')],
      });
      return;
    }

    // Confirmation buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`kb_delete_confirm_${docId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('kb_delete_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [
        createInfoEmbed(
          'Confirm Deletion',
          `Are you sure you want to delete **${doc.title}**?\n\nThis action cannot be undone.`
        ),
      ],
      components: [row],
    });
  } catch (error) {
    console.error('[KB] Remove error:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Failed to remove document.')],
    });
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);
  const guildId = interaction.guildId!;

  try {
    const results = await knowledgeBase.searchDocuments(guildId, query);

    if (results.length === 0) {
      await interaction.editReply({
        embeds: [
          createInfoEmbed(
            'No Results',
            `No documents found matching "${query}".\n\nTry different keywords or use \`/kb list\` to see all documents.`
          ),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.DOCOBO_BLUE)
      .setTitle(`Search Results: "${query}"`)
      .setDescription(`Found ${results.length} matching document${results.length !== 1 ? 's' : ''}`)
      .setTimestamp();

    for (const result of results) {
      embed.addFields({
        name: result.title,
        value:
          `${result.description.slice(0, 100)}${result.description.length > 100 ? '...' : ''}\n` +
          `ID: \`${result.id}\` • Relevance: ${(result.relevance * 100).toFixed(0)}%`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[KB] Search error:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Search failed. Please try again.')],
    });
  }
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const docId = interaction.options.getString('id', true);
  const guildId = interaction.guildId!;

  try {
    // Verify document belongs to guild
    const belongsToGuild = await knowledgeBase.documentBelongsToGuild(docId, guildId);
    if (!belongsToGuild) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Document not found or does not belong to this server.')],
      });
      return;
    }

    const doc = await knowledgeBase.getDocument(docId);
    if (!doc) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Document not found.')],
      });
      return;
    }

    const metadata = doc.metadata as {
      category?: string;
      tags?: string[];
      wordCount?: number;
    } | null;

    // Truncate content for Discord embed limit (4096 chars)
    const contentPreview =
      doc.content.length > 2000
        ? doc.content.slice(0, 2000) + '\n\n*[Content truncated...]*'
        : doc.content;

    const embed = new EmbedBuilder()
      .setColor(COLORS.DOCOBO_BLUE)
      .setTitle(doc.title)
      .setDescription(contentPreview)
      .addFields({ name: 'Description', value: doc.description })
      .setFooter({
        text: `ID: ${doc.id} • ${metadata?.category || 'general'} • ${metadata?.wordCount || 0} words`,
      })
      .setTimestamp(doc.createdAt);

    if (doc.sourceUrl) {
      embed.addFields({ name: 'Source', value: doc.sourceUrl });
    }

    if (metadata?.tags?.length) {
      embed.addFields({ name: 'Tags', value: metadata.tags.join(', ') });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[KB] View error:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Failed to view document.')],
    });
  }
}

export const kbCommand: Command = {
  data: builder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer reply (operations may take time)
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'search':
        await handleSearch(interaction);
        break;
      case 'view':
        await handleView(interaction);
        break;
      default:
        await interaction.editReply({
          embeds: [createErrorEmbed('Unknown subcommand.')],
        });
    }
  },
};
