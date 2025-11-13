# Docobo System Architecture

**Version**: 1.0
**Last Updated**: 2025-11-13
**Architecture Style**: Event-Driven Microservices

---

## System Overview

Docobo consists of three primary components communicating via database and external APIs.

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOCOBO SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │              │    │              │    │              │     │
│  │  Discord Bot │◄───┤  PostgreSQL  ├───►│   Webhook    │     │
│  │              │    │   Database   │    │    Server    │     │
│  │  (Discord.js)│    │   (Prisma)   │    │  (Fastify)   │     │
│  │              │    │              │    │              │     │
│  └──────┬───────┘    └──────────────┘    └───────▲──────┘     │
│         │                                          │             │
│         │                                          │             │
└─────────┼──────────────────────────────────────────┼────────────┘
          │                                          │
          ▼                                          │
   ┌──────────────┐                        ┌─────────┴────────┐
   │              │                        │                  │
   │   Discord    │                        │  Payment         │
   │   Gateway    │                        │  Providers       │
   │   (WSS)      │                        │  (Polar, SePay)  │
   │              │                        │                  │
   └──────────────┘                        └──────────────────┘
```

---

## Component Breakdown

### 1. Discord Bot

**Technology**: Discord.js v14, TypeScript
**Runtime**: Node.js 20+
**Entry Point**: `src/index.ts`

#### Responsibilities
- Maintain WebSocket connection to Discord Gateway
- Register and handle slash commands
- Process Discord events (guild joins, member updates)
- Assign/revoke roles via Discord API
- Send user messages (embeds, ephemeral)

#### Key Modules

**Commands** (`src/bot/commands/`):
- `/setup`: Server owner onboarding
- `/join`: Member payment initiation
- `/help`: Documentation and support

**Events** (`src/bot/events/`):
- `ready`: Bot initialization
- `guildCreate`: Auto-register new servers
- `interactionCreate`: Command and component handling

**Utils** (`src/bot/utils/`):
- `embed-builder.ts`: Standardized embed creation
- `permission-checker.ts`: Role hierarchy validation
- `command-loader.ts`: Dynamic command registration

#### External Dependencies
- Discord Gateway (WSS): Command delivery, event streaming
- Discord API (HTTPS): Role management, message sending
- PostgreSQL: Guild config, member data

#### Performance Targets
- Command response: <3s (Discord timeout)
- Role grant: <5s
- Event processing: <1s

---

### 2. Webhook Server

**Technology**: Fastify v4, TypeScript
**Runtime**: Node.js 20+
**Entry Point**: `src/webhook-server.ts`
**Port**: 3000 (configurable)

#### Responsibilities
- Receive payment provider webhooks (POST requests)
- Verify signatures (HMAC for Polar, OAuth2 for SePay)
- Deduplicate events (check database)
- Trigger subscription updates
- Notify Discord bot to grant/revoke roles

#### Endpoints

**Health Check**:
- `GET /health`
- Response: `{ status: 'ok', timestamp: '2025-11-13T10:00:00Z' }`
- Used by: Load balancers, monitoring

**Polar Webhook**:
- `POST /webhooks/polar`
- Headers: `X-Polar-Signature` (HMAC-SHA256)
- Events: `subscription.created`, `subscription.active`, `subscription.canceled`, `subscription.revoked`
- Response: `200 OK` within 500ms

**SePay Webhook**:
- `POST /webhooks/sepay`
- Headers: `Authorization: Bearer <token>`
- Events: `payment.verified`
- Response: `200 OK` within 500ms

#### Middleware Stack
1. **Helmet**: Security headers (CSP, HSTS, XSS protection)
2. **CORS**: Disabled (webhooks don't need CORS)
3. **Rate Limiting**: 100 req/min per IP
4. **Body Parsing**: JSON payloads (max 1MB)
5. **Logging**: Pino (structured JSON logs)

#### External Dependencies
- Payment Providers (HTTPS): Webhook delivery
- PostgreSQL: Event storage, deduplication
- Discord Bot (in-process): Role management trigger

#### Performance Targets
- Webhook ACK: <500ms
- Request throughput: 100 req/min
- Error rate: <1%

---

### 3. Database (PostgreSQL)

**Version**: 14+
**ORM**: Prisma 5.22
**Connection**: Connection pooling (10 connections)

#### Schema Overview

**Tables**: 5 core tables
- `guilds`: Discord server configurations
- `members`: User records per guild
- `paid_roles`: Role pricing and metadata
- `subscriptions`: Payment status and lifecycle
- `webhook_events`: Audit trail and deduplication

#### Entity Relationships

```
┌──────────┐
│  Guild   │
└────┬─────┘
     │ 1:N
     ├─────────────┐
     │             │
     ▼             ▼
┌──────────┐  ┌───────────┐
│  Member  │  │ PaidRole  │
└────┬─────┘  └─────┬─────┘
     │ 1:N          │ 1:N
     │              │
     └──────┬───────┘
            │ N:M
            ▼
     ┌──────────────┐
     │ Subscription │
     └──────┬───────┘
            │ 1:N
            ▼
     ┌──────────────┐
     │ WebhookEvent │
     └──────────────┘
```

#### Key Indexes
- `guilds.guildId` (unique, indexed)
- `members.userId, guildId` (composite unique)
- `subscriptions.status` (indexed - frequent queries)
- `subscriptions.externalSubscriptionId, provider` (composite unique)
- `webhook_events.externalEventId` (unique - deduplication)

#### Performance Optimization
- Connection pooling: 10 connections
- Query optimization: `select` only needed fields
- Transactions: Multi-step operations
- Indexes: All foreign keys + frequently queried fields

---

## Data Flow Diagrams

### Payment Success Flow

```
┌─────────┐
│ Member  │
└────┬────┘
     │ 1. Clicks payment button in Discord
     ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 2. Generates checkout URL
       │    (Polar/SePay API call)
       ▼
┌──────────────────┐
│ Payment Provider │
└────────┬─────────┘
         │ 3. Member completes payment
         │
         │ 4. Sends webhook
         ▼
┌──────────────────┐
│ Webhook Server   │
└────────┬─────────┘
         │ 5. Verify signature
         │ 6. Check deduplication
         ▼
┌──────────────────┐
│   PostgreSQL     │
└────────┬─────────┘
         │ 7. Create/update subscription
         │    status = ACTIVE
         ▼
┌──────────────────┐
│ Role Manager     │
│ Service          │
└────────┬─────────┘
         │ 8. Grant role
         ▼
┌──────────────────┐
│  Discord API     │
└────────┬─────────┘
         │ 9. Role assigned
         ▼
┌──────────────────┐
│     Member       │
│ (receives role)  │
└──────────────────┘
```

**Latency Breakdown**:
- Step 1-2: <1s (in-memory operation)
- Step 3: Variable (user completes payment)
- Step 4: <2s (webhook delivery)
- Step 5-7: <200ms (verification + database)
- Step 8-9: <3s (Discord API latency)
- **Total (steps 4-9)**: <5s

---

### Subscription Cancellation Flow

```
┌─────────────────┐
│ Payment Provider│
│ (member cancels)│
└────────┬────────┘
         │ 1. Sends subscription.canceled webhook
         ▼
┌──────────────────┐
│ Webhook Server   │
└────────┬─────────┘
         │ 2. Verify signature
         │ 3. Check deduplication
         ▼
┌──────────────────┐
│   PostgreSQL     │
└────────┬─────────┘
         │ 4. Update subscription
         │    status = CANCELLED
         ▼
┌──────────────────┐
│ Role Manager     │
│ Service          │
└────────┬─────────┘
         │ 5. Revoke role
         ▼
┌──────────────────┐
│  Discord API     │
└────────┬─────────┘
         │ 6. Role removed
         ▼
┌──────────────────┐
│     Member       │
│ (loses access)   │
└──────────────────┘
```

---

### Server Onboarding Flow

```
┌─────────────┐
│ Server Owner│
└──────┬──────┘
       │ 1. Runs /setup command
       ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 2. Display role selection (select menu)
       ▼
┌─────────────┐
│ Server Owner│
└──────┬──────┘
       │ 3. Selects roles
       ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 4. Display pricing modal
       ▼
┌─────────────┐
│ Server Owner│
└──────┬──────┘
       │ 5. Enters prices
       ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 6. Display payment provider selection
       ▼
┌─────────────┐
│ Server Owner│
└──────┬──────┘
       │ 7. Enters API credentials
       ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 8. Validate credentials (API test)
       ▼
┌──────────────────┐
│   PostgreSQL     │
└────────┬─────────┘
         │ 9. Save guild config + paid roles
         ▼
┌──────────────┐
│ Discord Bot  │
└──────┬───────┘
       │ 10. Display success message
       ▼
┌─────────────┐
│ Server Owner│
└─────────────┘
```

---

## Security Architecture

### Authentication & Authorization

#### Discord Bot Authentication
- **Method**: OAuth2 bearer token (bot token)
- **Storage**: Environment variable (`DISCORD_BOT_TOKEN`)
- **Transmission**: HTTPS headers to Discord API
- **Rotation**: Quarterly (manual via Discord Developer Portal)

#### Webhook Authentication

**Polar.sh**:
- **Method**: HMAC-SHA256 signature
- **Header**: `X-Polar-Signature`
- **Secret**: Environment variable (`POLAR_WEBHOOK_SECRET`)
- **Verification**: `@polar-sh/sdk` library

**SePay.vn**:
- **Method**: OAuth2 Bearer token
- **Header**: `Authorization: Bearer <token>`
- **Secret**: Environment variable (`SEPAY_WEBHOOK_SECRET`)
- **Verification**: Token comparison + transaction ID deduplication

#### Command Authorization
- **Admin commands** (`/setup`): Require `ManageGuild` permission
- **Member commands** (`/join`): No special permissions
- **Permission check**: Before command execution
- **Failure**: Ephemeral error message

---

### Data Protection

#### Encryption
- **In Transit**: HTTPS/TLS 1.3 (Discord API, payment providers)
- **At Rest**: PostgreSQL encryption (cloud provider default)
- **Secrets**: Environment variables (never in code/logs)

#### PII Handling
- **Stored**: Discord user IDs (snowflakes), usernames
- **NOT Stored**: Email addresses, credit card data
- **Retention**: User can request deletion via support
- **Third-Party**: Shared with payment providers only (webhooks)

#### Database Security
- **Connection**: SSL in production (`?sslmode=require`)
- **Credentials**: Environment variable (`DATABASE_URL`)
- **Access**: Restricted to bot and webhook server
- **Backups**: Daily automated (7-day retention)

---

### Threat Mitigation

#### Webhook Replay Attacks
**Threat**: Attacker resends valid webhook to trigger duplicate role grants
**Mitigation**: Unique constraint on `webhook_events.externalEventId`
**Detection**: Database constraint violation (P2002 error)
**Response**: Return 200 OK (idempotent), log security event

#### Invalid Signature Attacks
**Threat**: Attacker forges webhook payload
**Mitigation**: HMAC signature verification (Polar), OAuth2 token (SePay)
**Detection**: Signature mismatch
**Response**: 403 Forbidden, log security event, alert admin

#### SQL Injection
**Threat**: Attacker injects malicious SQL via input
**Mitigation**: Prisma uses parameterized queries
**Detection**: N/A (prevented by ORM)
**Response**: N/A

#### Rate Limiting Bypass
**Threat**: Attacker floods webhook endpoints
**Mitigation**: Fastify rate limiter (100 req/min per IP)
**Detection**: Rate limit exceeded
**Response**: 429 Too Many Requests

#### Bot Token Theft
**Threat**: Attacker gains access to bot token
**Mitigation**: Token stored in environment (not code), rotated quarterly
**Detection**: Unusual bot activity (monitoring)
**Response**: Immediately rotate token, revoke compromised token

---

## Deployment Architecture

### Development Environment

```
┌────────────────────────────────────────────┐
│  Developer Machine                         │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────┐  ┌──────────────┐      │
│  │              │  │              │      │
│  │  npm run dev │  │ npm run      │      │
│  │  (Bot)       │  │ dev:webhooks │      │
│  │              │  │              │      │
│  └──────────────┘  └──────────────┘      │
│         │                   │             │
│         └──────┬────────────┘             │
│                ▼                          │
│       ┌────────────────┐                  │
│       │   PostgreSQL   │                  │
│       │  (Docker)      │                  │
│       └────────────────┘                  │
│                                            │
└────────────────────────────────────────────┘
```

**Access**:
- Bot connects to Discord Gateway
- Webhooks via ngrok tunnel (`ngrok http 3000`)
- Database on `localhost:5432`

---

### Production Environment (Docker)

```
┌────────────────────────────────────────────┐
│  Cloud Server (VPS/EC2)                    │
├────────────────────────────────────────────┤
│                                            │
│  ┌────────────────────────────────┐       │
│  │  Docker Compose                │       │
│  ├────────────────────────────────┤       │
│  │                                │       │
│  │  ┌───────────┐  ┌───────────┐ │       │
│  │  │   Bot     │  │  Webhooks │ │       │
│  │  │ Container │  │ Container │ │       │
│  │  └─────┬─────┘  └─────┬─────┘ │       │
│  │        │               │       │       │
│  │        └───────┬───────┘       │       │
│  │                ▼               │       │
│  │       ┌────────────────┐       │       │
│  │       │   PostgreSQL   │       │       │
│  │       │   Container    │       │       │
│  │       └────────────────┘       │       │
│  │                                │       │
│  └────────────────────────────────┘       │
│                                            │
└────────────────┬───────────────────────────┘
                 │
                 │ HTTPS
                 ▼
    ┌─────────────────────────┐
    │  Reverse Proxy (Nginx)  │
    │  SSL Termination        │
    └─────────────────────────┘
```

**Services**:
- **Bot**: `docobo-bot` (no exposed ports)
- **Webhooks**: `docobo-webhooks` (port 3000 → proxy)
- **Database**: `docobo-postgres` (port 5432 internal)

**Volumes**:
- `postgres-data`: Database persistence
- `logs`: Application logs

**Environment**:
- Secrets via `.env` file (mounted as volume)
- Managed by Docker Compose secrets

---

### Scaling Strategy

#### Horizontal Scaling (Future)

**Bot**: Cannot horizontally scale (WebSocket connection)
- Single instance per cluster
- Vertical scaling: Increase CPU/memory

**Webhooks**: Stateless, can horizontally scale
- Load balancer (Nginx, HAProxy)
- Multiple webhook server instances
- Shared PostgreSQL database

**Database**: Vertical scaling initially
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Sharding if >1M subscriptions

---

## Monitoring & Observability

### Logging

**Format**: Structured JSON (Pino)
**Levels**: `debug`, `info`, `warn`, `error`
**Output**: stdout (captured by Docker)

**Example**:
```json
{
  "level": "info",
  "time": 1699900000000,
  "msg": "Webhook received",
  "provider": "polar",
  "eventType": "subscription.active",
  "subscriptionId": "sub_123"
}
```

**Excluded from logs**:
- Bot tokens
- Webhook secrets
- Database credentials
- User PII (except Discord IDs)

---

### Metrics

**Key Metrics**:
- Webhook latency (p50, p95, p99)
- Role grant latency
- Database query duration
- Error rate (webhooks, commands)
- Active subscriptions count

**Collection**: Prometheus (future)
**Visualization**: Grafana (future)

---

### Alerting

**Critical Alerts**:
- Webhook signature verification failure (security)
- Database connection failure
- Discord API rate limit exceeded
- Error rate >5% (15-min window)

**Notification**: Email, Discord webhook, PagerDuty

---

## Disaster Recovery

### Backup Strategy

**Database**:
- Frequency: Daily automated (3 AM UTC)
- Retention: 7 days rolling
- Storage: Cloud provider backup service
- Testing: Monthly restore test

**Application**:
- Source code: Git repository (GitHub)
- Docker images: Container registry
- Configuration: Infrastructure as Code (Terraform)

---

### Recovery Procedures

**Database Failure**:
1. Verify backup integrity
2. Restore from latest backup
3. Update database connection string
4. Restart bot and webhook server
5. Verify functionality
**RTO**: 4 hours | **RPO**: 24 hours

**Bot Failure**:
1. Check error logs
2. Restart bot container
3. If persist, rollback to previous image
4. Investigate root cause
**RTO**: 30 minutes

**Webhook Server Failure**:
1. Check error logs
2. Restart webhook container
3. Payment providers will retry webhooks
4. Process missed events from database
**RTO**: 30 minutes

---

## Performance Benchmarks

### Measured Performance (Target vs Actual)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Webhook ACK | <500ms | TBD | - |
| Role grant (post-webhook) | <5s | TBD | - |
| Database query | <50ms | TBD | - |
| Slash command response | <3s | TBD | - |
| Setup completion | <3min | TBD | - |

**Testing methodology**:
- Load testing: k6 or Artillery
- Profiling: Node.js built-in profiler
- APM: New Relic or DataDog (future)

---

## API Reference

### Internal Services

#### RoleManager Service

**File**: `src/services/role-manager.ts`

**Method**: `grantRole(guildId, userId, roleId)`
- **Parameters**:
  - `guildId` (string): Discord guild snowflake
  - `userId` (string): Discord user snowflake
  - `roleId` (string): Discord role snowflake
- **Returns**: `Promise<void>`
- **Throws**:
  - `PermissionError`: Bot role below target role
  - `NotFoundError`: Guild/user/role not found
  - `DiscordAPIError`: Discord API failure

**Method**: `revokeRole(guildId, userId, roleId)`
- Similar to `grantRole`

---

#### SubscriptionService

**File**: `src/services/subscription.ts`

**Method**: `createSubscription(data)`
- **Parameters**:
  - `data` (SubscriptionData): Subscription details
- **Returns**: `Promise<Subscription>`
- **Throws**:
  - `ValidationError`: Invalid data
  - `DuplicateError`: Subscription already exists

**Method**: `updateSubscriptionStatus(externalId, status)`
- **Parameters**:
  - `externalId` (string): Provider subscription ID
  - `status` (SubscriptionStatus): New status
- **Returns**: `Promise<Subscription>`

---

## Technology Decisions

### Why Discord.js v14?
- **Latest stable version** (November 2025)
- **TypeScript-first** (excellent type safety)
- **Slash commands native** (v13+ required)
- **Active community** (quick bug fixes)

### Why Prisma?
- **Type-safe queries** (prevents runtime errors)
- **Migration system** (version control for schema)
- **Client generation** (auto-completion)
- **Connection pooling** (performance)

### Why Fastify over Express?
- **Performance**: 2x faster (benchmarked)
- **Schema validation**: Built-in JSON schema
- **TypeScript support**: First-class
- **Plugin ecosystem**: Rich

### Why PostgreSQL over MySQL?
- **JSONB support** (flexible metadata storage)
- **Better indexing** (faster queries)
- **ACID compliance** (financial data)
- **Prisma optimization** (better support)

### Why Separate Bot and Webhook Server?
- **Isolation**: Bot crash doesn't affect webhooks
- **Scaling**: Webhook server can scale horizontally
- **Security**: Separate attack surface
- **Deployment**: Independent updates

---

## Future Architecture (v2.0+)

### Planned Improvements

**Message Queue** (RabbitMQ, Redis):
- Decouple webhook processing from role grants
- Better retry logic
- Priority queue for critical events

**Caching Layer** (Redis):
- Cache guild configurations
- Reduce database load
- Faster command responses

**Web Dashboard**:
- Next.js frontend
- Real-time analytics (WebSocket)
- Admin management UI

**Separate Microservices**:
- `subscription-service`: Subscription logic
- `notification-service`: Email/Discord notifications
- `analytics-service`: Metrics and reporting

---

**Document Owner**: Engineering Team
**Last Review**: 2025-11-13
**Next Review**: 2025-12-13 (monthly)
