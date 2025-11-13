# Docobo Code Standards

**Version**: 1.0
**Last Updated**: 2025-11-13
**Enforcement**: ESLint + Prettier + Husky pre-commit hooks

---

## TypeScript Conventions

### General Rules

**Strict Mode**: Always enabled (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Type Annotations**:
- Required for function parameters and return types
- Inferred types allowed for variables (when obvious)
- No `any` type (enforced by ESLint)

**Example**:
```typescript
// ✅ GOOD
function calculatePrice(basePrice: number, tax: number): number {
  return basePrice * (1 + tax);
}

// ❌ BAD
function calculatePrice(basePrice, tax) {
  return basePrice * (1 + tax);
}
```

---

### Naming Conventions

**Variables & Functions**: camelCase
```typescript
const memberCount = 42;
function grantRole(userId: string) {}
```

**Classes & Interfaces**: PascalCase
```typescript
class SubscriptionService {}
interface PaymentProvider {}
```

**Constants**: UPPER_SNAKE_CASE
```typescript
const MAX_RETRIES = 3;
const WEBHOOK_TIMEOUT_MS = 30000;
```

**Private Properties**: Prefix with underscore
```typescript
class RoleManager {
  private _discordClient: Client;
}
```

**Type Aliases**: PascalCase
```typescript
type WebhookEvent = 'payment.verified' | 'subscription.active';
```

**Enum Values**: PascalCase
```typescript
enum SubscriptionStatus {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
}
```

---

### File Organization

**Directory Structure**:
```
src/
├── bot/                    # Discord bot logic
│   ├── commands/           # Slash commands (one per file)
│   ├── events/             # Event handlers
│   └── utils/              # Bot-specific utilities
├── webhooks/               # Payment webhooks
│   ├── polar/              # Polar.sh handlers
│   ├── sepay/              # SePay.vn handlers
│   └── shared/             # Shared webhook utilities
├── services/               # Business logic
│   ├── database.ts         # Prisma client singleton
│   ├── role-manager.ts     # Role grant/revoke
│   └── subscription.ts     # Subscription logic
├── config/
│   └── env.ts              # Environment validation
├── types/                  # TypeScript type definitions
├── index.ts                # Bot entry point
└── webhook-server.ts       # Fastify entry point
```

**File Naming**:
- Commands: `command-name.ts` (kebab-case)
- Services: `service-name.ts` (kebab-case)
- Classes: `ClassName.ts` (PascalCase matching class name)
- Utils: `util-function.ts` (kebab-case)

**Example**:
```
src/bot/commands/
├── setup.ts                # /setup command
├── join.ts                 # /join command
└── help.ts                 # /help command
```

---

### Imports

**Order**:
1. External dependencies
2. Internal absolute imports
3. Internal relative imports

**Grouping**: Separate with blank line

**Example**:
```typescript
// External dependencies
import { Client, GatewayIntentBits } from 'discord.js';
import { Prisma } from '@prisma/client';

// Internal absolute imports
import { env } from '@/config/env.js';
import { RoleManager } from '@/services/role-manager.js';

// Internal relative imports
import { createEmbed } from './utils/embed-builder.js';
```

**Note**: Use `.js` extension for ES modules (TypeScript compiles to `.js`)

---

### Error Handling

#### Error Handling Pattern

**Always use try-catch for async operations**:
```typescript
async function processWebhook(payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = webhookSchema.parse(payload);

    // Process
    await updateSubscription(validated);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error('Invalid webhook payload', { error });
      throw new ValidationError('Invalid payload format');
    }

    logger.error('Webhook processing failed', { error });
    throw error;
  }
}
```

#### Custom Error Classes

**Create domain-specific errors**:
```typescript
// src/errors/index.ts
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
```

**Usage**:
```typescript
if (!interaction.memberPermissions?.has('ManageGuild')) {
  throw new PermissionError('Requires ManageGuild permission');
}
```

#### Discord Error Handling

**User-facing errors**: Ephemeral messages
```typescript
try {
  await grantRole(member, role);
} catch (error) {
  await interaction.reply({
    content: 'Failed to grant role. Please contact server admin.',
    ephemeral: true,
  });
  logger.error('Role grant failed', { error, userId: member.id });
}
```

**Critical errors**: Notify admin
```typescript
async function notifyAdmin(guild: Guild, error: Error): Promise<void> {
  const owner = await guild.fetchOwner();
  await owner.send({
    embeds: [createErrorEmbed(error)],
  });
}
```

---

### Database Query Patterns

#### Prisma Best Practices

**Always use transactions for multi-step operations**:
```typescript
async function createSubscription(data: SubscriptionData): Promise<Subscription> {
  return await prisma.$transaction(async (tx) => {
    // Create subscription
    const subscription = await tx.subscription.create({ data });

    // Log webhook event
    await tx.webhookEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: 'SUBSCRIPTION_CREATED',
        // ...
      },
    });

    return subscription;
  });
}
```

**Use select to fetch only needed fields**:
```typescript
// ✅ GOOD
const guild = await prisma.guild.findUnique({
  where: { guildId },
  select: { id: true, guildName: true, prefix: true },
});

// ❌ BAD (fetches all fields)
const guild = await prisma.guild.findUnique({
  where: { guildId },
});
```

**Use indexes for frequently queried fields**:
```prisma
model Subscription {
  // ...
  @@index([memberId])
  @@index([status])
  @@index([provider])
}
```

---

#### Query Error Handling

**Check for null results**:
```typescript
const guild = await prisma.guild.findUnique({ where: { guildId } });
if (!guild) {
  throw new NotFoundError('Guild not configured');
}
```

**Handle unique constraint violations**:
```typescript
try {
  await prisma.webhookEvent.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation (duplicate event)
      logger.info('Duplicate webhook event, ignoring');
      return; // Idempotent
    }
  }
  throw error;
}
```

---

### Testing Requirements

#### Unit Tests

**Filename**: `filename.test.ts`
**Location**: `tests/unit/`

**Example**:
```typescript
// tests/unit/role-manager.test.ts
import { RoleManager } from '@/services/role-manager';

describe('RoleManager', () => {
  describe('grantRole', () => {
    it('should grant role to member', async () => {
      const manager = new RoleManager(mockClient);
      await manager.grantRole(memberId, roleId);

      expect(mockMember.roles.add).toHaveBeenCalledWith(roleId);
    });

    it('should throw PermissionError if bot role too low', async () => {
      const manager = new RoleManager(mockClient);

      await expect(
        manager.grantRole(memberId, adminRoleId)
      ).rejects.toThrow(PermissionError);
    });
  });
});
```

#### Integration Tests

**Filename**: `feature.integration.test.ts`
**Location**: `tests/integration/`

**Example**:
```typescript
// tests/integration/webhook-flow.integration.test.ts
describe('Webhook Flow', () => {
  it('should grant role on subscription.active webhook', async () => {
    // Send webhook
    const response = await request(app)
      .post('/webhooks/polar')
      .set('X-Polar-Signature', validSignature)
      .send(polarWebhookPayload);

    expect(response.status).toBe(200);

    // Verify database updated
    const subscription = await prisma.subscription.findUnique({
      where: { externalSubscriptionId: 'sub_123' },
    });
    expect(subscription?.status).toBe('ACTIVE');

    // Verify role granted
    const member = await guild.members.fetch(userId);
    expect(member.roles.cache.has(roleId)).toBe(true);
  });
});
```

---

#### Coverage Requirements

**Minimum**: 80% overall
**Critical paths**: 100% (payment webhooks, role management)

**Measurement**:
```bash
npm run test:coverage
```

**Exclusions**:
- Type definitions (`*.d.ts`)
- Configuration files
- Mock data

---

### Git Commit Conventions

#### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code formatting (no logic change)
- `refactor`: Code restructuring (no behavior change)
- `test`: Add/update tests
- `chore`: Build/tooling changes

**Scope**: Component affected
- `bot`: Discord bot
- `webhooks`: Webhook server
- `database`: Prisma schema/migrations
- `services`: Business logic services
- `docs`: Documentation

**Subject**:
- Imperative mood ("add" not "added")
- Lowercase first letter
- No period at end
- Max 50 characters

**Body**:
- Wrap at 72 characters
- Explain what and why (not how)
- Separate from subject with blank line

**Footer**:
- Reference issues: `Closes #42`, `Refs #123`
- Breaking changes: `BREAKING CHANGE: description`

---

#### Examples

**Feature addition**:
```
feat(webhooks): add SePay webhook handler

Implement SePay payment verification webhook endpoint.
Includes OAuth2 token validation and deduplication logic.

Closes #42
```

**Bug fix**:
```
fix(bot): prevent duplicate role grants

Add unique constraint check before role assignment.
Fixes race condition when multiple webhooks arrive simultaneously.

Fixes #58
```

**Breaking change**:
```
feat(database): change subscription status enum

BREAKING CHANGE: Renamed PENDING to PENDING_PAYMENT for clarity.
Requires migration: `npm run db:migrate`

Closes #67
```

**Documentation**:
```
docs(readme): add troubleshooting section

Add common issues and solutions for developers.
```

---

### Code Review Checklist

**Before submitting PR**:
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] No `any` types (except unavoidable)
- [ ] Functions have return type annotations
- [ ] Error handling implemented
- [ ] No secrets in code
- [ ] Database queries use transactions (if multi-step)
- [ ] Prisma client generated (`npm run db:generate`)
- [ ] Documentation updated (if public API)
- [ ] Commit messages follow conventions

**Reviewer checklist**:
- [ ] Logic correct and follows requirements
- [ ] Error handling comprehensive
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Tests cover edge cases
- [ ] Code readable and maintainable
- [ ] No over-engineering
- [ ] Follows existing patterns

---

## Code Quality Tools

### ESLint Configuration

**File**: `.eslintrc.json`
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

**Run**:
```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

---

### Prettier Configuration

**File**: `.prettierrc`
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

**Run**:
```bash
npm run format
```

---

### Husky Pre-Commit Hook

**File**: `.husky/pre-commit`
```bash
#!/bin/sh
npx lint-staged
```

**File**: `.lintstagedrc.json`
```json
{
  "*.ts": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

**Automatic**: Runs on `git commit`

---

## Security Best Practices

### Environment Variables

**Never hardcode secrets**:
```typescript
// ❌ BAD
const botToken = 'YOUR_BOT_TOKEN_HERE';

// ✅ GOOD
import { env } from '@/config/env.js';
const botToken = env.DISCORD_BOT_TOKEN;
```

**Validate on startup**:
```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().url(),
  // ...
});

export const env = envSchema.parse(process.env);
```

---

### Input Validation

**Always validate external input**:
```typescript
import { z } from 'zod';

const polarWebhookSchema = z.object({
  event: z.enum(['subscription.created', 'subscription.active']),
  data: z.object({
    id: z.string(),
    // ...
  }),
});

export async function handlePolarWebhook(payload: unknown): Promise<void> {
  const validated = polarWebhookSchema.parse(payload);
  // Safe to use validated data
}
```

**User input from Discord**:
```typescript
// Validate command options
const price = interaction.options.getNumber('price', true);
if (price <= 0 || price > 999999.99) {
  throw new ValidationError('Price must be between $0.01 and $999,999.99');
}
```

---

### SQL Injection Prevention

**Prisma prevents SQL injection** (uses parameterized queries)

**Raw queries**: Use parameters
```typescript
// ✅ GOOD
const guilds = await prisma.$queryRaw`
  SELECT * FROM guilds WHERE guildId = ${guildId}
`;

// ❌ BAD (vulnerable to injection)
const guilds = await prisma.$queryRawUnsafe(
  `SELECT * FROM guilds WHERE guildId = '${guildId}'`
);
```

---

### Webhook Signature Verification

**Always verify signatures**:
```typescript
import { verifyWebhookSignature } from '@polar-sh/sdk';

export async function handlePolarWebhook(
  payload: string,
  signature: string
): Promise<void> {
  const isValid = verifyWebhookSignature({
    payload,
    signature,
    secret: env.POLAR_WEBHOOK_SECRET,
  });

  if (!isValid) {
    throw new SecurityError('Invalid webhook signature');
  }

  // Safe to process
}
```

---

### Logging Security

**Never log secrets**:
```typescript
// ❌ BAD
logger.info('Bot starting', { token: env.DISCORD_BOT_TOKEN });

// ✅ GOOD
logger.info('Bot starting', { clientId: env.DISCORD_CLIENT_ID });
```

**Sanitize error logs**:
```typescript
// ❌ BAD
logger.error('Payment failed', { payload });

// ✅ GOOD
logger.error('Payment failed', {
  eventType: payload.event,
  subscriptionId: payload.data.id,
  // Exclude sensitive fields
});
```

---

## Performance Best Practices

### Database Queries

**Avoid N+1 queries**:
```typescript
// ❌ BAD
const subscriptions = await prisma.subscription.findMany();
for (const sub of subscriptions) {
  const member = await prisma.member.findUnique({ where: { id: sub.memberId } });
}

// ✅ GOOD
const subscriptions = await prisma.subscription.findMany({
  include: { member: true },
});
```

**Use pagination for large datasets**:
```typescript
const PAGE_SIZE = 100;

const subscriptions = await prisma.subscription.findMany({
  skip: page * PAGE_SIZE,
  take: PAGE_SIZE,
  orderBy: { createdAt: 'desc' },
});
```

---

### Discord API

**Batch operations**:
```typescript
// ❌ BAD (serial)
for (const member of members) {
  await member.roles.add(roleId);
}

// ✅ GOOD (parallel)
await Promise.all(
  members.map((member) => member.roles.add(roleId))
);
```

**Cache results**:
```typescript
// Cache guild roles (avoid repeated API calls)
const roles = guild.roles.cache;
const premiumRole = roles.find((r) => r.name === 'Premium');
```

---

### Webhook Processing

**Return 200 immediately**:
```typescript
export async function handleWebhook(request: FastifyRequest, reply: FastifyReply) {
  // ACK immediately
  reply.code(200).send({ received: true });

  // Process asynchronously
  setImmediate(async () => {
    try {
      await processWebhookEvent(request.body);
    } catch (error) {
      logger.error('Webhook processing failed', { error });
    }
  });
}
```

---

## Documentation Standards

### JSDoc Comments

**Required for**:
- Public functions/methods
- Complex logic
- Non-obvious behavior

**Format**:
```typescript
/**
 * Grants a Discord role to a member.
 *
 * @param member - The Discord member to grant the role to
 * @param roleId - The Discord role snowflake ID
 * @throws {PermissionError} If bot role is below target role
 * @throws {NotFoundError} If role does not exist
 * @returns Promise resolving when role is granted
 *
 * @example
 * await grantRole(member, '123456789012345678');
 */
export async function grantRole(member: GuildMember, roleId: string): Promise<void> {
  // Implementation
}
```

---

### README Files

**Each major directory should have README.md**:

**Example**: `src/webhooks/README.md`
```markdown
# Webhook Handlers

Payment provider webhook processing.

## Structure
- `polar/` - Polar.sh integration
- `sepay/` - SePay.vn integration
- `shared/` - Shared utilities

## Adding New Provider
1. Create directory `src/webhooks/provider-name/`
2. Implement signature verification
3. Add event handlers
4. Register endpoint in `webhook-server.ts`
5. Add tests in `tests/integration/`
```

---

## Deprecation Policy

**When deprecating code**:
1. Mark with `@deprecated` JSDoc tag
2. Add deprecation date
3. Provide alternative
4. Log warning when used
5. Remove after 90 days

**Example**:
```typescript
/**
 * @deprecated since v0.2.0, use `createSubscription` instead
 * @see {@link createSubscription}
 * Will be removed in v0.3.0 (2025-03-01)
 */
export async function addSubscription(data: SubscriptionData) {
  logger.warn('addSubscription is deprecated, use createSubscription');
  return createSubscription(data);
}
```

---

## FAQ

### Q: When should I use `unknown` vs `any`?
**A**: Always use `unknown` for external data. Validate with Zod before using. Never use `any` (ESLint enforces this).

### Q: How do I handle long-running operations in slash commands?
**A**: Use `interaction.deferReply()` within 3 seconds, then `interaction.editReply()` when complete.

### Q: Should I use `class` or functions?
**A**: Prefer functions. Use classes only for stateful services (e.g., `RoleManager` holds Discord client reference).

### Q: When should I create a new service file?
**A**: When logic is >100 lines, reused in multiple places, or represents distinct business domain.

### Q: How do I test Discord API calls?
**A**: Mock Discord.js client using Jest. See `tests/mocks/discord.ts`.

---

**Document Owner**: Engineering Team
**Last Review**: 2025-11-13
**Next Review**: 2025-12-13 (monthly)
