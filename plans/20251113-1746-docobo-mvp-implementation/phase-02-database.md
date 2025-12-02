# Phase 02: Database Schema Design

**Date**: 2025-11-13 | **Priority**: HIGH | **Status**: COMPLETED
**Completed**: 2025-12-02

[← Phase 01](./phase-01-setup.md) | [Back to Plan](./plan.md) | [Next: Phase 03 →](./phase-03-bot-core.md)

---

## Context

Design PostgreSQL schema for guilds, members, subscriptions, webhook events. Use Prisma ORM for type-safe migrations, ACID compliance for financial transactions.

---

## Key Insights from Research

**Why PostgreSQL over MongoDB**:
- ACID compliance critical for payment tracking
- Complex queries (JOIN subscriptions + members)
- Better for financial data integrity
- Foreign key constraints prevent orphaned records

**Prisma Benefits**:
- Type-safe Prisma Client (auto-generated)
- Migration system (version control for schema)
- Connection pooling built-in
- Excellent DX (Prisma Studio GUI)

**Schema Patterns**:
- Store Discord IDs as `BigInt` (snowflake IDs 18+ digits)
- Composite uniqueness: `(userId, guildId)` for multi-guild support
- Index frequently queried fields: `userId`, `guildId`, `subscriptionStatus`
- JSONB for flexible metadata (payment provider details)

---

## Requirements

### Functional
- Store guild configuration (roles, pricing, payment methods)
- Track member subscriptions (active, cancelled, expired)
- Log webhook events (deduplication, audit trail)
- Link subscriptions to payment providers (Polar, SePay)

### Non-Functional
- Query performance: <50ms for role checks
- Data integrity: foreign keys, constraints
- Idempotency: unique constraints on transaction IDs
- Audit trail: timestamps on all records

---

## Architecture Decisions

**1. Schema Design**
```
guilds ← members ← subscriptions
              ↓
       webhook_events
```
- Guilds: 1-to-many members
- Members: 1-to-many subscriptions (tier upgrades)
- Subscriptions: 1-to-many webhook events

**2. Subscription State Machine**
```
PENDING → ACTIVE → CANCELLED → REVOKED
            ↓
        PAST_DUE → ACTIVE (retry) | CANCELLED (failed)
```

**3. Deduplication Strategy**
- Polar: Store `event.id` (unique constraint)
- SePay: Store `transaction.id` (unique constraint)
- Webhook retries return 200 for duplicates (idempotent)

---

## Related Code Files

```
/mnt/d/www/docobo/
└── prisma/
    ├── schema.prisma         # To create
    ├── migrations/
    │   └── 20251113_init/    # Generated via migrate dev
    └── seed.ts               # To create (test data)
```

---

## Implementation Steps

### Step 1: Create Prisma Schema
**File**: `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// GUILDS
// ============================================================
model Guild {
  id        String   @id @default(cuid())
  guildId   String   @unique @db.VarChar(20) // Discord snowflake
  guildName String   @db.VarChar(100)

  // Configuration
  prefix        String  @default("!") @db.VarChar(10)
  locale        String  @default("en") @db.VarChar(5)

  // Payment Integration
  polarEnabled  Boolean @default(false)
  sepayEnabled  Boolean @default(false)

  // Settings (JSONB for flexibility)
  settings      Json?   @db.JsonB

  // Relationships
  members       Member[]
  roles         PaidRole[]

  // Metadata
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([guildId])
  @@map("guilds")
}

// ============================================================
// PAID ROLES
// ============================================================
model PaidRole {
  id          String   @id @default(cuid())
  guild       Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)
  guildId     String

  // Discord role details
  roleId      String   @db.VarChar(20) // Discord role snowflake
  roleName    String   @db.VarChar(100)

  // Pricing
  priceUsd    Decimal  @db.Decimal(10, 2) // Max $99,999,999.99
  currency    String   @default("USD") @db.VarChar(3)

  // Payment Provider Product IDs
  polarProductId  String? @db.VarChar(255)
  sepayProductId  String? @db.VarChar(255)

  // Metadata
  description String?  @db.Text
  isActive    Boolean  @default(true)

  // Relationships
  subscriptions Subscription[]

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([guildId, roleId])
  @@index([guildId])
  @@index([roleId])
  @@map("paid_roles")
}

// ============================================================
// MEMBERS
// ============================================================
model Member {
  id        String   @id @default(cuid())
  userId    String   @db.VarChar(20) // Discord user snowflake
  guild     Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)
  guildId   String

  // User details
  username      String   @db.VarChar(100)
  discriminator String?  @db.VarChar(4)

  // Relationships
  subscriptions Subscription[]

  // Metadata
  joinedAt      DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, guildId]) // User can be in multiple guilds
  @@index([userId])
  @@index([guildId])
  @@map("members")
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================
enum SubscriptionStatus {
  PENDING    // Payment initiated, not confirmed
  ACTIVE     // Payment confirmed, role granted
  PAST_DUE   // Payment failed, grace period
  CANCELLED  // User cancelled, awaiting revocation
  REVOKED    // Access removed
  REFUNDED   // Payment refunded
}

enum PaymentProvider {
  POLAR
  SEPAY
}

model Subscription {
  id        String   @id @default(cuid())

  // Relationships
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String
  paidRole  PaidRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  roleId    String

  // Payment Provider
  provider              PaymentProvider
  externalSubscriptionId String        @db.VarChar(255) // Polar/SePay subscription ID
  externalCustomerId     String?       @db.VarChar(255)

  // Status
  status                SubscriptionStatus @default(PENDING)

  // Billing
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean        @default(false)

  // Metadata (provider-specific data)
  metadata              Json?          @db.JsonB

  // Relationships
  webhookEvents         WebhookEvent[]

  // Timestamps
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@unique([externalSubscriptionId, provider])
  @@index([memberId])
  @@index([status])
  @@index([provider])
  @@map("subscriptions")
}

// ============================================================
// WEBHOOK EVENTS
// ============================================================
enum WebhookEventType {
  // Polar events
  SUBSCRIPTION_CREATED
  SUBSCRIPTION_UPDATED
  SUBSCRIPTION_ACTIVE
  SUBSCRIPTION_CANCELED
  SUBSCRIPTION_UNCANCELED
  SUBSCRIPTION_REVOKED
  ORDER_CREATED
  ORDER_UPDATED
  ORDER_PAID
  ORDER_REFUNDED

  // SePay events
  PAYMENT_IN
  PAYMENT_OUT
  PAYMENT_VERIFIED
}

model WebhookEvent {
  id        String   @id @default(cuid())

  // Event identification (for deduplication)
  externalEventId String  @unique @db.VarChar(255) // Polar event.id OR SePay transaction.id
  provider        PaymentProvider
  eventType       WebhookEventType

  // Relationship (nullable - event may arrive before subscription created)
  subscription    Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  subscriptionId  String?

  // Payload
  rawPayload      Json    @db.JsonB // Full webhook payload for audit

  // Processing status
  processed       Boolean @default(false)
  processedAt     DateTime?
  errorMessage    String? @db.Text

  // Metadata
  receivedAt      DateTime @default(now())

  @@index([externalEventId])
  @@index([provider])
  @@index([processed])
  @@index([eventType])
  @@map("webhook_events")
}
```

### Step 2: Initialize Prisma
```bash
# Generate Prisma Client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init
```

### Step 3: Create Database Seed Script
**File**: `prisma/seed.ts`
```typescript
import { PrismaClient, PaymentProvider, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test guild
  const guild = await prisma.guild.upsert({
    where: { guildId: '1234567890123456789' },
    update: {},
    create: {
      guildId: '1234567890123456789',
      guildName: 'Test Server',
      polarEnabled: true,
      sepayEnabled: true,
      settings: {
        welcomeChannel: 'general',
        welcomeMessage: 'Welcome to the paid community!',
      },
    },
  });
  console.log(`✅ Created guild: ${guild.guildName}`);

  // Create test paid role
  const paidRole = await prisma.paidRole.upsert({
    where: {
      guildId_roleId: {
        guildId: guild.id,
        roleId: '9876543210987654321',
      },
    },
    update: {},
    create: {
      guildId: guild.id,
      roleId: '9876543210987654321',
      roleName: 'Premium Member',
      priceUsd: 15.0,
      currency: 'USD',
      description: 'Access to premium channels and perks',
      polarProductId: 'prod_polar_test_123',
    },
  });
  console.log(`✅ Created paid role: ${paidRole.roleName} ($${paidRole.priceUsd})`);

  // Create test member
  const member = await prisma.member.upsert({
    where: {
      userId_guildId: {
        userId: '1111111111111111111',
        guildId: guild.id,
      },
    },
    update: {},
    create: {
      userId: '1111111111111111111',
      guildId: guild.id,
      username: 'TestUser#1234',
      discriminator: '1234',
    },
  });
  console.log(`✅ Created member: ${member.username}`);

  // Create test subscription
  const subscription = await prisma.subscription.upsert({
    where: {
      externalSubscriptionId_provider: {
        externalSubscriptionId: 'sub_polar_test_456',
        provider: PaymentProvider.POLAR,
      },
    },
    update: {},
    create: {
      memberId: member.id,
      roleId: paidRole.id,
      provider: PaymentProvider.POLAR,
      externalSubscriptionId: 'sub_polar_test_456',
      externalCustomerId: 'cus_polar_test_789',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        billing_reason: 'subscription_create',
      },
    },
  });
  console.log(`✅ Created subscription: ${subscription.externalSubscriptionId}`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Step 4: Add Seed Script to package.json
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

### Step 5: Create Database Service
**File**: `src/services/database.ts`
```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Connection test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
}

// Query helpers (type-safe wrappers)
export const db = {
  // Guild operations
  getGuildByDiscordId: async (guildId: string) => {
    return prisma.guild.findUnique({
      where: { guildId },
      include: {
        roles: true,
      },
    });
  },

  // Member operations
  getMemberByDiscordId: async (userId: string, guildId: string) => {
    const guild = await prisma.guild.findUnique({ where: { guildId } });
    if (!guild) return null;

    return prisma.member.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId: guild.id,
        },
      },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            paidRole: true,
          },
        },
      },
    });
  },

  // Subscription operations
  getActiveSubscriptionsByMember: async (memberId: string) => {
    return prisma.subscription.findMany({
      where: {
        memberId,
        status: 'ACTIVE',
      },
      include: {
        paidRole: true,
      },
    });
  },
};
```

### Step 6: Run Migrations and Seed
```bash
# Run migrations
npm run db:migrate

# Generate Prisma Client
npm run db:generate

# Seed test data
npm run db:seed

# Open Prisma Studio (GUI)
npm run db:studio
```

---

## Todo Checklist

- [x] Create `prisma/schema.prisma` with full schema
- [x] Run `npx prisma generate` (generates client types)
- [x] Run `npx prisma migrate dev --name init`
- [x] Create `prisma/seed.ts` script
- [x] Add seed script to package.json
- [x] Create `src/services/database.ts` (connection + helpers)
- [x] Seed test data: `npm run db:seed`
- [x] Verify in Prisma Studio: `npm run db:studio`
- [x] Test query: fetch guild by Discord ID
- [x] Verify indexes created (check migration SQL)

---

## Success Criteria

- [ ] Prisma Client generates without errors
- [ ] Migration creates all tables
- [ ] Seed script populates test data
- [ ] Prisma Studio shows guilds, roles, members, subscriptions
- [ ] Foreign key constraints enforced (try deleting guild → cascades)
- [ ] Unique constraints prevent duplicate subscriptions
- [ ] Database service connects successfully

---

## Security Considerations

### Critical
- **BigInt for Discord IDs**: Prevent integer overflow (snowflakes 18+ digits)
- **Cascade deletes**: Guild deletion removes members/subscriptions (GDPR compliance)
- **Unique constraints**: externalEventId prevents duplicate webhook processing
- **JSONB validation**: Validate metadata structure in application layer

### Important
- **Decimal for prices**: Exact precision (no float rounding errors)
- **Indexes on foreign keys**: Improve query performance
- **Connection pooling**: Prevent connection exhaustion (Prisma default: 10)

---

## Performance Optimization

**Indexes Created**:
- `guilds.guildId` (unique, frequent lookups)
- `members.userId` (frequent role checks)
- `members.guildId` (guild member lists)
- `subscriptions.status` (active subscription queries)
- `webhook_events.externalEventId` (deduplication checks)

**Query Patterns**:
- Role check: `getMemberByDiscordId` (<10ms with indexes)
- Active subscriptions: Filter by status (indexed)
- Webhook dedup: Unique constraint prevents duplicates at DB level

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration conflicts | MEDIUM | Use Prisma migrate dev, version control migrations |
| Connection pool exhaustion | HIGH | Prisma default 10 connections, monitor usage |
| Orphaned subscriptions | MEDIUM | Foreign key CASCADE deletes |
| Webhook duplicate processing | CRITICAL | Unique constraint on externalEventId |

---

## Next Steps

1. Verify all tables created
2. Test database service connections
3. Proceed to [Phase 03: Bot Core](./phase-03-bot-core.md)
4. Do NOT implement payment logic yet (Phase 04)

---

**Estimated Time**: 3-4 hours
