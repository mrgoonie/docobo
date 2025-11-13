# Phase 04: Payment Webhook Processing

**Date**: 2025-11-13 | **Priority**: CRITICAL | **Status**: PENDING

[← Phase 03](./phase-03-bot-core.md) | [Back to Plan](./plan.md) | [Next: Phase 05 →](./phase-05-onboarding.md)

---

## Context

Implement Fastify webhook server for Polar.sh and SePay.vn payment events. Handle signature verification, deduplication, role assignment automation.

---

## Key Insights from Research

**Polar.sh Webhooks**:
- Standard Webhooks HMAC signature verification
- Events: `subscription.created`, `subscription.canceled`, `subscription.revoked`, `order.paid`, `order.refunded`
- SDK: `@polar-sh/sdk/webhooks` provides `validateEvent()`
- Idempotency: Store `event.id` (unique constraint)

**SePay.vn Webhooks**:
- OAuth2/API Key auth (no cryptographic signature)
- Must return `{"success": true}` + 200-201 status
- Deduplication: Transaction `id` field + composite key fallback
- Retry: 7 attempts over 5 hours (Fibonacci intervals)

**Critical Patterns**:
- Return 200 immediately (acknowledge receipt)
- Process async (prevent timeout)
- Idempotent responses (duplicate webhooks return success)
- Transaction-wrapped DB operations (atomic role grants)

---

## Requirements

### Functional
- Fastify server on port 3000
- Polar webhook endpoint `/webhooks/polar` (POST)
- SePay webhook endpoint `/webhooks/sepay` (POST)
- Signature verification (Polar HMAC)
- Auth verification (SePay OAuth2/API Key)
- Deduplication (check `externalEventId` before processing)
- Role automation (grant on `subscription.active`, revoke on `subscription.revoked`)
- Error logging (webhook failures to database)

### Non-Functional
- Response time: <500ms (immediate ACK)
- Processing time: <5s (async)
- Idempotency: 100% (duplicate webhooks safe)
- Security: signature/auth verification always

---

## Architecture Decisions

**1. Webhook Flow**
```
Webhook arrives → Verify signature/auth → Check dedup → ACK 200
                                                ↓
                                       Async processing → Update DB → Assign role → Log
```

**2. Deduplication Strategy**
- Check `webhook_events.externalEventId` (unique constraint)
- If exists: Return 200 + `{"success": true}` (idempotent)
- If new: Insert event, process, return 200

**3. Role Assignment**
- Polar `subscription.active` → Grant role
- Polar `subscription.revoked` → Revoke role
- SePay `PAYMENT_VERIFIED` → Grant role (one-time payment)
- All operations in DB transaction (atomic)

**4. Error Handling**
- Webhook validation failure: 403 Forbidden
- Processing error: Log to DB, return 200 (prevent retry loop)
- Missing guild/role: Log warning, return 200

---

## Related Code Files

```
/mnt/d/www/docobo/src/
├── webhook-server.ts           # Fastify entry
├── webhooks/
│   ├── server.ts               # Fastify setup
│   ├── routes/
│   │   ├── polar.ts            # Polar webhook handler
│   │   ├── sepay.ts            # SePay webhook handler
│   │   └── health.ts           # Health check
│   ├── services/
│   │   ├── polarService.ts     # Polar event processing
│   │   └── sepayService.ts     # SePay event processing
│   └── utils/
│       ├── signature.ts        # Signature verification
│       └── deduplication.ts    # Dedup checks
└── services/
    └── roleAutomation.ts       # Role grant/revoke logic
```

---

## Implementation Steps

### Step 1: Create Fastify Server Setup
**File**: `src/webhooks/server.ts`
```typescript
import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '@/config/env';

export async function createWebhookServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Security plugins
  await server.register(helmet);
  await server.register(cors, {
    origin: false, // Webhooks don't need CORS
  });

  // Rate limiting (prevent abuse)
  await server.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute',
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register webhook routes
  await server.register(import('./routes/polar'), { prefix: '/webhooks' });
  await server.register(import('./routes/sepay'), { prefix: '/webhooks' });

  return server;
}
```

### Step 2: Create Polar Webhook Handler
**File**: `src/webhooks/routes/polar.ts`
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { env } from '@/config/env';
import { processPolarEvent } from '../services/polarService';
import { checkDuplication } from '../utils/deduplication';

interface PolarWebhookBody {
  type: string;
  data: any;
  id: string;
}

export default async function polarRoutes(server: FastifyInstance): Promise<void> {
  server.post<{ Body: PolarWebhookBody }>(
    '/polar',
    {
      schema: {
        body: {
          type: 'object',
          required: ['type', 'data', 'id'],
        },
      },
    },
    async (request: FastifyRequest<{ Body: PolarWebhookBody }>, reply: FastifyReply) => {
      const rawBody = JSON.stringify(request.body);
      const headers = request.headers;

      try {
        // 1. Verify webhook signature (Standard Webhooks HMAC)
        const event = validateEvent(rawBody, headers, env.POLAR_WEBHOOK_SECRET);

        // 2. Check deduplication
        const isDuplicate = await checkDuplication(event.id, 'POLAR');
        if (isDuplicate) {
          server.log.info(`Duplicate Polar event: ${event.id}`);
          return reply.code(200).send({ success: true, message: 'Duplicate event' });
        }

        // 3. Acknowledge receipt immediately (prevent timeout)
        reply.code(202).send({ success: true, message: 'Event received' });

        // 4. Process async (non-blocking)
        setImmediate(async () => {
          try {
            await processPolarEvent(event);
          } catch (error) {
            server.log.error(`Failed to process Polar event ${event.id}:`, error);
          }
        });
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          server.log.warn('Polar webhook verification failed:', error);
          return reply.code(403).send({ error: 'Invalid signature' });
        }

        server.log.error('Polar webhook error:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
```

### Step 3: Create SePay Webhook Handler
**File**: `src/webhooks/routes/sepay.ts`
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '@/config/env';
import { processSepayTransaction } from '../services/sepayService';
import { checkDuplication } from '../utils/deduplication';

interface SepayWebhookBody {
  id: string; // Transaction ID (primary dedup key)
  transferAmount: number;
  referenceCode?: string;
  gateway: string;
  transferType: string;
  timestamp: string;
}

export default async function sepayRoutes(server: FastifyInstance): Promise<void> {
  server.post<{ Body: SepayWebhookBody }>(
    '/sepay',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'transferAmount', 'gateway'],
        },
      },
    },
    async (request: FastifyRequest<{ Body: SepayWebhookBody }>, reply: FastifyReply) => {
      try {
        // 1. Verify auth (OAuth2 token or API Key)
        const authHeader = request.headers.authorization;
        if (!authHeader || !verifySepayAuth(authHeader)) {
          server.log.warn('SePay webhook auth failed');
          return reply.code(403).send({ success: false, error: 'Unauthorized' });
        }

        const transaction = request.body;

        // 2. Check deduplication (transaction ID)
        const isDuplicate = await checkDuplication(transaction.id, 'SEPAY');
        if (isDuplicate) {
          server.log.info(`Duplicate SePay transaction: ${transaction.id}`);
          return reply.code(200).send({ success: true }); // SePay expects this format
        }

        // 3. Acknowledge receipt immediately
        reply.code(200).send({ success: true });

        // 4. Process async
        setImmediate(async () => {
          try {
            await processSepayTransaction(transaction);
          } catch (error) {
            server.log.error(`Failed to process SePay transaction ${transaction.id}:`, error);
          }
        });
      } catch (error) {
        server.log.error('SePay webhook error:', error);
        // Return success to prevent retry loop (error logged to DB)
        return reply.code(200).send({ success: true });
      }
    }
  );
}

function verifySepayAuth(authHeader: string): boolean {
  // OAuth2 Bearer token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // TODO: Validate token with SePay OAuth2 endpoint
    return token.length > 0;
  }

  // API Key
  if (authHeader.startsWith('Apikey ')) {
    const apiKey = authHeader.substring(7);
    return apiKey === env.SEPAY_WEBHOOK_SECRET;
  }

  return false;
}
```

### Step 4: Create Deduplication Utility
**File**: `src/webhooks/utils/deduplication.ts`
```typescript
import { prisma } from '@/services/database';
import { PaymentProvider } from '@prisma/client';

export async function checkDuplication(
  externalEventId: string,
  provider: PaymentProvider
): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalEventId },
  });

  return existing !== null;
}

export async function recordWebhookEvent(
  externalEventId: string,
  provider: PaymentProvider,
  eventType: string,
  rawPayload: any,
  subscriptionId?: string
): Promise<void> {
  await prisma.webhookEvent.create({
    data: {
      externalEventId,
      provider,
      eventType: eventType as any,
      rawPayload,
      subscriptionId,
      processed: false,
    },
  });
}
```

### Step 5: Create Polar Event Processor
**File**: `src/webhooks/services/polarService.ts`
```typescript
import { prisma } from '@/services/database';
import { grantRoleForSubscription, revokeRoleForSubscription } from '@/services/roleAutomation';
import { recordWebhookEvent } from '../utils/deduplication';
import { PaymentProvider, SubscriptionStatus } from '@prisma/client';

interface PolarEvent {
  id: string;
  type: string;
  data: {
    id: string;
    status?: string;
    user_id?: string;
    product_id?: string;
    customer_id?: string;
  };
}

export async function processPolarEvent(event: PolarEvent): Promise<void> {
  console.log(`Processing Polar event: ${event.type} (${event.id})`);

  try {
    // Handle subscription lifecycle events
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event);
        break;

      case 'subscription.active':
        await handleSubscriptionActive(event);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event);
        break;

      case 'subscription.revoked':
        await handleSubscriptionRevoked(event);
        break;

      case 'order.paid':
        await handleOrderPaid(event);
        break;

      case 'order.refunded':
        await handleOrderRefunded(event);
        break;

      default:
        console.log(`Unhandled Polar event type: ${event.type}`);
    }

    // Mark as processed
    await prisma.webhookEvent.updateMany({
      where: { externalEventId: event.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (error) {
    console.error(`Error processing Polar event ${event.id}:`, error);

    // Log error to database
    await prisma.webhookEvent.updateMany({
      where: { externalEventId: event.id },
      data: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

async function handleSubscriptionCreated(event: PolarEvent): Promise<void> {
  // Record webhook event
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'SUBSCRIPTION_CREATED', event.data);

  // Subscription will be activated by subsequent 'subscription.active' event
  console.log(`Subscription created: ${event.data.id}`);
}

async function handleSubscriptionActive(event: PolarEvent): Promise<void> {
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'SUBSCRIPTION_ACTIVE', event.data);

  // Update subscription status to ACTIVE
  const subscription = await prisma.subscription.update({
    where: {
      externalSubscriptionId_provider: {
        externalSubscriptionId: event.data.id,
        provider: PaymentProvider.POLAR,
      },
    },
    data: {
      status: SubscriptionStatus.ACTIVE,
    },
    include: {
      member: true,
      paidRole: true,
    },
  });

  // Grant role to member
  await grantRoleForSubscription(subscription);
}

async function handleSubscriptionCanceled(event: PolarEvent): Promise<void> {
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'SUBSCRIPTION_CANCELED', event.data);

  // Mark as cancelled (will be revoked at period end)
  await prisma.subscription.update({
    where: {
      externalSubscriptionId_provider: {
        externalSubscriptionId: event.data.id,
        provider: PaymentProvider.POLAR,
      },
    },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
    },
  });

  console.log(`Subscription cancelled (will revoke at period end): ${event.data.id}`);
}

async function handleSubscriptionRevoked(event: PolarEvent): Promise<void> {
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'SUBSCRIPTION_REVOKED', event.data);

  // Update status to REVOKED
  const subscription = await prisma.subscription.update({
    where: {
      externalSubscriptionId_provider: {
        externalSubscriptionId: event.data.id,
        provider: PaymentProvider.POLAR,
      },
    },
    data: {
      status: SubscriptionStatus.REVOKED,
    },
    include: {
      member: true,
      paidRole: true,
    },
  });

  // Revoke role from member
  await revokeRoleForSubscription(subscription);
}

async function handleOrderPaid(event: PolarEvent): Promise<void> {
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'ORDER_PAID', event.data);
  console.log(`Order paid: ${event.data.id}`);
  // Subscription activation handled by 'subscription.active' event
}

async function handleOrderRefunded(event: PolarEvent): Promise<void> {
  await recordWebhookEvent(event.id, PaymentProvider.POLAR, 'ORDER_REFUNDED', event.data);

  // Update subscription status to REFUNDED
  const subscription = await prisma.subscription.update({
    where: {
      externalSubscriptionId_provider: {
        externalSubscriptionId: event.data.id,
        provider: PaymentProvider.POLAR,
      },
    },
    data: {
      status: SubscriptionStatus.REFUNDED,
    },
    include: {
      member: true,
      paidRole: true,
    },
  });

  // Revoke role (refund = access removed)
  await revokeRoleForSubscription(subscription);
}
```

### Step 6: Create Role Automation Service
**File**: `src/services/roleAutomation.ts`
```typescript
import { client } from '@/bot/client';
import { prisma } from './database';
import { grantRole, revokeRole } from '@/bot/utils/roles';
import { Subscription, PaidRole, Member } from '@prisma/client';

type SubscriptionWithRelations = Subscription & {
  member: Member;
  paidRole: PaidRole & {
    guild: { guildId: string };
  };
};

export async function grantRoleForSubscription(
  subscription: SubscriptionWithRelations
): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(subscription.paidRole.guild.guildId);
    if (!guild) {
      console.error(`Guild not found: ${subscription.paidRole.guild.guildId}`);
      return false;
    }

    const success = await grantRole(
      guild,
      subscription.member.userId,
      subscription.paidRole.roleId
    );

    if (success) {
      console.log(
        `✅ Granted role ${subscription.paidRole.roleName} to user ${subscription.member.userId}`
      );
    }

    return success;
  } catch (error) {
    console.error('Error granting role:', error);
    return false;
  }
}

export async function revokeRoleForSubscription(
  subscription: SubscriptionWithRelations
): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(subscription.paidRole.guild.guildId);
    if (!guild) {
      console.error(`Guild not found: ${subscription.paidRole.guild.guildId}`);
      return false;
    }

    const success = await revokeRole(
      guild,
      subscription.member.userId,
      subscription.paidRole.roleId
    );

    if (success) {
      console.log(
        `✅ Revoked role ${subscription.paidRole.roleName} from user ${subscription.member.userId}`
      );
    }

    return success;
  } catch (error) {
    console.error('Error revoking role:', error);
    return false;
  }
}
```

### Step 7: Create Webhook Server Entry
**File**: `src/webhook-server.ts`
```typescript
import { createWebhookServer } from '@/webhooks/server';
import { testDatabaseConnection, disconnectDatabase } from '@/services/database';
import { env } from '@/config/env';

async function main(): Promise<void> {
  console.log('🚀 Starting Docobo Webhook Server...');

  // Test database connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.error('❌ Database connection failed - shutting down');
    process.exit(1);
  }

  // Create Fastify server
  const server = await createWebhookServer();

  // Start server
  try {
    const port = parseInt(env.WEBHOOK_PORT, 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Webhook server listening on port ${port}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down webhook server...');
    await server.close();
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

- [ ] Create `src/webhooks/server.ts` (Fastify setup)
- [ ] Create `src/webhooks/routes/polar.ts`
- [ ] Create `src/webhooks/routes/sepay.ts`
- [ ] Create `src/webhooks/utils/deduplication.ts`
- [ ] Create `src/webhooks/services/polarService.ts`
- [ ] Create `src/webhooks/services/sepayService.ts` (skeleton)
- [ ] Create `src/services/roleAutomation.ts`
- [ ] Create `src/webhook-server.ts`
- [ ] Add webhook secrets to `.env`
- [ ] Run `npm run dev:webhooks`
- [ ] Test health endpoint: `curl localhost:3000/health`
- [ ] Test Polar webhook with ngrok + Polar dashboard
- [ ] Verify deduplication (send same event twice)
- [ ] Verify role granted on `subscription.active`
- [ ] Verify role revoked on `subscription.revoked`

---

## Success Criteria

- [ ] Fastify server starts on port 3000
- [ ] Health check returns `{"status": "ok"}`
- [ ] Polar signature verification passes (valid webhooks)
- [ ] Polar signature verification fails (invalid signature)
- [ ] SePay auth verification works (Bearer/Apikey)
- [ ] Duplicate webhooks return 200 without processing
- [ ] Webhook events logged to `webhook_events` table
- [ ] Role granted within 5s of `subscription.active`
- [ ] Role revoked within 5s of `subscription.revoked`
- [ ] All webhook responses <500ms (ACK)

---

## Security Considerations

### Critical
- **Signature verification**: ALWAYS verify Polar HMAC signature
- **Auth verification**: ALWAYS verify SePay OAuth2/API Key
- **Deduplication**: Prevent duplicate processing (financial risk)
- **Idempotent responses**: Return 200 for duplicates (prevent retry loops)

### Important
- **Rate limiting**: 100 req/min per IP (prevent abuse)
- **Error logging**: Log webhook failures to DB (audit trail)
- **Transaction safety**: Wrap DB + role operations in transaction
- **Secret rotation**: Rotate webhook secrets quarterly

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook replay attacks | CRITICAL | Unique constraint on externalEventId |
| Missing signature verification | CRITICAL | Fail fast if verification disabled |
| Processing timeout (>5s) | HIGH | Async processing via setImmediate |
| Role grant race conditions | MEDIUM | DB transaction + check existing role |
| Webhook retry loops | MEDIUM | Return 200 even on processing errors |

---

## Next Steps

1. Test webhook endpoints with ngrok
2. Configure Polar/SePay webhook URLs in dashboards
3. Proceed to [Phase 05: Onboarding Flow](./phase-05-onboarding.md)
4. Do NOT implement full UI yet (focus on webhook reliability)

---

**Estimated Time**: 6-8 hours
