# Phase 05: Progressive Onboarding Flow

**Date**: 2025-11-13 | **Priority**: HIGH | **Status**: COMPLETED ✅ (2025-12-02)

[← Phase 04](./phase-04-payment-webhooks.md) | [Back to Plan](./plan.md) | [Next: Phase 06 →](./phase-06-testing.md)

---

## Context

Implement progressive disclosure onboarding for server owners (setup) and members (join). Use buttons, select menus, modals. Follow UX research: first 15 min critical, max 3 choices per step.

---

## Key Insights from Research

**UX Principles**:
- First 15 minutes critical (5-10 sec dropout window)
- Progressive disclosure (max 3 choices per step)
- Avoid walls of text (each paragraph increases dropout)
- No DMs (users may disable), use channels/ephemeral
- Step indicators show progress (Step 2/3 • 66% complete)

**Component Constraints**:
- Action rows: 5 max per message
- Buttons: 1 unit width, 5 max per row
- Select menus: 5 units width (full row)
- Modals: 5 text inputs max
- 3-second response rule (defer long operations)

**Design Guidelines** (from research):
- Colors: Docobo Blue (#4A90E2) setup, Success Green (#43B581) confirmations
- Emojis: Strategic (1-2 per section, not every line)
- Embeds: Max 5 fields, 300 char descriptions
- Mobile-first: Test on 375px width

---

## Requirements

### Functional
- Admin onboarding: 3-step setup (roles → pricing → payment)
- Member join flow: role selection → payment initiation
- Interactive components: buttons, select menus, modals
- State persistence (resume partial setup)
- Progress indicators (Step X/Y)

### Non-Functional
- Completion time: <3 minutes (admin setup)
- Response time: <3 seconds (all interactions)
- Mobile compatibility: readable on 375px width
- Accessibility: clear labels, error messages

---

## Architecture Decisions

**1. Setup Flow (Admin)**
```
/setup → Welcome Screen
  ↓
Role Selection (Select Menu) → Selected Roles Preview
  ↓
Pricing Configuration (Modal per role) → Pricing Summary
  ↓
Payment Integration (Buttons: Polar/SePay/Both) → API Key Modal
  ↓
Completion + Test Purchase CTA
```

**2. Join Flow (Member)**
```
/join → Available Roles List
  ↓
Role Selection (Buttons) → Pricing Confirmation
  ↓
Payment Method (Buttons: Polar/SePay) → External Checkout
  ↓
Awaiting Payment (ephemeral) → Webhook grants role → Public confirmation
```

**3. State Management**
- Store setup state in `guild.settings` JSONB
- Track setup progress (roles_selected, pricing_set, payment_configured)
- Resume incomplete setup on `/setup` re-run

---

## Related Code Files

```
/mnt/d/www/docobo/src/bot/
├── commands/
│   └── admin/
│       └── setup.ts              # Update with full flow
├── interactions/
│   ├── buttons.ts                # Button handlers
│   ├── selectMenus.ts            # Select menu handlers
│   └── modals.ts                 # Modal handlers
└── utils/
    ├── embeds.ts                 # Embed builders (colors, formatting)
    └── setupState.ts             # Setup state persistence
```

---

## Implementation Steps

### Step 1: Create Embed Builder Utilities
**File**: `src/bot/utils/embeds.ts`
```typescript
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
```

### Step 2: Create Setup State Manager
**File**: `src/bot/utils/setupState.ts`
```typescript
import { prisma } from '@/services/database';

interface SetupState {
  step: number;
  selectedRoles?: string[]; // Role IDs
  pricing?: Record<string, number>; // roleId -> price
  paymentMethods?: ('polar' | 'sepay')[];
  completed: boolean;
}

export async function getSetupState(guildId: string): Promise<SetupState | null> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
  });

  if (!guild?.settings) return null;

  const settings = guild.settings as any;
  return settings.setupState || null;
}

export async function updateSetupState(
  guildId: string,
  updates: Partial<SetupState>
): Promise<void> {
  const currentState = (await getSetupState(guildId)) || { step: 1, completed: false };

  await prisma.guild.update({
    where: { guildId },
    data: {
      settings: {
        setupState: {
          ...currentState,
          ...updates,
        },
      } as any,
    },
  });
}

export async function clearSetupState(guildId: string): Promise<void> {
  await prisma.guild.update({
    where: { guildId },
    data: {
      settings: {
        setupState: null,
      } as any,
    },
  });
}
```

### Step 3: Update Setup Command with Full Flow
**File**: `src/bot/commands/admin/setup.ts` (UPDATE)
```typescript
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from 'discord.js';
import { Command } from '..';
import { createSetupEmbed } from '@/bot/utils/embeds';
import { getSetupState, updateSetupState } from '@/bot/utils/setupState';

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure paid roles for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
```

### Step 4: Create Select Menu Handler
**File**: `src/bot/interactions/selectMenus.ts`
```typescript
import {
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { createSetupEmbed } from '@/bot/utils/embeds';
import { updateSetupState } from '@/bot/utils/setupState';

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction
): Promise<void> {
  if (interaction.customId === 'setup_role_select') {
    await handleRoleSelection(interaction as RoleSelectMenuInteraction);
  }
}

async function handleRoleSelection(interaction: RoleSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();

  const selectedRoles = interaction.roles;
  const roleIds = Array.from(selectedRoles.keys());

  // Save selected roles to state
  await updateSetupState(interaction.guildId!, {
    step: 2,
    selectedRoles: roleIds,
  });

  // Step 2: Pricing Configuration
  const roleList = selectedRoles.map((role) => `• ${role.name}`).join('\n');

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

  await interaction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}
```

### Step 5: Create Button Handler
**File**: `src/bot/interactions/buttons.ts`
```typescript
import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { getSetupState, updateSetupState, clearSetupState } from '@/bot/utils/setupState';
import { createSetupEmbed, createSuccessEmbed } from '@/bot/utils/embeds';
import { prisma } from '@/services/database';

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  switch (interaction.customId) {
    case 'setup_resume':
      await handleSetupResume(interaction);
      break;
    case 'setup_restart':
      await handleSetupRestart(interaction);
      break;
    case 'setup_pricing_modal':
      await handlePricingModal(interaction);
      break;
    case 'setup_complete':
      await handleSetupComplete(interaction);
      break;
    default:
      await interaction.reply({
        content: '❌ Unknown button interaction.',
        ephemeral: true,
      });
  }
}

async function handlePricingModal(interaction: ButtonInteraction): Promise<void> {
  const state = await getSetupState(interaction.guildId!);
  if (!state?.selectedRoles || state.selectedRoles.length === 0) {
    await interaction.reply({
      content: '❌ No roles selected. Please restart setup.',
      ephemeral: true,
    });
    return;
  }

  // Create modal with text inputs for each role
  const firstRole = await interaction.guild!.roles.fetch(state.selectedRoles[0]);

  const modal = new ModalBuilder()
    .setCustomId('pricing_modal')
    .setTitle('Set Role Pricing');

  // Add text input for first role (simplified MVP - one at a time)
  const priceInput = new TextInputBuilder()
    .setCustomId('price_amount')
    .setLabel(`Price for ${firstRole?.name} (USD)`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('15.00')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput)
  );

  await interaction.showModal(modal);
}

async function handleSetupComplete(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const state = await getSetupState(interaction.guildId!);
  if (!state) {
    await interaction.editReply({
      content: '❌ Setup state not found. Please restart setup.',
      components: [],
    });
    return;
  }

  // Mark setup as complete
  await updateSetupState(interaction.guildId!, { completed: true });

  const embed = createSuccessEmbed(
    'Setup Complete!',
    'Your server is now ready to accept payments for premium roles.\n\n' +
      `**Configured Roles:** ${state.selectedRoles?.length || 0}\n` +
      `**Payment Methods:** ${state.paymentMethods?.join(', ') || 'None'}\n\n` +
      '**Next Steps:**\n' +
      '• Share `/join` command with your members\n' +
      '• Monitor payments in your admin dashboard\n' +
      '• Test the flow with a small purchase'
  );

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });
}

async function handleSetupRestart(interaction: ButtonInteraction): Promise<void> {
  await clearSetupState(interaction.guildId!);
  await interaction.reply({
    content: '🔄 Setup restarted. Run `/setup` to begin.',
    ephemeral: true,
  });
}

async function handleSetupResume(interaction: ButtonInteraction): Promise<void> {
  const state = await getSetupState(interaction.guildId!);
  // Resume logic based on state.step
  await interaction.reply({
    content: `Resuming setup at step ${state?.step}...`,
    ephemeral: true,
  });
}
```

### Step 6: Create Modal Handler
**File**: `src/bot/interactions/modals.ts`
```typescript
import { ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getSetupState, updateSetupState } from '@/bot/utils/setupState';
import { createSetupEmbed } from '@/bot/utils/embeds';
import { prisma } from '@/services/database';

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId === 'pricing_modal') {
    await handlePricingModalSubmit(interaction);
  }
}

async function handlePricingModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferUpdate();

  const priceInput = interaction.fields.getTextInputValue('price_amount');
  const price = parseFloat(priceInput);

  // Validate price
  if (isNaN(price) || price <= 0 || price > 999999.99) {
    await interaction.followUp({
      content:
        '❌ Invalid price format.\n\n' +
        '**Examples:**\n' +
        '✅ 15 or 15.00\n' +
        '✅ 9.99\n' +
        '❌ $15 (remove $ symbol)\n' +
        '❌ 15,00 (use . not ,)',
      ephemeral: true,
    });
    return;
  }

  const state = await getSetupState(interaction.guildId!);
  if (!state?.selectedRoles) {
    await interaction.editReply({
      content: '❌ Setup state lost. Please restart.',
      components: [],
    });
    return;
  }

  // Save pricing (simplified: same price for all roles in MVP)
  const pricing: Record<string, number> = {};
  state.selectedRoles.forEach((roleId) => {
    pricing[roleId] = price;
  });

  await updateSetupState(interaction.guildId!, {
    step: 3,
    pricing,
  });

  // Step 3: Payment Integration
  const embed = createSetupEmbed(3, 3)
    .setTitle('💳 Step 3/3: Payment Integration')
    .setDescription(
      `Pricing set to **$${price.toFixed(2)} USD** for all roles.\n\n` +
        'Choose which payment methods to enable:\n' +
        '• **Polar.sh** - International payments, subscriptions\n' +
        '• **SePay** - Vietnamese bank transfers\n' +
        '• **Both** - Maximum flexibility'
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('payment_polar')
      .setLabel('Polar.sh Only')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('payment_sepay')
      .setLabel('SePay Only')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('payment_both')
      .setLabel('Enable Both')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}
```

### Step 7: Update Member Join Command
**File**: `src/bot/commands/member/join.ts` (UPDATE)
```typescript
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '..';
import { db } from '@/services/database';
import { COLORS } from '@/bot/utils/embeds';
import { EmbedBuilder } from 'discord.js';

export const joinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('View and purchase premium roles')
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = await db.getGuildByDiscordId(interaction.guildId!);

    if (!guild || guild.roles.length === 0) {
      await interaction.editReply(
        '❌ No paid roles available. Ask an admin to run `/setup`.'
      );
      return;
    }

    // Build role buttons (max 5)
    const roleButtons = guild.roles
      .filter((r) => r.isActive)
      .slice(0, 5)
      .map((role) =>
        new ButtonBuilder()
          .setCustomId(`purchase_${role.id}`)
          .setLabel(`${role.roleName} - $${role.priceUsd}`)
          .setStyle(ButtonStyle.Primary)
      );

    const embed = new EmbedBuilder()
      .setColor(COLORS.DOCOBO_BLUE)
      .setTitle('🎭 Premium Roles')
      .setDescription('Choose a role to unlock exclusive channels and perks.')
      .addFields(
        guild.roles
          .filter((r) => r.isActive)
          .map((r) => ({
            name: r.roleName,
            value: `💰 **$${r.priceUsd} ${r.currency}**\n${r.description || 'Premium access'}`,
            inline: false,
          }))
      )
      .setFooter({ text: 'Click a button below to purchase' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(roleButtons)],
    });
  },
};
```

---

## Todo Checklist

### Implementation (COMPLETED ✅)
- [x] Create `src/bot/utils/embeds.ts` (embed builders)
- [x] Create `src/bot/utils/setupState.ts` (state persistence)
- [x] Update `src/bot/commands/admin/setup.ts` (full flow)
- [x] Create `src/bot/interactions/selectMenus.ts`
- [x] Create `src/bot/interactions/buttons.ts`
- [x] Create `src/bot/interactions/modals.ts`
- [x] Update `src/bot/commands/member/join.ts`
- [x] Register interaction handlers in `interactionCreate.ts`

### Critical Fixes Required (FROM CODE REVIEW 2025-12-02)
- [ ] **SECURITY**: Add `ManageGuild` permission checks to all setup button handlers (buttons.ts:100, 186, 217, 334)
- [ ] **SECURITY**: Add input sanitization with regex to pricing modal BEFORE parseFloat (modals.ts:65-79)
- [ ] **DATA INTEGRITY**: Fix race condition in `updateSetupState()` - use optimistic locking or transactions (setupState.ts:22-45)
- [ ] **RUNTIME**: Add role hierarchy validation in `handleRoleSelection()` - check bot role position (selectMenus.ts:54-61)
- [ ] **DATA INTEGRITY**: Wrap `handleSetupComplete()` in Prisma transaction to prevent partial failures (buttons.ts:100-184)

### Important Improvements (RECOMMENDED)
- [ ] Add deduplication for rapid button clicks - use global processing map
- [ ] Fix price display formatting - use `.toFixed(2)` instead of `String()` conversion
- [ ] Enforce 5-role limit explicitly in handlers
- [ ] Fix price validation max value consistency (DB: $99,999,999.99 vs Code: $999,999.99)

### Testing (PENDING Phase 06)
- [ ] Test setup flow (all 3 steps)
- [ ] Test role selection (select menu)
- [ ] Test pricing modal (input validation)
- [ ] Test state persistence (resume setup)
- [ ] Test mobile view (375px width)
- [ ] Test permission bypass attempts (non-admin users)
- [ ] Test race condition scenarios (spam button clicks)

---

## Success Criteria

**Implementation Status**: ✅ CORE FEATURES COMPLETE | ⚠️ SECURITY FIXES NEEDED

- [x] Setup completes in <3 minutes (UX flow implemented)
- [x] All interactions respond within 3 seconds (defer patterns used)
- [x] Select menu shows server roles (RoleSelectMenu implemented)
- [~] Pricing modal validates input (PARTIAL - needs regex sanitization before parseFloat)
- [x] Progress indicators show correct step (Step 2/3 • 66% calculated)
- [x] State persists between interactions (JSONB setupState working)
- [x] Resume setup works (after interruption)
- [x] Join command shows available roles (with purchase buttons)
- [ ] Embeds render correctly on mobile (375px) - NOT TESTED YET

**Code Review Findings (2025-12-02)**:
- ❌ CRITICAL: Permission checks missing in button handlers (security bypass risk)
- ❌ CRITICAL: Race conditions in state updates (data corruption risk)
- ❌ HIGH: Role hierarchy not validated (runtime failure risk)
- ❌ HIGH: No transaction rollback in setup completion (orphaned records risk)
- ⚠️ MEDIUM: Input sanitization incomplete (edge case vulnerabilities)

**Overall Score**: 7.5/10
**Status**: Implementation complete but requires security/data integrity fixes before Phase 06 testing

---

## Security Considerations

### Critical
- **Admin-only commands**: Verify `ManageGuild` permission
- **State validation**: Verify state integrity before processing
- **Price validation**: Reject negative, zero, or excessively large prices

### Important
- **Ephemeral replies**: Keep setup process private (not visible to members)
- **Input sanitization**: Validate all modal inputs server-side
- **Rate limiting**: Prevent interaction spam

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| State corruption | MEDIUM | Validate state structure, allow restart |
| Modal timeout (15 min) | LOW | Warn users, allow resume |
| Role hierarchy conflict | HIGH | Check bot role position before save |
| Incomplete setup | MEDIUM | Resume functionality, clear indicators |

---

## Next Steps

1. Test full onboarding flow
2. Verify UX on mobile devices
3. Proceed to [Phase 06: Testing & QA](./phase-06-testing.md)
4. Prepare for integration testing (webhook → role grant)

---

**Estimated Time**: 4-5 hours
