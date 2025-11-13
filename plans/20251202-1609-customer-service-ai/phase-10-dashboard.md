# Phase 10: Dashboard Extension

**Parent**: [Customer Service AI Plan](./plan.md)
**Dependencies**: Phase 07-09 (KB, Tracking, Auto-Response)
**Date**: 2025-12-02 | **Priority**: MEDIUM | **Status**: PENDING

---

## Overview

Extend existing Fastify webhook server with dashboard routes for activity logs, performance metrics, knowledge base CRUD, and token usage monitoring.

---

## Key Insights (From Codebase)

- **Existing server**: `src/webhook-server.ts` with Fastify, Helmet, CORS, rate-limit
- **Current endpoints**: `/health`, `/webhooks/polar`, `/webhooks/sepay`
- **Extend pattern**: Register new route plugins under `/dashboard/*`
- **Authentication**: Use Discord OAuth2 for admin access

---

## Requirements

1. `/dashboard/activity` - Recent auto-responses with pagination
2. `/dashboard/metrics` - Performance stats (response times, success rate)
3. `/dashboard/kb` - Knowledge base CRUD API
4. `/dashboard/usage` - LLM token usage by guild
5. `/dashboard/config` - Guild CS configuration
6. Authentication via Discord OAuth2 (guild admin only)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Fastify Server                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Existing Routes:                                            │
│  ├── /health                                                 │
│  ├── /webhooks/polar                                         │
│  └── /webhooks/sepay                                         │
│                                                              │
│  New Dashboard Routes:                                       │
│  ├── /dashboard/auth/discord          (OAuth2 callback)     │
│  ├── /dashboard/auth/logout                                  │
│  ├── /dashboard/activity              (GET - paginated)     │
│  ├── /dashboard/metrics               (GET)                 │
│  ├── /dashboard/kb                    (CRUD)                │
│  ├── /dashboard/usage                 (GET)                 │
│  └── /dashboard/config                (GET/PUT)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Files

- `src/webhook-server.ts` - Extend with dashboard plugin
- `src/routes/dashboard/index.ts` - Route plugin registration
- `src/routes/dashboard/activity.ts` - Activity log routes
- `src/routes/dashboard/metrics.ts` - Metrics routes
- `src/routes/dashboard/kb.ts` - Knowledge base CRUD
- `src/routes/dashboard/usage.ts` - Token usage routes
- `src/routes/dashboard/config.ts` - Config routes
- `src/middleware/auth.ts` - Discord OAuth2 middleware

---

## Implementation Steps

### 1. Dashboard Route Plugin (30 min)
```typescript
// src/routes/dashboard/index.ts
import { FastifyInstance } from 'fastify';
import activityRoutes from './activity.js';
import metricsRoutes from './metrics.js';
import kbRoutes from './kb.js';
import usageRoutes from './usage.js';
import configRoutes from './config.js';

export default async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth middleware for all dashboard routes
  fastify.addHook('preHandler', authMiddleware);

  fastify.register(activityRoutes, { prefix: '/activity' });
  fastify.register(metricsRoutes, { prefix: '/metrics' });
  fastify.register(kbRoutes, { prefix: '/kb' });
  fastify.register(usageRoutes, { prefix: '/usage' });
  fastify.register(configRoutes, { prefix: '/config' });
}
```

### 2. Auth Middleware (45 min)
```typescript
// src/middleware/auth.ts
interface AuthSession {
  userId: string;
  accessToken: string;
  guilds: { id: string; permissions: string }[];
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // Verify Discord token and get user guilds
  const session = await verifyDiscordToken(token);
  if (!session) {
    return reply.code(401).send({ error: 'Invalid token' });
  }

  // Attach session to request
  request.session = session;
}

// Verify user has admin access to requested guild
export function requireGuildAdmin(guildId: string) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const guild = request.session.guilds.find(g => g.id === guildId);
    const MANAGE_GUILD = 0x20n; // Permission bit

    if (!guild || (BigInt(guild.permissions) & MANAGE_GUILD) === 0n) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    done();
  };
}
```

### 3. Activity Routes (45 min)
```typescript
// src/routes/dashboard/activity.ts
export default async function activityRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard/activity?guildId=xxx&page=1&limit=20
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          guildId: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
        },
        required: ['guildId'],
      },
    },
  }, async (request, reply) => {
    const { guildId, page, limit } = request.query as { guildId: string; page: number; limit: number };

    // Verify admin access
    requireGuildAdmin(guildId)(request, reply, () => {});

    const skip = (page - 1) * limit;
    const [answers, total] = await Promise.all([
      prisma.answeredMessage.findMany({
        where: { guildId },
        orderBy: { answeredAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.answeredMessage.count({ where: { guildId } }),
    ]);

    return {
      data: answers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}
```

### 4. Metrics Routes (45 min)
```typescript
// src/routes/dashboard/metrics.ts
export default async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard/metrics?guildId=xxx&period=7d
  fastify.get('/', async (request, reply) => {
    const { guildId, period } = request.query as { guildId: string; period: string };

    const startDate = getStartDate(period); // 7d, 30d, 90d

    const [totalAnswered, totalQuestions, avgResponseTime, topDocs] = await Promise.all([
      prisma.answeredMessage.count({
        where: { guildId, answeredAt: { gte: startDate } },
      }),
      // Estimate total questions from tracked channels
      prisma.trackedChannel.count({ where: { guildId } }),
      // Average response time (if tracked)
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (answered_at - created_at))) as avg_seconds
        FROM answered_messages WHERE guild_id = ${guildId}
      `,
      // Most referenced docs
      prisma.$queryRaw`
        SELECT unnest(document_ids) as doc_id, COUNT(*) as usage_count
        FROM answered_messages WHERE guild_id = ${guildId}
        GROUP BY doc_id ORDER BY usage_count DESC LIMIT 5
      `,
    ]);

    return {
      period,
      totalAnswered,
      avgResponseTimeSeconds: avgResponseTime[0]?.avg_seconds ?? 0,
      topDocuments: topDocs,
    };
  });
}
```

### 5. Knowledge Base CRUD Routes (1 hr)
```typescript
// src/routes/dashboard/kb.ts
export default async function kbRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard/kb?guildId=xxx - List all docs
  fastify.get('/', async (request) => {
    const { guildId } = request.query as { guildId: string };
    return prisma.knowledgeDocument.findMany({
      where: { guildId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, description: true, sourceUrl: true, createdAt: true },
    });
  });

  // GET /dashboard/kb/:id - Get single doc
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.knowledgeDocument.findUnique({ where: { id } });
  });

  // POST /dashboard/kb - Create doc
  fastify.post('/', async (request, reply) => {
    const { guildId, title, description, content, sourceUrl, metadata } = request.body as CreateDocInput;
    const doc = await prisma.knowledgeDocument.create({
      data: { guildId, title, description, content, sourceUrl, metadata },
    });
    return reply.code(201).send(doc);
  });

  // PUT /dashboard/kb/:id - Update doc
  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { title, description, content, metadata } = request.body as UpdateDocInput;
    return prisma.knowledgeDocument.update({
      where: { id },
      data: { title, description, content, metadata },
    });
  });

  // DELETE /dashboard/kb/:id - Delete doc
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.knowledgeDocument.delete({ where: { id } });
    return reply.code(204).send();
  });
}
```

### 6. Usage Routes (30 min)
```typescript
// src/routes/dashboard/usage.ts
export default async function usageRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard/usage?guildId=xxx&period=30d
  fastify.get('/', async (request) => {
    const { guildId, period } = request.query as { guildId: string; period: string };
    const startDate = getStartDate(period);

    const usage = await prisma.lLMUsageLog.groupBy({
      by: ['operation', 'model'],
      where: { guildId, createdAt: { gte: startDate } },
      _sum: { tokens: true, cost: true },
      _count: true,
    });

    const totalTokens = usage.reduce((sum, u) => sum + (u._sum.tokens ?? 0), 0);
    const totalCost = usage.reduce((sum, u) => sum + Number(u._sum.cost ?? 0), 0);

    return {
      period,
      breakdown: usage,
      totals: { tokens: totalTokens, cost: totalCost.toFixed(6) },
    };
  });
}
```

### 7. Config Routes (30 min)
```typescript
// src/routes/dashboard/config.ts
export default async function configRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard/config?guildId=xxx
  fastify.get('/', async (request) => {
    const { guildId } = request.query as { guildId: string };
    return prisma.guildCSConfig.findUnique({ where: { guildId } });
  });

  // PUT /dashboard/config?guildId=xxx
  fastify.put('/', async (request) => {
    const { guildId } = request.query as { guildId: string };
    const { pollingInterval, systemPrompt, enabled } = request.body as UpdateConfigInput;

    return prisma.guildCSConfig.upsert({
      where: { guildId },
      create: { guildId, pollingInterval, systemPrompt, enabled },
      update: { pollingInterval, systemPrompt, enabled },
    });
  });
}
```

### 8. Register in Webhook Server (15 min)
```typescript
// src/webhook-server.ts (add to existing)
import dashboardRoutes from './routes/dashboard/index.js';

// After existing middleware registration
await fastify.register(dashboardRoutes, { prefix: '/dashboard' });
```

---

## Todo List

- [ ] Create dashboard route plugin structure
- [ ] Implement Discord OAuth2 middleware
- [ ] Implement activity routes with pagination
- [ ] Implement metrics routes with aggregations
- [ ] Implement KB CRUD routes
- [ ] Implement usage routes
- [ ] Implement config routes
- [ ] Register dashboard plugin in webhook-server.ts
- [ ] Add request validation schemas
- [ ] Add error handling
- [ ] Write API tests

---

## Success Criteria

- [ ] All dashboard routes return correct data
- [ ] Pagination works correctly
- [ ] Auth middleware blocks unauthorized access
- [ ] Guild admin check prevents cross-guild access
- [ ] CRUD operations update database correctly
- [ ] Metrics aggregate correctly

---

## Security Considerations

- All routes require authentication
- Guild admin permission required for access
- Rate limit dashboard routes (separate from webhooks)
- Validate all input with JSON schemas
- No sensitive data in responses (tokens, secrets)

---

## API Response Formats

```typescript
// Success response
{ data: T, pagination?: { page, limit, total, totalPages } }

// Error response
{ error: string, code?: string, details?: unknown }
```

---

## Next Steps

After completion, proceed to [Phase 11: Personality](./phase-11-personality.md)
