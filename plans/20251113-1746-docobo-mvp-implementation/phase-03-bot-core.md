# Phase 03: Discord Bot Core

**Date**: 2025-11-13 | **Priority**: HIGH | **Status**: PENDING

[← Phase 02](./phase-02-database.md) | [Back to Plan](./plan.md) | [Next: Phase 04 →](./phase-04-payment-webhooks.md)

---

## Context

Build Discord bot foundation: gateway connection, slash commands, interaction handling, role management. Implement 3-second response rule, permission checks, error handling.

---

## Key Insights from Research

**Discord.js v14 Features**:
- Undici HTTP client (1300% perf boost)
- Built-in rate limit handling (@discordjs/rest)
- Slash commands require 3-second response (defer pattern for long ops)
- Interaction types: commands, buttons, select menus, modals

**Role Management**:
- Bot role must be ABOVE managed roles in hierarchy
- Principle of least privilege (avoid Administrator)
- Required permissions: `ManageRoles`, `ManageChannels` (setup only)

**UX Patterns**:
- Ephemeral errors (user-only visibility)
- Public confirmations (payment success)
- Progressive disclosure (max 3 choices per step)
- First 15 minutes critical (5-10 sec dropout window)

---

## Requirements

### Functional
- Gateway connection with intents (guilds, members)
- Slash command registration (global + guild-specific)
- Interaction handlers (commands, buttons, select menus)
- Role assignment/removal (on payment events)
- Permission validation (pre-command checks)
- Error handling (3-tier: command → cog → global)

### Non-Functional
- Response time: <3 seconds (all interactions)
- Uptime: auto-reconnect on disconnect
- Rate limit compliance: @discordjs/rest queue
- Type safety: strict TypeScript, no `any`

---

## Architecture Decisions

**1. Command Structure**
```
commands/
├── admin/
│   ├── setup.ts         # Server owner onboarding
│   └── config.ts        # Role/pricing configuration
├── member/
│   ├── join.ts          # View paid roles, purchase
│   └── status.ts        # Check subscription status
└── utils/
    └── help.ts          # Command list, documentation
```

**2. Interaction Handler Pattern**
- Commands: `/setup`, `/join`, `/status`
- Buttons: `confirm_payment`, `cancel_setup`
- Select menus: `role_selection`, `payment_method`
- Modals: `pricing_input`

**3. Permission System**
- Bot requires: `ManageRoles`, `SendMessages`, `UseSlashCommands`
- Admin commands: Check `ManageGuild` permission
- Member commands: No special permissions

---

## Related Code Files

```
/mnt/d/www/docobo/src/
├── index.ts                    # Bot entry point
├── bot/
│   ├── client.ts               # Discord client setup
│   ├── events/
│   │   ├── ready.ts            # Bot ready event
│   │   ├── guildCreate.ts      # New server joined
│   │   └── interactionCreate.ts # Command/button handler
│   ├── commands/
│   │   ├── admin/
│   │   │   └── setup.ts        # Onboarding flow
│   │   ├── member/
│   │   │   └── join.ts         # View/purchase roles
│   │   └── utils/
│   │       └── help.ts         # Help command
│   ├── interactions/
│   │   ├── buttons.ts          # Button handlers
│   │   ├── selectMenus.ts      # Select menu handlers
│   │   └── modals.ts           # Modal handlers
│   └── utils/
│       ├── permissions.ts      # Permission checks
│       ├── roles.ts            # Role management
│       └── embeds.ts           # Embed builders
└── types/
    └── discord.ts              # Custom type definitions
```

---

## Implementation Steps

### Step 1: Create Discord Client
**File**: `src/bot/client.ts`
```typescript
import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { env } from '@/config/env';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.GuildMember],
});

// REST client for slash command registration
export const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

// Register slash commands
export async function registerCommands(commands: any[]): Promise<void> {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    if (env.DISCORD_GUILD_ID) {
      // Guild-specific (instant updates for dev)
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Guild commands registered (${env.DISCORD_GUILD_ID})`);
    } else {
      // Global (1hr cache, production)
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commands });
      console.log('✅ Global commands registered');
    }
  } catch (error) {
    console.error('❌ Command registration failed:', error);
    throw error;
  }
}
```

### Step 2: Create Ready Event Handler
**File**: `src/bot/events/ready.ts`
```typescript
import { Client, Events } from 'discord.js';
import { testDatabaseConnection } from '@/services/database';

export function handleReady(client: Client): void {
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Bot ready! Logged in as ${c.user.tag}`);
    console.log(`📊 Serving ${c.guilds.cache.size} guilds`);

    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed - shutting down');
      process.exit(1);
    }

    // Set bot presence
    c.user.setPresence({
      activities: [{ name: '/help for commands' }],
      status: 'online',
    });
  });
}
```

### Step 3: Create Guild Create Event
**File**: `src/bot/events/guildCreate.ts`
```typescript
import { Client, Events, Guild } from 'discord.js';
import { prisma } from '@/services/database';

export function handleGuildCreate(client: Client): void {
  client.on(Events.GuildCreate, async (guild: Guild) => {
    console.log(`🆕 Joined new guild: ${guild.name} (${guild.id})`);

    try {
      // Create guild record with defaults
      await prisma.guild.upsert({
        where: { guildId: guild.id },
        update: { guildName: guild.name },
        create: {
          guildId: guild.id,
          guildName: guild.name,
          polarEnabled: false,
          sepayEnabled: false,
          settings: {
            onboarding_complete: false,
          },
        },
      });

      console.log(`✅ Guild record created: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Failed to create guild record:`, error);
    }
  });
}
```

### Step 4: Create Interaction Handler
**File**: `src/bot/events/interactionCreate.ts`
```typescript
import { Client, Events, Interaction } from 'discord.js';
import { handleSlashCommand } from '@/bot/commands';
import { handleButton } from '@/bot/interactions/buttons';
import { handleSelectMenu } from '@/bot/interactions/selectMenus';
import { handleModal } from '@/bot/interactions/modals';

export function handleInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Slash command
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      }

      // Button
      else if (interaction.isButton()) {
        await handleButton(interaction);
      }

      // Select menu
      else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      }

      // Modal submit
      else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      }
    } catch (error) {
      console.error('❌ Interaction error:', error);

      // Error response (ephemeral)
      const errorMessage = {
        content: '⚠️ An error occurred while processing your request. Please try again.',
        ephemeral: true,
      };

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
  });
}
```

### Step 5: Create Command Handler
**File**: `src/bot/commands/index.ts`
```typescript
import { ChatInputCommandInteraction, Collection } from 'discord.js';
import { setupCommand } from './admin/setup';
import { joinCommand } from './member/join';
import { helpCommand } from './utils/help';

export interface Command {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>();

// Register commands
commands.set(setupCommand.data.name, setupCommand);
commands.set(joinCommand.data.name, joinCommand);
commands.set(helpCommand.data.name, helpCommand);

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const command = commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: '❌ Unknown command.',
      ephemeral: true,
    });
    return;
  }

  await command.execute(interaction);
}

// Export command data for registration
export const commandData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON());
```

### Step 6: Create Setup Command (Admin)
**File**: `src/bot/commands/admin/setup.ts`
```typescript
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '..';
import { prisma } from '@/services/database';

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure paid roles for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

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
      .setTitle('👋 Welcome to Docobo Setup')
      .setDescription(
        "Let's configure your community monetization. This takes about 3 minutes.\n\n" +
          '**We'll configure:**\n' +
          '1. Which roles to monetize\n' +
          '2. Pricing for each role\n' +
          '3. Payment methods (Polar/SePay)\n\n' +
          '**Current Status:**\n' +
          `• Paid roles: ${guild.roles.length}\n` +
          `• Polar.sh: ${guild.polarEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `• SePay: ${guild.sepayEnabled ? '✅ Enabled' : '❌ Disabled'}`
      )
      .setFooter({ text: 'Setup progress: Step 1/3 • 33% complete' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      // TODO: Add buttons for next step (Phase 05)
    });
  },
};
```

### Step 7: Create Join Command (Member)
**File**: `src/bot/commands/member/join.ts`
```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '..';
import { db } from '@/services/database';

export const joinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('View and purchase premium roles')
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Get guild and paid roles
    const guild = await db.getGuildByDiscordId(interaction.guildId!);

    if (!guild) {
      await interaction.editReply('❌ This server is not configured. Ask an admin to run `/setup`.');
      return;
    }

    if (guild.roles.length === 0) {
      await interaction.editReply(
        '❌ No paid roles available. Ask an admin to configure roles with `/setup`.'
      );
      return;
    }

    // Build role list embed
    const roleFields = guild.roles
      .filter((r) => r.isActive)
      .map((r) => ({
        name: `${r.roleName}`,
        value: `💰 **$${r.priceUsd} ${r.currency}**\n${r.description || 'Premium role access'}`,
        inline: false,
      }));

    const embed = new EmbedBuilder()
      .setColor(0x4a90e2)
      .setTitle('🎭 Premium Roles')
      .setDescription('Choose a role to unlock exclusive channels and perks.')
      .addFields(roleFields)
      .setFooter({ text: 'Click a role below to purchase' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      // TODO: Add select menu for role selection (Phase 05)
    });
  },
};
```

### Step 8: Create Help Command
**File**: `src/bot/commands/utils/help.ts`
```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '..';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View available commands and documentation'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x7289da) // Info Purple
      .setTitle('ℹ️ Docobo Help')
      .setDescription('Professional paid community management bot')
      .addFields(
        {
          name: '👤 Member Commands',
          value:
            '`/join` - View and purchase premium roles\n' +
            '`/status` - Check your subscription status\n' +
            '`/help` - Show this help message',
          inline: false,
        },
        {
          name: '⚙️ Admin Commands',
          value:
            '`/setup` - Configure paid roles and payment methods\n' +
            '`/config` - Modify role pricing and settings',
          inline: false,
        },
        {
          name: '🔗 Resources',
          value:
            '[Documentation](https://docs.docobo.com)\n' +
            '[Support Server](https://discord.gg/docobo)\n' +
            '[GitHub](https://github.com/docobo/bot)',
          inline: false,
        }
      )
      .setFooter({ text: 'Docobo • Type /help for assistance' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
```

### Step 9: Create Role Management Utility
**File**: `src/bot/utils/roles.ts`
```typescript
import { Guild, GuildMember, Role } from 'discord.js';

export async function grantRole(
  guild: Guild,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      console.error(`❌ Role not found: ${roleId}`);
      return false;
    }

    // Check if member already has role
    if (member.roles.cache.has(roleId)) {
      console.log(`ℹ️ Member already has role: ${role.name}`);
      return true;
    }

    await member.roles.add(role);
    console.log(`✅ Granted role ${role.name} to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to grant role:`, error);
    return false;
  }
}

export async function revokeRole(
  guild: Guild,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      console.error(`❌ Role not found: ${roleId}`);
      return false;
    }

    // Check if member has role
    if (!member.roles.cache.has(roleId)) {
      console.log(`ℹ️ Member doesn't have role: ${role.name}`);
      return true;
    }

    await member.roles.remove(role);
    console.log(`✅ Revoked role ${role.name} from ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to revoke role:`, error);
    return false;
  }
}

export async function checkBotRolePosition(guild: Guild, targetRole: Role): Promise<boolean> {
  const botMember = guild.members.me;
  if (!botMember) return false;

  const botHighestRole = botMember.roles.highest;
  return botHighestRole.position > targetRole.position;
}
```

### Step 10: Create Main Bot Entry
**File**: `src/index.ts`
```typescript
import { client, registerCommands } from '@/bot/client';
import { handleReady } from '@/bot/events/ready';
import { handleGuildCreate } from '@/bot/events/guildCreate';
import { handleInteractionCreate } from '@/bot/events/interactionCreate';
import { commandData } from '@/bot/commands';
import { env } from '@/config/env';
import { disconnectDatabase } from '@/services/database';

async function main(): Promise<void> {
  console.log('🚀 Starting Docobo Discord Bot...');

  // Register event handlers
  handleReady(client);
  handleGuildCreate(client);
  handleInteractionCreate(client);

  // Register slash commands
  await registerCommands(commandData);

  // Login to Discord
  await client.login(env.DISCORD_BOT_TOKEN);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    client.destroy();
    await disconnectDatabase();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

---

## Todo Checklist

- [ ] Create `src/bot/client.ts` (Discord client + REST)
- [ ] Create `src/bot/events/ready.ts`
- [ ] Create `src/bot/events/guildCreate.ts`
- [ ] Create `src/bot/events/interactionCreate.ts`
- [ ] Create `src/bot/commands/index.ts` (command registry)
- [ ] Create `src/bot/commands/admin/setup.ts`
- [ ] Create `src/bot/commands/member/join.ts`
- [ ] Create `src/bot/commands/utils/help.ts`
- [ ] Create `src/bot/utils/roles.ts` (grant/revoke)
- [ ] Create `src/index.ts` (main entry)
- [ ] Add bot token to `.env`
- [ ] Run `npm run dev` (test bot connection)
- [ ] Test `/help` command in Discord
- [ ] Test `/setup` command (admin only)
- [ ] Verify bot responds within 3 seconds

---

## Success Criteria

- [ ] Bot connects to Discord gateway
- [ ] Slash commands registered (visible in Discord)
- [ ] `/help` shows embed with command list
- [ ] `/setup` defers reply, checks permissions
- [ ] `/join` shows available roles (if configured)
- [ ] Error handling works (ephemeral error messages)
- [ ] Role hierarchy check prevents permission errors
- [ ] Bot auto-reconnects on disconnect

---

## Security Considerations

### Critical
- **Permission checks**: Admin commands require `ManageGuild`
- **Role hierarchy**: Verify bot role > managed role before assignment
- **Rate limit compliance**: @discordjs/rest handles automatically
- **Token security**: Never log bot token

### Important
- **Ephemeral errors**: User-specific errors not visible to others
- **Input validation**: Sanitize user inputs (prevent injection)
- **Interaction timeouts**: Always defer if operation >3s

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 3-second timeout | HIGH | Defer all non-trivial interactions |
| Rate limit (429) | MEDIUM | @discordjs/rest queue, monitor headers |
| Missing permissions | HIGH | Check bot permissions before command execution |
| Role hierarchy conflict | CRITICAL | Validate bot role position > target role |

---

## Next Steps

1. Test bot connection and commands
2. Verify permission system works
3. Proceed to [Phase 04: Payment Webhooks](./phase-04-payment-webhooks.md)
4. Do NOT implement full onboarding UI yet (Phase 05)

---

**Estimated Time**: 4-6 hours
