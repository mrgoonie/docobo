# Phase 06: Testing & Quality Assurance

**Date**: 2025-11-13 | **Priority**: CRITICAL | **Status**: PENDING

[← Phase 05](./phase-05-onboarding.md) | [Back to Plan](./plan.md)

---

## Context

Comprehensive testing strategy: unit tests, integration tests, end-to-end tests. Verify webhook reliability, role automation, onboarding UX. Achieve >80% coverage.

---

## Key Insights from Research

**Testing Stack**:
- Jest (standard, 29.7.0) - unit + integration
- Vitest (modern alternative, 1.1.0) - faster, ESM-native
- Supertest (6.3.3) - HTTP endpoint testing
- Discord.js mocking (jest.mock)

**Critical Test Cases**:
- Webhook signature verification (Polar HMAC)
- Webhook deduplication (prevent duplicate processing)
- Role grant/revoke automation
- Database transactions (atomic operations)
- 3-second interaction timeout compliance

---

## Requirements

### Functional
- Unit tests: services, utilities, validators
- Integration tests: database operations, webhook handlers
- E2E tests: full onboarding flow, payment → role grant
- Mocking: Discord API, payment webhooks
- Coverage: >80% line coverage

### Non-Functional
- Test execution: <30s (full suite)
- Isolation: tests don't depend on each other
- Reproducibility: deterministic results
- CI/CD ready: GitHub Actions compatible

---

## Architecture Decisions

**1. Test Structure**
```
tests/
├── unit/
│   ├── services/
│   │   ├── database.test.ts
│   │   └── roleAutomation.test.ts
│   ├── utils/
│   │   ├── embeds.test.ts
│   │   └── setupState.test.ts
│   └── webhooks/
│       ├── signature.test.ts
│       └── deduplication.test.ts
├── integration/
│   ├── webhooks/
│   │   ├── polar.test.ts
│   │   └── sepay.test.ts
│   └── commands/
│       ├── setup.test.ts
│       └── join.test.ts
└── e2e/
    └── paymentFlow.test.ts
```

**2. Test Database**
- Separate test DB: `docobo_test`
- Reset before each test suite
- Seed test data via Prisma

**3. Mocking Strategy**
- Discord client: Mock guild/member fetches
- Polar SDK: Mock `validateEvent()`
- External APIs: Mock HTTP requests

---

## Related Code Files

```
/mnt/d/www/docobo/
├── tests/
│   ├── setup.ts              # Test environment setup
│   ├── mocks/
│   │   ├── discord.ts        # Discord.js mocks
│   │   └── webhooks.ts       # Webhook payload mocks
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── jest.config.js            # Jest configuration
├── vitest.config.ts          # Vitest configuration
└── .github/
    └── workflows/
        └── test.yml          # GitHub Actions CI
```

---

## Implementation Steps

### Step 1: Create Jest Configuration
**File**: `jest.config.js`
```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/webhook-server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Step 2: Create Test Setup
**File**: `tests/setup.ts`
```typescript
import { prisma } from '@/services/database';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgresql@localhost:5432/docobo_test';

// Reset database before all tests
beforeAll(async () => {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  // Run migrations
  // Note: In real setup, use `prisma migrate deploy` or seed script
});

// Clean up after each test
afterEach(async () => {
  // Delete all records (maintains schema)
  const deletePromises = [
    prisma.webhookEvent.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.member.deleteMany(),
    prisma.paidRole.deleteMany(),
    prisma.guild.deleteMany(),
  ];

  await Promise.all(deletePromises);
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
```

### Step 3: Create Discord Mocks
**File**: `tests/mocks/discord.ts`
```typescript
import { Guild, GuildMember, Role, User } from 'discord.js';

export const mockGuild = {
  id: '1234567890123456789',
  name: 'Test Server',
  roles: {
    cache: new Map(),
    fetch: jest.fn(),
  },
  members: {
    cache: new Map(),
    fetch: jest.fn(),
    me: {
      permissions: {
        has: jest.fn(() => true),
      },
      roles: {
        highest: {
          position: 10,
        },
      },
    },
  },
} as unknown as Guild;

export const mockRole = {
  id: '9876543210987654321',
  name: 'Premium Member',
  position: 5,
} as Role;

export const mockUser = {
  id: '1111111111111111111',
  tag: 'TestUser#1234',
} as User;

export const mockMember = {
  user: mockUser,
  roles: {
    cache: new Map(),
    add: jest.fn(),
    remove: jest.fn(),
  },
} as unknown as GuildMember;
```

### Step 4: Create Webhook Payload Mocks
**File**: `tests/mocks/webhooks.ts`
```typescript
export const polarWebhookPayload = {
  subscription_created: {
    id: 'evt_polar_test_123',
    type: 'subscription.created',
    data: {
      id: 'sub_polar_test_456',
      status: 'incomplete',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_123',
      customer_id: 'cus_polar_test_789',
    },
  },
  subscription_active: {
    id: 'evt_polar_test_124',
    type: 'subscription.active',
    data: {
      id: 'sub_polar_test_456',
      status: 'active',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_123',
      customer_id: 'cus_polar_test_789',
    },
  },
  subscription_revoked: {
    id: 'evt_polar_test_125',
    type: 'subscription.revoked',
    data: {
      id: 'sub_polar_test_456',
      status: 'revoked',
      user_id: '1111111111111111111',
      product_id: 'prod_polar_test_123',
    },
  },
};

export const sepayWebhookPayload = {
  payment_verified: {
    id: 'txn_sepay_test_001',
    transferAmount: 350000,
    referenceCode: 'DOCOBO_USER_123',
    gateway: 'VCB',
    transferType: 'in',
    timestamp: '2025-11-13T10:42:00Z',
  },
};
```

### Step 5: Create Unit Tests - Database Service
**File**: `tests/unit/services/database.test.ts`
```typescript
import { prisma, db } from '@/services/database';

describe('Database Service', () => {
  describe('getGuildByDiscordId', () => {
    it('should return guild with roles', async () => {
      // Create test guild
      const guild = await prisma.guild.create({
        data: {
          guildId: '1234567890123456789',
          guildName: 'Test Server',
        },
      });

      // Create paid role
      await prisma.paidRole.create({
        data: {
          guildId: guild.id,
          roleId: '9876543210987654321',
          roleName: 'Premium Member',
          priceUsd: 15.0,
        },
      });

      // Test query
      const result = await db.getGuildByDiscordId('1234567890123456789');

      expect(result).not.toBeNull();
      expect(result?.guildId).toBe('1234567890123456789');
      expect(result?.roles).toHaveLength(1);
      expect(result?.roles[0].roleName).toBe('Premium Member');
    });

    it('should return null for non-existent guild', async () => {
      const result = await db.getGuildByDiscordId('9999999999999999999');
      expect(result).toBeNull();
    });
  });

  describe('getMemberByDiscordId', () => {
    it('should return member with active subscriptions', async () => {
      // Setup: guild → role → member → subscription
      const guild = await prisma.guild.create({
        data: {
          guildId: '1234567890123456789',
          guildName: 'Test Server',
        },
      });

      const role = await prisma.paidRole.create({
        data: {
          guildId: guild.id,
          roleId: '9876543210987654321',
          roleName: 'Premium Member',
          priceUsd: 15.0,
        },
      });

      const member = await prisma.member.create({
        data: {
          userId: '1111111111111111111',
          guildId: guild.id,
          username: 'TestUser#1234',
        },
      });

      await prisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_test_123',
          status: 'ACTIVE',
        },
      });

      // Test query
      const result = await db.getMemberByDiscordId('1111111111111111111', '1234567890123456789');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('1111111111111111111');
      expect(result?.subscriptions).toHaveLength(1);
      expect(result?.subscriptions[0].status).toBe('ACTIVE');
    });
  });
});
```

### Step 6: Create Unit Tests - Deduplication
**File**: `tests/unit/webhooks/deduplication.test.ts`
```typescript
import { prisma } from '@/services/database';
import { checkDuplication, recordWebhookEvent } from '@/webhooks/utils/deduplication';

describe('Webhook Deduplication', () => {
  describe('checkDuplication', () => {
    it('should return false for new event', async () => {
      const isDuplicate = await checkDuplication('evt_new_123', 'POLAR');
      expect(isDuplicate).toBe(false);
    });

    it('should return true for existing event', async () => {
      // Create event
      await prisma.webhookEvent.create({
        data: {
          externalEventId: 'evt_existing_456',
          provider: 'POLAR',
          eventType: 'SUBSCRIPTION_CREATED',
          rawPayload: {},
        },
      });

      const isDuplicate = await checkDuplication('evt_existing_456', 'POLAR');
      expect(isDuplicate).toBe(true);
    });
  });

  describe('recordWebhookEvent', () => {
    it('should create webhook event record', async () => {
      await recordWebhookEvent('evt_record_789', 'POLAR', 'SUBSCRIPTION_ACTIVE', {
        test: 'data',
      });

      const event = await prisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_record_789' },
      });

      expect(event).not.toBeNull();
      expect(event?.provider).toBe('POLAR');
      expect(event?.eventType).toBe('SUBSCRIPTION_ACTIVE');
      expect(event?.processed).toBe(false);
    });

    it('should throw error on duplicate event ID', async () => {
      await recordWebhookEvent('evt_duplicate_001', 'POLAR', 'ORDER_PAID', {});

      await expect(
        recordWebhookEvent('evt_duplicate_001', 'POLAR', 'ORDER_PAID', {})
      ).rejects.toThrow();
    });
  });
});
```

### Step 7: Create Integration Tests - Polar Webhook
**File**: `tests/integration/webhooks/polar.test.ts`
```typescript
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createWebhookServer } from '@/webhooks/server';
import { prisma } from '@/services/database';
import { polarWebhookPayload } from '../../mocks/webhooks';

describe('Polar Webhook Integration', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createWebhookServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /webhooks/polar', () => {
    it('should accept valid webhook with correct signature', async () => {
      // Note: Actual signature generation required for real test
      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .send(polarWebhookPayload.subscription_created);

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(server.server)
        .post('/webhooks/polar')
        .set('Content-Type', 'application/json')
        .set('webhook-signature', 'invalid_signature')
        .send(polarWebhookPayload.subscription_created);

      expect(response.status).toBe(403);
    });

    it('should return 200 for duplicate event', async () => {
      // Create existing event
      await prisma.webhookEvent.create({
        data: {
          externalEventId: polarWebhookPayload.subscription_created.id,
          provider: 'POLAR',
          eventType: 'SUBSCRIPTION_CREATED',
          rawPayload: polarWebhookPayload.subscription_created.data,
        },
      });

      const response = await request(server.server)
        .post('/webhooks/polar')
        .send(polarWebhookPayload.subscription_created);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Duplicate');
    });
  });
});
```

### Step 8: Create E2E Test - Payment Flow
**File**: `tests/e2e/paymentFlow.test.ts`
```typescript
import { prisma } from '@/services/database';
import { processPolarEvent } from '@/webhooks/services/polarService';
import { polarWebhookPayload } from '../mocks/webhooks';
import { mockGuild, mockMember } from '../mocks/discord';

// Mock Discord client
jest.mock('@/bot/client', () => ({
  client: {
    guilds: {
      fetch: jest.fn(() => Promise.resolve(mockGuild)),
    },
  },
}));

describe('E2E: Payment to Role Grant Flow', () => {
  it('should grant role when subscription becomes active', async () => {
    // Setup: guild → role → member
    const guild = await prisma.guild.create({
      data: {
        guildId: mockGuild.id,
        guildName: 'Test Server',
        polarEnabled: true,
      },
    });

    const role = await prisma.paidRole.create({
      data: {
        guildId: guild.id,
        roleId: '9876543210987654321',
        roleName: 'Premium Member',
        priceUsd: 15.0,
        polarProductId: 'prod_polar_test_123',
      },
    });

    const member = await prisma.member.create({
      data: {
        userId: '1111111111111111111',
        guildId: guild.id,
        username: 'TestUser#1234',
      },
    });

    // Create subscription (PENDING)
    const subscription = await prisma.subscription.create({
      data: {
        memberId: member.id,
        roleId: role.id,
        provider: 'POLAR',
        externalSubscriptionId: 'sub_polar_test_456',
        status: 'PENDING',
      },
    });

    // Mock Discord guild members fetch
    (mockGuild.members.fetch as jest.Mock).mockResolvedValue(mockMember);

    // Process 'subscription.active' webhook
    await processPolarEvent(polarWebhookPayload.subscription_active);

    // Verify subscription status updated
    const updatedSub = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });
    expect(updatedSub?.status).toBe('ACTIVE');

    // Verify role granted (mock called)
    expect(mockMember.roles.add).toHaveBeenCalled();

    // Verify webhook event recorded
    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: { externalEventId: polarWebhookPayload.subscription_active.id },
    });
    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent?.processed).toBe(true);
  });

  it('should revoke role when subscription is revoked', async () => {
    // Setup: existing active subscription
    const guild = await prisma.guild.create({
      data: {
        guildId: mockGuild.id,
        guildName: 'Test Server',
      },
    });

    const role = await prisma.paidRole.create({
      data: {
        guildId: guild.id,
        roleId: '9876543210987654321',
        roleName: 'Premium Member',
        priceUsd: 15.0,
      },
    });

    const member = await prisma.member.create({
      data: {
        userId: '1111111111111111111',
        guildId: guild.id,
        username: 'TestUser#1234',
      },
    });

    await prisma.subscription.create({
      data: {
        memberId: member.id,
        roleId: role.id,
        provider: 'POLAR',
        externalSubscriptionId: 'sub_polar_test_456',
        status: 'ACTIVE',
      },
    });

    // Mock Discord calls
    (mockGuild.members.fetch as jest.Mock).mockResolvedValue(mockMember);

    // Process 'subscription.revoked' webhook
    await processPolarEvent(polarWebhookPayload.subscription_revoked);

    // Verify subscription status updated
    const updatedSub = await prisma.subscription.findFirst({
      where: { externalSubscriptionId: 'sub_polar_test_456' },
    });
    expect(updatedSub?.status).toBe('REVOKED');

    // Verify role revoked (mock called)
    expect(mockMember.roles.remove).toHaveBeenCalled();
  });
});
```

### Step 9: Create GitHub Actions CI
**File**: `.github/workflows/test.yml`
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgresql
          POSTGRES_DB: docobo_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgresql@localhost:5432/docobo_test

      - name: Run tests
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgresql@localhost:5432/docobo_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Step 10: Create Test Scripts
**Update `package.json`**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## Todo Checklist

- [ ] Create `jest.config.js`
- [ ] Create `tests/setup.ts` (DB reset)
- [ ] Create `tests/mocks/discord.ts`
- [ ] Create `tests/mocks/webhooks.ts`
- [ ] Create unit tests (database, deduplication)
- [ ] Create integration tests (webhook endpoints)
- [ ] Create E2E tests (payment flow)
- [ ] Create `.github/workflows/test.yml`
- [ ] Update package.json scripts
- [ ] Create test database: `docobo_test`
- [ ] Run `npm test` (verify all pass)
- [ ] Check coverage: `npm run test:coverage` (>80%)
- [ ] Test CI locally: `act` (GitHub Actions locally)
- [ ] Fix failing tests
- [ ] Document test patterns in README

---

## Success Criteria

- [ ] All tests pass (0 failures)
- [ ] Coverage >80% (lines, functions, branches)
- [ ] Test suite runs in <30 seconds
- [ ] No flaky tests (deterministic)
- [ ] CI pipeline passes on GitHub
- [ ] Mocks correctly simulate Discord API
- [ ] Webhook signature tests validate security
- [ ] Deduplication tests prevent duplicates
- [ ] E2E tests cover critical flows

---

## Security Considerations

### Critical
- **Test secrets**: Use dummy secrets, never real tokens
- **Database isolation**: Separate test DB (prevent production damage)
- **Signature validation**: Test both valid and invalid signatures

### Important
- **Mock external APIs**: Never hit real payment providers in tests
- **Cleanup**: Delete all test data after suite

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Flaky tests | MEDIUM | Deterministic test data, avoid timers |
| Slow test suite | LOW | Parallel execution, lightweight mocks |
| Test DB conflicts | MEDIUM | Isolated test DB, reset before each suite |
| Missing edge cases | HIGH | Test invalid inputs, error paths |

---

## Next Steps

1. Run full test suite
2. Fix failing tests
3. Achieve >80% coverage
4. Deploy to staging environment
5. Conduct manual QA testing
6. Prepare production deployment

---

**Estimated Time**: 4-5 hours

---

## Final MVP Completion Checklist

After Phase 06 completion, verify:

- [ ] Bot connects to Discord
- [ ] Database migrations run
- [ ] Webhook server responds to health checks
- [ ] Polar webhook signature verification works
- [ ] SePay webhook auth verification works
- [ ] Role granted on payment success
- [ ] Role revoked on subscription cancellation
- [ ] Admin setup flow completes in <3 minutes
- [ ] Member join flow displays roles
- [ ] All tests pass (>80% coverage)
- [ ] Docker Compose brings up full stack
- [ ] Documentation updated (README, API docs)
- [ ] Security audit completed (env vars, permissions)
- [ ] Performance benchmarks met (webhook <500ms, role grant <5s)

**🎉 MVP READY FOR DEPLOYMENT**
