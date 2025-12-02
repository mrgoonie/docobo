# Code Review: Phase 05 - Progressive Onboarding Flow

**Review Date**: 2025-12-02
**Phase**: Phase 05 - Progressive Onboarding Flow
**Reviewer**: Code Reviewer Agent
**Files Changed**: 6 files (+726 lines)

---

## Scope

**Files Reviewed:**
- `src/bot/utils/embeds.ts` (NEW)
- `src/bot/utils/setupState.ts` (NEW)
- `src/bot/commands/admin/setup.ts` (MODIFIED)
- `src/bot/interactions/selectMenus.ts` (MODIFIED)
- `src/bot/interactions/buttons.ts` (MODIFIED)
- `src/bot/interactions/modals.ts` (MODIFIED)
- `src/bot/commands/member/join.ts` (MODIFIED)
- `src/bot/events/interactionCreate.ts` (MODIFIED)

**Lines Analyzed**: ~777 lines (including context)
**Review Focus**: Phase 05 implementation - 3-step onboarding, role selection, pricing config, payment integration
**Build Status**: ✅ TypeScript compilation successful
**Lint Status**: ✅ No ESLint errors

---

## Overall Assessment

**Score**: 7.5/10

Implementation delivers core onboarding functionality with good UX patterns (progressive disclosure, defer/reply, ephemeral messages). TypeScript builds cleanly, no linting errors. However, **CRITICAL security issues** exist in permission validation, input sanitization, and race condition handling. Business logic gaps in role hierarchy checks and price validation could cause production failures.

**Strengths:**
- Clean separation of concerns (embeds, state, handlers)
- Proper Discord.js patterns (defer, ephemeral, component limits)
- Type-safe throughout, no `any` types
- Good error handling structure
- State persistence via JSONB enables resume functionality

**Weaknesses:**
- Missing permission checks at critical points
- No input sanitization for text fields
- Race conditions in state updates
- Incomplete role hierarchy validation
- Placeholder payment URLs (expected at MVP stage)
- No transaction rollback on setup failure

---

## Critical Issues (MUST FIX)

### 1. **Permission Bypass in Button Handlers** ⚠️ SECURITY
**Location**: `src/bot/interactions/buttons.ts:100, 186, 217, 334`

**Issue**: Button handlers (`handleSetupComplete`, `handleSetupRestart`, `handleSetupResume`, `handleSetupBack`) do NOT verify user has `ManageGuild` permission. Any user clicking cached buttons can manipulate setup state.

**Impact**: Malicious user can restart setup, complete partial setups, or corrupt guild configuration by interacting with old messages.

**Example Attack:**
```typescript
// User without ManageGuild clicks "Complete Setup" button from old message
// No permission check → setup completes with attacker-controlled state
await handleSetupComplete(interaction); // NO PERMISSION CHECK
```

**Fix Required**:
```typescript
async function handleSetupComplete(interaction: ButtonInteraction): Promise<void> {
  // ADD THIS CHECK
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ Only server administrators can complete setup.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  // ... rest of handler
}
```

**Apply to**: All setup flow handlers (`handleSetupRestart`, `handleSetupResume`, `handleSetupBack`, `handlePricingModal`).

---

### 2. **No Input Sanitization in Pricing Modal** ⚠️ SECURITY
**Location**: `src/bot/interactions/modals.ts:65-79`

**Issue**: Price input accepts raw text without sanitization. RegEx injection possible if downstream code uses price strings in regex operations. Float parsing vulnerable to edge cases (`Infinity`, `NaN`, scientific notation).

**Current Code**:
```typescript
const priceInput = interaction.fields.getTextInputValue(`price_${roleId}`);
const price = parseFloat(priceInput); // Accepts "1e10", "Infinity", "+0.00"
```

**Vulnerable Scenarios**:
- Input: `"Infinity"` → `parseFloat("Infinity") = Infinity` → passes `isNaN()` check
- Input: `"1e308"` → Valid float but exceeds display limits
- Input: `"  15.00  "` → Works but inconsistent

**Fix Required**:
```typescript
const priceInput = interaction.fields.getTextInputValue(`price_${roleId}`).trim();

// Validate format with regex BEFORE parsing
if (!/^\d+(\.\d{1,2})?$/.test(priceInput)) {
  errors.push(`Invalid format for role ${roleId}: use format "15.00"`);
  continue;
}

const price = parseFloat(priceInput);

// Existing validation
if (isNaN(price) || price <= 0) { /* ... */ }
if (price > 999999.99) { /* ... */ }
```

---

### 3. **Race Condition in Setup State Updates** ⚠️ DATA CORRUPTION
**Location**: `src/bot/utils/setupState.ts:22-45`

**Issue**: `updateSetupState` uses read-modify-write pattern without transaction. Concurrent button clicks (e.g., spam clicking "Set Prices" + "Back") can corrupt state.

**Race Scenario**:
```
Time | Thread A               | Thread B
-----|------------------------|------------------------
T0   | Read state: step=1     | Read state: step=1
T1   | Modify: step=2         | Modify: step=3
T2   | Write: {step:2}        | Write: {step:3}
T3   | State: step=3          | (A's update lost)
```

**Current Code**:
```typescript
export async function updateSetupState(
  guildId: string,
  updates: Partial<SetupState>
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { guildId } }); // READ
  const currentSettings = (guild?.settings as Record<string, unknown>) || {};
  const currentState = (currentSettings.setupState as SetupState) || { step: 1, completed: false };

  await prisma.guild.update({ // WRITE (no locking)
    where: { guildId },
    data: { settings: { ...currentSettings, setupState: { ...currentState, ...updates } } },
  });
}
```

**Fix Options**:

**Option A - Optimistic Locking** (Recommended):
```typescript
export async function updateSetupState(
  guildId: string,
  updates: Partial<SetupState>
): Promise<boolean> {
  const guild = await prisma.guild.findUnique({ where: { guildId } });
  const currentSettings = (guild?.settings as Record<string, unknown>) || {};
  const currentState = (currentSettings.setupState as SetupState) || { step: 1, completed: false };

  const newSettings = {
    ...currentSettings,
    setupState: { ...currentState, ...updates },
  };

  try {
    await prisma.guild.updateMany({
      where: {
        guildId,
        updatedAt: guild?.updatedAt, // Compare timestamp
      },
      data: { settings: newSettings },
    });
    return true;
  } catch {
    return false; // Retry in caller
  }
}
```

**Option B - Database Transaction**:
```typescript
await prisma.$transaction(async (tx) => {
  const guild = await tx.guild.findUnique({ where: { guildId }, select: { settings: true } });
  // ... update logic
  await tx.guild.update({ where: { guildId }, data: { settings: newSettings } });
});
```

**Apply to**: `updateSetupState()`, `clearSetupState()` in `setupState.ts`.

---

### 4. **Missing Role Hierarchy Check** ⚠️ RUNTIME FAILURE
**Location**: `src/bot/commands/admin/setup.ts:73-94`

**Issue**: Setup allows selecting roles ABOVE bot's highest role. Discord API will reject role assignments (403 Forbidden) at payment time, causing silent failures.

**Current Check** (Line 30):
```typescript
if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) { /* ... */ }
```

This checks **permission flag**, NOT **role hierarchy**.

**Discord Limitation**:
> Bots can only manage roles **below** their highest role in the server's role list.

**Missing Validation**:
```typescript
// In src/bot/interactions/selectMenus.ts:54-61 (after role selection)
const botMember = interaction.guild!.members.me!;
const botHighestRole = botMember.roles.highest;

for (const role of selectedRoles.values()) {
  if (role.position >= botHighestRole.position) {
    await interaction.followUp({
      content: `❌ Cannot manage **${role.name}** - it's above my role in the hierarchy.\n\n` +
               `**Fix**: Drag my role above "${role.name}" in Server Settings > Roles.`,
      ephemeral: true,
    });
    return; // Block progression to step 2
  }

  if (role.managed) {
    await interaction.followUp({
      content: `❌ **${role.name}** is managed by an integration and cannot be assigned.`,
      ephemeral: true,
    });
    return;
  }
}
```

**Apply to**: `selectMenus.ts:handleRoleSelection()` before saving to state.

---

### 5. **No Rollback on Setup Completion Failure** ⚠️ INCONSISTENT STATE
**Location**: `src/bot/interactions/buttons.ts:100-184`

**Issue**: `handleSetupComplete` creates multiple `PaidRole` records + updates guild flags WITHOUT transaction. Partial failure (e.g., DB timeout on 3rd role) leaves orphaned records.

**Current Flow**:
```typescript
// Loop creates roles one-by-one
for (const roleId of state.selectedRoles) {
  await prisma.paidRole.upsert({ /* ... */ }); // Fails on iteration 3
}

// Update guild (never executes if loop fails)
await prisma.guild.update({ /* ... */ });

// Mark complete (never executes)
await updateSetupState(interaction.guildId!, { completed: true });
```

**Result**: 2 roles created, 3 missing, guild still shows incomplete setup.

**Fix Required**:
```typescript
async function handleSetupComplete(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const state = await getSetupState(interaction.guildId!);
  if (!state) { /* ... */ }

  try {
    await prisma.$transaction(async (tx) => {
      // Get guild within transaction
      const guild = await tx.guild.findUnique({
        where: { guildId: interaction.guildId! },
      });
      if (!guild) throw new Error('Guild not found');

      // Create all roles atomically
      if (state.selectedRoles && state.pricing) {
        for (const roleId of state.selectedRoles) {
          const discordRole = await interaction.guild!.roles.fetch(roleId);
          const price = state.pricing[roleId] || 0;

          if (discordRole) {
            await tx.paidRole.upsert({
              where: { guildId_roleId: { guildId: guild.id, roleId } },
              update: { priceUsd: new Decimal(price), roleName: discordRole.name, isActive: true },
              create: { guildId: guild.id, roleId, roleName: discordRole.name, priceUsd: new Decimal(price), currency: 'USD', isActive: true },
            });
          }
        }
      }

      // Update guild payment flags atomically
      await tx.guild.update({
        where: { guildId: interaction.guildId! },
        data: {
          polarEnabled: state.paymentMethods?.includes('polar') ?? false,
          sepayEnabled: state.paymentMethods?.includes('sepay') ?? false,
        },
      });
    });

    // Mark complete AFTER transaction succeeds
    await updateSetupState(interaction.guildId!, { completed: true });

    // Success message
    const embed = createSuccessEmbed(/* ... */);
    await interaction.editReply({ embeds: [embed], components: [] });

  } catch (error) {
    console.error('Setup completion failed:', error);
    await interaction.editReply({
      content: '❌ Setup failed. Please try again or contact support.\n\n' +
               `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      components: [],
    });
  }
}
```

---

## Important Issues (SHOULD FIX)

### 6. **Hardcoded Component Limits Not Enforced**
**Location**: `src/bot/commands/admin/setup.ts:88`, `buttons.ts:76`

**Issue**: Role select menu allows 1-5 roles, but modal in `handlePricingModal` only processes first 5. If 5 roles selected, form works. If logic changes to allow 10 roles, modal breaks (Discord limit: 5 inputs/modal).

**Fix**: Add explicit check:
```typescript
if (state.selectedRoles.length > 5) {
  await interaction.reply({
    content: '❌ Maximum 5 roles supported per setup. Please re-run setup with fewer roles.',
    ephemeral: true,
  });
  return;
}
```

---

### 7. **Price Validation Inconsistency**
**Location**: `modals.ts:74-77`

**Issue**: Allows max `$999,999.99` but database schema allows `Decimal(10,2)` = `$99,999,999.99`. Inconsistent limits.

**Fix**:
- **Option A**: Change schema to `Decimal(8,2)` (max $999,999.99)
- **Option B**: Update validation to `price > 99999999.99`

---

### 8. **No Deduplication for Button Click Spam**
**Location**: All button handlers

**Issue**: User can spam-click "Complete Setup" button, triggering multiple DB writes before first completes. Discord.js does NOT deduplicate rapid clicks.

**Fix**: Add processing flag:
```typescript
const processingSetup = new Set<string>(); // Global state

async function handleSetupComplete(interaction: ButtonInteraction): Promise<void> {
  const key = `${interaction.guildId}-setup-complete`;

  if (processingSetup.has(key)) {
    await interaction.reply({
      content: '⏳ Setup is already being processed...',
      ephemeral: true,
    });
    return;
  }

  processingSetup.add(key);
  try {
    await interaction.deferUpdate();
    // ... setup logic
  } finally {
    processingSetup.delete(key);
  }
}
```

---

### 9. **Ephemeral Error Messages May Be Missed**
**Location**: `buttons.ts:62-68`, `selectMenus.ts:44-49`

**Issue**: If user closes Discord during setup, ephemeral error messages disappear. User has no way to debug.

**Fix**: Log errors to audit channel (future enhancement) OR use followUp instead of reply:
```typescript
// Instead of reply (disappears):
await interaction.reply({ content: '❌ Error', ephemeral: true });

// Use editReply (persists in original message):
await interaction.editReply({ content: '❌ Error', components: [] });
```

---

### 10. **Pricing Displayed as String Conversion**
**Location**: `join.ts:60`, `buttons.ts:451`

**Issue**: `String(r.priceUsd)` converts Decimal to string without formatting. May display ugly values like `"15.5"` instead of `"15.50"`.

**Fix**:
```typescript
// Change:
value: `💰 **$${String(r.priceUsd)} ${r.currency}**\n...`

// To:
value: `💰 **$${Number(r.priceUsd).toFixed(2)} ${r.currency}**\n...`
```

---

## Minor Suggestions (NICE TO HAVE)

### 11. **Magic Strings for customId Prefixes**
**Location**: `buttons.ts:15-33`, `selectMenus.ts:15`

**Issue**: Handler keys like `'setup_resume'`, `'payment_polar'` are scattered. Easy to typo.

**Suggestion**:
```typescript
// src/bot/constants/interactionIds.ts
export const BUTTON_IDS = {
  SETUP_RESUME: 'setup_resume',
  SETUP_RESTART: 'setup_restart',
  PAYMENT_POLAR: 'payment_polar',
  // ...
} as const;

// Usage:
buttonHandlers.set(BUTTON_IDS.SETUP_RESUME, handleSetupResume);
```

---

### 12. **Placeholder Payment URLs**
**Location**: `buttons.ts:429, 438`

**Issue**: URLs like `https://polar.sh/checkout?ref=${refCode}` are placeholders. Must integrate actual Polar/SePay SDK in Phase 07.

**Expected**: This is acceptable for Phase 05 MVP. Mark as TODO for integration phase.

---

### 13. **No Logging for Setup Flow Events**
**Location**: All handlers

**Issue**: No structured logging for setup progress (useful for debugging production issues).

**Suggestion**:
```typescript
console.log(`[Setup] Guild ${interaction.guildId} started step 1`);
console.log(`[Setup] Guild ${interaction.guildId} selected roles:`, roleIds);
```

---

### 14. **Type Assertion Without Null Check**
**Location**: `setupState.ts:18-19`, `buttons.ts:113`

**Issue**: `guild.settings as Record<string, unknown>` assumes non-null. Already checked with `guild?.settings`, but TS doesn't flow type.

**Minor Improvement**:
```typescript
const settings = (guild?.settings as Record<string, unknown> | null) || {};
```

---

### 15. **Progress Bar Math Off-by-One**
**Location**: `embeds.ts:13`

**Issue**: Step 1/3 shows 33% progress. Should show 0% (not started) or 33% (completed). Ambiguous.

**Suggestion**:
```typescript
// Show progress as "steps completed" not "current step"
const progress = Math.round(((step - 1) / totalSteps) * 100);
// Step 1 → 0%, Step 2 → 33%, Step 3 → 67%, Complete → 100%
```

---

## Positive Observations

1. **Excellent Separation of Concerns**: Embeds, state, handlers cleanly separated
2. **Type-Safe Throughout**: No `any` types, proper guards (`isRoleSelectMenu()`)
3. **Discord.js Best Practices**: Proper defer/reply, ephemeral errors, component builders
4. **Resume Functionality**: Setup state persistence enables UX recovery
5. **Input Validation**: Price validation covers NaN, negative, overflow cases
6. **Error Handling Structure**: Try-catch at top level, fallback messages
7. **Component Limits Respected**: Max 5 roles, max 5 modal inputs
8. **Idempotent Upserts**: `paidRole.upsert` prevents duplicate records
9. **Clean Build**: No TypeScript errors, no linting issues

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Add `ManageGuild` permission checks to ALL setup button handlers
2. **[CRITICAL]** Wrap `handleSetupComplete` in transaction to prevent partial failures
3. **[CRITICAL]** Add role hierarchy validation in `handleRoleSelection`
4. **[HIGH]** Fix race condition in `updateSetupState` (use optimistic locking)
5. **[HIGH]** Sanitize price input with regex before `parseFloat()`
6. **[MEDIUM]** Add deduplication for rapid button clicks (global processing map)
7. **[MEDIUM]** Fix price display formatting (`.toFixed(2)`)
8. **[MEDIUM]** Enforce 5-role limit explicitly in handlers
9. **[LOW]** Extract magic strings to constants file
10. **[LOW]** Add structured logging for setup events

---

## Metrics

- **Type Coverage**: 100% (no `any` types detected)
- **Test Coverage**: 0% (no tests written for Phase 05 yet - see Phase 06)
- **Build Status**: ✅ PASS
- **Linting Issues**: 0
- **Security Vulnerabilities**: 5 critical, 4 high
- **Code Complexity**: Medium (handlers avg 20-40 LOC)

---

## Next Steps

1. **Fix Critical Security Issues** (Est. 2-3 hrs)
   - Add permission checks (15 min)
   - Add transaction wrapper (30 min)
   - Add role hierarchy validation (30 min)
   - Fix race conditions (1 hr)
   - Sanitize pricing input (15 min)

2. **Update Phase 05 Plan** (Est. 15 min)
   - Mark tasks as complete
   - Document known issues for Phase 07 (payment URLs)

3. **Proceed to Phase 06: Testing** (Est. 4-5 hrs)
   - Unit tests for state management
   - Integration tests for setup flow
   - Mock Discord interactions
   - Webhook replay tests

---

## Unresolved Questions

1. **Role Hierarchy**: Should bot auto-reorder itself above selected roles? (Requires `ManageRoles` permission)
2. **Setup Timeout**: Should incomplete setups expire after 24 hours? (Prevents stale state accumulation)
3. **Multi-Currency**: Schema has `currency` field but UI hardcodes USD. Support VND for SePay?
4. **Refund Flow**: What happens to role if payment refunded AFTER role granted? (Not in MVP scope)
5. **Setup Restart**: Should `handleSetupRestart` delete existing `PaidRole` records? (Currently keeps orphans)

---

## Conclusion

Phase 05 delivers functional onboarding flow with good UX patterns. However, **critical security gaps** (permission bypass, race conditions) and **business logic issues** (role hierarchy, transaction rollback) MUST be addressed before production. Estimated fix time: 2-3 hours.

After fixes, Phase 05 should be marked COMPLETE and proceed to Phase 06 (Testing & QA).

**Recommended Next Action**: Fix Critical Issues #1-5, then run integration tests before marking phase complete.
