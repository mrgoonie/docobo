# Phase 11: Bot Personality Customization

**Parent**: [Customer Service AI Plan](./plan.md)
**Dependencies**: Phase 08 (GuildCSConfig), Phase 09 (Answer Generation)
**Date**: 2025-12-02 | **Priority**: LOW | **Status**: PENDING

---

## Overview

Enable per-guild customization of bot personality via system prompt. Allows server owners to define tone, style, and behavior of AI responses.

---

## Key Insights (From Research)

- **System prompt budget**: 200-400 tokens (fixed allocation)
- **Temperature**: Lower (0.3-0.5) for consistent personality
- **Storage**: Already have `systemPrompt` field in `GuildCSConfig`
- **Default prompt**: Friendly, professional, community-focused

---

## Requirements

1. `/cs personality set` - Open modal to edit system prompt
2. `/cs personality view` - Show current prompt
3. `/cs personality reset` - Reset to default
4. `/cs personality preview <question>` - Test prompt with sample question
5. Character limit: 2000 chars (~400 tokens)

---

## Database Schema

Already exists in `GuildCSConfig`:
```prisma
model GuildCSConfig {
  // ... other fields
  systemPrompt    String?  @db.Text    // Custom bot personality
}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Personality Configuration                    │
└──────────────────────────────────────────────────────────────┘

/cs personality set
        │
        ▼
┌─────────────────────┐
│   Modal Component   │
│   (TextInput)       │
└─────────┬───────────┘
          │ Submit
          ▼
┌─────────────────────┐
│   Validate Length   │
│   (max 2000 chars)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Save to Config    │
│   (GuildCSConfig)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Confirmation      │
│   Embed             │
└─────────────────────┘
```

---

## Related Files

- `src/bot/commands/cs.ts` - Add personality subcommands
- `src/services/personality.ts` - Personality CRUD operations
- `src/modals/personality-editor.ts` - Modal component
- `src/constants/prompts.ts` - Default prompts

---

## Implementation Steps

### 1. Default Prompts (15 min)
```typescript
// src/constants/prompts.ts
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer service assistant for this Discord community.

Guidelines:
- Answer questions based ONLY on the provided knowledge base documents
- If you don't have information, say "I don't have that information in my knowledge base"
- Be friendly, concise, and professional
- Use bullet points for lists
- Include relevant document titles when citing sources
- Keep responses under 500 words unless detail is explicitly requested`;

export const PROMPT_TEMPLATES = {
  friendly: `You are a warm and friendly community helper. Use casual language, emojis occasionally, and make users feel welcome.`,

  professional: `You are a professional support agent. Maintain formal tone, provide precise answers, and use structured responses.`,

  technical: `You are a technical expert. Use precise terminology, include code examples when relevant, and explain concepts thoroughly.`,

  brief: `You are a concise helper. Give short, direct answers. Only elaborate when asked.`,
};

export const MAX_PROMPT_LENGTH = 2000;
```

### 2. Personality Service (30 min)
```typescript
// src/services/personality.ts
export class PersonalityService {
  async getPrompt(guildId: string): Promise<string> {
    const config = await prisma.guildCSConfig.findUnique({
      where: { guildId },
      select: { systemPrompt: true },
    });
    return config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  async setPrompt(guildId: string, prompt: string): Promise<void> {
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new ValidationError(`Prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
    }

    await prisma.guildCSConfig.upsert({
      where: { guildId },
      create: { guildId, systemPrompt: prompt },
      update: { systemPrompt: prompt },
    });
  }

  async resetPrompt(guildId: string): Promise<void> {
    await prisma.guildCSConfig.update({
      where: { guildId },
      data: { systemPrompt: null },
    });
  }

  async previewPrompt(
    guildId: string,
    prompt: string,
    sampleQuestion: string
  ): Promise<string> {
    // Generate sample response without saving
    const docs = await searchKnowledgeBase(guildId, sampleQuestion, 2);
    const response = await generateAnswer(sampleQuestion, docs, prompt, openrouter);
    return response.answer;
  }
}
```

### 3. Modal Component (45 min)
```typescript
// src/modals/personality-editor.ts
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function createPersonalityModal(currentPrompt: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('personality-editor')
    .setTitle('Edit Bot Personality');

  const promptInput = new TextInputBuilder()
    .setCustomId('system-prompt')
    .setLabel('System Prompt (max 2000 chars)')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(currentPrompt)
    .setPlaceholder('You are a helpful assistant...')
    .setMaxLength(MAX_PROMPT_LENGTH)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput)
  );

  return modal;
}

// Modal submission handler
export async function handlePersonalityModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const prompt = interaction.fields.getTextInputValue('system-prompt');

  await personalityService.setPrompt(interaction.guildId!, prompt);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('Personality Updated')
        .setDescription('Bot personality has been updated successfully.')
        .addFields({
          name: 'New Prompt',
          value: prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt,
        })
        .setColor(0x00FF00),
    ],
    ephemeral: true,
  });
}
```

### 4. Slash Commands (45 min)
```typescript
// Add to src/bot/commands/cs.ts

// /cs personality set
case 'set': {
  const currentPrompt = await personalityService.getPrompt(interaction.guildId!);
  const modal = createPersonalityModal(currentPrompt);
  await interaction.showModal(modal);
  break;
}

// /cs personality view
case 'view': {
  const prompt = await personalityService.getPrompt(interaction.guildId!);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('Current Bot Personality')
        .setDescription(prompt)
        .setColor(0x5865F2),
    ],
    ephemeral: true,
  });
  break;
}

// /cs personality reset
case 'reset': {
  await personalityService.resetPrompt(interaction.guildId!);
  await interaction.reply({
    content: 'Bot personality has been reset to default.',
    ephemeral: true,
  });
  break;
}

// /cs personality preview <question>
case 'preview': {
  const question = interaction.options.getString('question', true);
  const prompt = await personalityService.getPrompt(interaction.guildId!);

  await interaction.deferReply({ ephemeral: true });

  const preview = await personalityService.previewPrompt(
    interaction.guildId!,
    prompt,
    question
  );

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle('Personality Preview')
        .addFields(
          { name: 'Question', value: question },
          { name: 'Sample Response', value: preview.slice(0, 1000) }
        )
        .setColor(0x5865F2),
    ],
  });
  break;
}

// /cs personality template <template_name>
case 'template': {
  const templateName = interaction.options.getString('template', true);
  const template = PROMPT_TEMPLATES[templateName as keyof typeof PROMPT_TEMPLATES];

  if (!template) {
    await interaction.reply({
      content: `Unknown template. Available: ${Object.keys(PROMPT_TEMPLATES).join(', ')}`,
      ephemeral: true,
    });
    return;
  }

  await personalityService.setPrompt(interaction.guildId!, template);
  await interaction.reply({
    content: `Applied "${templateName}" personality template.`,
    ephemeral: true,
  });
  break;
}
```

### 5. Command Registration (15 min)
```typescript
// Update slash command builder for personality subcommand
.addSubcommandGroup(group =>
  group
    .setName('personality')
    .setDescription('Customize bot personality')
    .addSubcommand(sub =>
      sub.setName('set').setDescription('Edit bot personality prompt')
    )
    .addSubcommand(sub =>
      sub.setName('view').setDescription('View current personality prompt')
    )
    .addSubcommand(sub =>
      sub.setName('reset').setDescription('Reset to default personality')
    )
    .addSubcommand(sub =>
      sub
        .setName('preview')
        .setDescription('Preview response with current personality')
        .addStringOption(opt =>
          opt.setName('question').setDescription('Sample question').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('template')
        .setDescription('Apply a preset personality template')
        .addStringOption(opt =>
          opt
            .setName('template')
            .setDescription('Template name')
            .setRequired(true)
            .addChoices(
              { name: 'Friendly', value: 'friendly' },
              { name: 'Professional', value: 'professional' },
              { name: 'Technical', value: 'technical' },
              { name: 'Brief', value: 'brief' }
            )
        )
    )
)
```

---

## Todo List

- [ ] Create constants/prompts.ts with default prompts
- [ ] Create personality service
- [ ] Create modal component for prompt editing
- [ ] Implement /cs personality set command
- [ ] Implement /cs personality view command
- [ ] Implement /cs personality reset command
- [ ] Implement /cs personality preview command
- [ ] Implement /cs personality template command
- [ ] Register modal submission handler
- [ ] Update command registration
- [ ] Write unit tests

---

## Success Criteria

- [ ] Admins can edit bot personality via modal
- [ ] Current prompt viewable
- [ ] Reset restores default prompt
- [ ] Preview generates sample response
- [ ] Templates apply correctly
- [ ] Prompt persists across restarts

---

## Security Considerations

- Admin-only access (ManageGuild permission)
- Validate prompt length (prevent token abuse)
- Sanitize prompt content (no prompt injection keywords)
- Log prompt changes for audit

---

## Prompt Best Practices (Documentation)

Include in user-facing help:

```markdown
## Writing a Good Personality Prompt

1. **Define the role**: "You are a [role] for [community]"
2. **Set constraints**: "Only answer from knowledge base"
3. **Define tone**: "Be friendly/professional/technical"
4. **Set format**: "Use bullet points", "Keep responses under X words"
5. **Handle unknowns**: "If unsure, say..."

## Example Prompts

**Gaming Community**:
"You are a friendly gaming community helper. Use gaming terminology, be enthusiastic, and include relevant game tips when answering questions."

**Tech Support**:
"You are a technical support specialist. Provide step-by-step solutions, include code examples when relevant, and always verify the issue is resolved."
```

---

## Next Steps

After completion, the Customer Service AI feature is complete. Run full integration tests and prepare for deployment.
