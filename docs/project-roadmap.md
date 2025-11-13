# Docobo Discord Bot - Project Roadmap

**Version**: 1.0
**Created**: 2025-11-13
**Last Updated**: 2025-11-13
**Status**: MVP Development In Progress
**Current Phase**: Phase 02 Complete (Database Schema)

---

## Executive Summary

**Mission**: Automate paid community management on Discord via seamless payment provider integration (Polar.sh, SePay.vn) with instant role-based access.

**Current Status**: Foundation complete (environment setup, database schema). Core bot functionality (slash commands, payment webhooks, onboarding) NOT yet implemented.

**Completion**: 20% (2/6 MVP phases complete)

**Next Critical Milestone**: Phase 03 - Bot Core Development (slash commands, event handlers, role utilities)

**Timeline**: 23-31 hours remaining (out of 29-39 total estimated)

**Blockers**: None. Ready to proceed with Phase 03.

**Dependencies Met**:
- ✅ Node.js 22+ environment configured
- ✅ PostgreSQL database schema designed and migrated
- ✅ TypeScript build pipeline operational
- ✅ Discord.js v14, Prisma ORM, Fastify installed

**Dependencies Pending**:
- ⏳ Discord Bot Token (from Discord Developer Portal)
- ⏳ Polar.sh Organization Access Token + Webhook Secret
- ⏳ SePay.vn OAuth2 credentials (client ID/secret)

---

## Completed Phases

### Phase 01: Environment Setup ✅ (100%)

**Status**: COMPLETE
**Completed**: 2025-11-13
**Duration**: ~2 hours
**Effort**: 2-3 hours estimated

**Achievements**:
- Project structure initialized (`src/`, `prisma/`, `docs/`, `plans/`)
- TypeScript configured (strict mode, ESM modules)
- Dependencies installed:
  - Discord.js v14.24.2 (1300% perf boost via undici)
  - Fastify v4.29.1 (2-3x Express speed)
  - Prisma ORM v5.22.0 (type-safe database access)
  - @polar-sh/sdk v0.9.0 (HMAC webhook verification)
  - Zod v3.25.76 (runtime validation)
- Environment variable validation (`src/config/env.ts`):
  - Zod schema for DISCORD_BOT_TOKEN, DATABASE_URL, POLAR/SEPAY credentials
  - Fail-fast startup validation
- Build scripts configured (`npm run build`, `npm run dev`)
- Git ignored files (.env, node_modules, dist)

**Deliverables**:
- `/mnt/d/www/docobo/package.json` - All dependencies installed
- `/mnt/d/www/docobo/tsconfig.json` - TypeScript strict mode enabled
- `/mnt/d/www/docobo/src/config/env.ts` - Environment validation with Zod
- `/mnt/d/www/docobo/.env.example` - Template for secrets

**Success Criteria Met**:
- [x] `npm run build` succeeds with zero TypeScript errors
- [x] Environment validation rejects missing/invalid secrets
- [x] Project compiles to ESM modules

---

### Phase 02: Database Schema ✅ (100%)

**Status**: COMPLETE
**Completed**: 2025-11-13
**Duration**: ~3 hours
**Effort**: 3-4 hours estimated

**Achievements**:
- PostgreSQL schema designed for financial transactions (ACID compliance)
- Prisma schema defined (`/mnt/d/www/docobo/prisma/schema.prisma`):
  - **Guild** model: Discord server config, payment provider flags
  - **Member** model: User records per guild (composite unique: userId+guildId)
  - **PaidRole** model: Role pricing (USD, 2 decimal precision), provider product IDs
  - **Subscription** model: Payment status tracking (6 states: PENDING, ACTIVE, PAST_DUE, CANCELLED, REVOKED, REFUNDED)
  - **WebhookEvent** model: Deduplication via unique `externalEventId`, full payload audit
- Database migration applied (`prisma migrate dev`)
- Indexes optimized for query performance:
  - Guild: `guildId` (Discord snowflake lookups)
  - Member: `userId`, `guildId` (member queries)
  - Subscription: `status`, `provider`, `externalSubscriptionId` (webhook processing)
  - WebhookEvent: `externalEventId`, `processed`, `eventType` (deduplication)
- Prisma Client generated (`@prisma/client`)
- Database service initialized (`src/services/database.ts`)

**Deliverables**:
- `/mnt/d/www/docobo/prisma/schema.prisma` - Complete schema (211 lines)
- `/mnt/d/www/docobo/prisma/migrations/20251113110148_init/migration.sql` - Applied migration
- `/mnt/d/www/docobo/src/services/database.ts` - Prisma Client export

**Success Criteria Met**:
- [x] Migration runs successfully against PostgreSQL
- [x] Unique constraints prevent duplicate webhook events
- [x] Subscription status enum covers all payment states
- [x] Foreign keys enforce referential integrity (cascade deletes)
- [x] JSONB fields allow flexible metadata storage

**Database Connection**:
- URL: `postgresql://postgres:postgresql@localhost:5432/docobo`
- Connection tested in bot ready event (`src/index.ts`)

---

## Remaining MVP Work (NOT Implemented)

### Phase 03: Bot Core ⏳ (0%)

**Status**: PENDING
**Priority**: HIGH
**Estimated Effort**: 4-6 hours
**Target Start**: Immediately available

**Scope**:
- Discord bot initialization (Client, GatewayIntentBits)
- Slash command registration:
  - `/setup` - Server owner onboarding (3-step progressive flow)
  - `/join` or `/purchase` - Member role purchase
  - `/status` - Check subscription status
  - `/help` - Bot usage guide
- Event handlers:
  - `GuildCreate` - Auto-register new guilds (IMPLEMENTED in `src/index.ts`)
  - `InteractionCreate` - Route slash commands, buttons, select menus
  - `Ready` - Bot startup confirmation
- Role utilities:
  - `grantRole(guildId, userId, roleId)` - Assign Discord role
  - `revokeRole(guildId, userId, roleId)` - Remove Discord role
  - `checkRoleHierarchy(botRole, targetRole)` - Prevent permission errors
- Interaction patterns:
  - 3-second response rule: `interaction.deferReply()` for long operations
  - Ephemeral errors (`ephemeral: true`)
  - Public confirmations

**Deliverables**:
- `/mnt/d/www/docobo/src/commands/setup.ts` - Onboarding flow
- `/mnt/d/www/docobo/src/commands/purchase.ts` - Role purchase
- `/mnt/d/www/docobo/src/commands/status.ts` - Subscription status
- `/mnt/d/www/docobo/src/utils/role-manager.ts` - Role grant/revoke logic
- `/mnt/d/www/docobo/src/handlers/interaction.ts` - Command routing

**Success Criteria**:
- [ ] Bot connects to Discord gateway
- [ ] All slash commands register successfully
- [ ] `GuildCreate` event auto-registers guilds in database
- [ ] Role grant/revoke respects Discord permission hierarchy
- [ ] All interactions respond <3 seconds

**Dependencies**:
- Discord Bot Token (DISCORD_BOT_TOKEN in .env)
- Discord Application ID (DISCORD_CLIENT_ID in .env)

**Blockers**: None (foundation complete)

---

### Phase 04: Payment Webhooks ⏳ (0%)

**Status**: PENDING
**Priority**: CRITICAL
**Estimated Effort**: 6-8 hours
**Target Start**: After Phase 03 complete

**Scope**:
- Fastify webhook server (port 3000)
- Polar.sh integration:
  - POST `/webhooks/polar` endpoint
  - HMAC signature verification (`@polar-sh/sdk/webhooks`)
  - Events handled: `subscription.created`, `subscription.active`, `subscription.canceled`, `subscription.revoked`
  - Response: 200 + `{"success": true}` (idempotent)
- SePay.vn integration:
  - POST `/webhooks/sepay` endpoint
  - OAuth2 Bearer token verification
  - Events handled: `payment.verified`
  - Deduplication: Transaction ID unique constraint
- Webhook event logging:
  - Insert into `webhook_events` table (full payload audit)
  - Unique constraint on `externalEventId` (prevent replays)
- Role automation triggers:
  - Payment success → `ACTIVE` subscription → grant role
  - Payment cancel → `CANCELLED` subscription → revoke role
  - Refund → `REFUNDED` subscription → revoke role
- Error handling:
  - Invalid signature → 403 Forbidden + security log
  - Duplicate event → 200 OK + skip processing
  - Database failure → 500 Internal Error + retry
  - Discord API error → log, notify admin, mark subscription PENDING

**Deliverables**:
- `/mnt/d/www/docobo/src/webhook-server.ts` - Fastify server (STUB exists)
- `/mnt/d/www/docobo/src/webhooks/polar.ts` - Polar webhook handler
- `/mnt/d/www/docobo/src/webhooks/sepay.ts` - SePay webhook handler
- `/mnt/d/www/docobo/src/services/webhook-processor.ts` - Event processing logic

**Success Criteria**:
- [ ] Webhook ACK latency <500ms (99th percentile)
- [ ] Polar HMAC signature verification passes
- [ ] SePay OAuth2 token validation works
- [ ] Duplicate events return 200 without processing
- [ ] Role granted within 5 seconds of webhook receipt
- [ ] Zero duplicate role grants (unique constraint works)

**Dependencies**:
- POLAR_WEBHOOK_SECRET (from Polar.sh dashboard)
- POLAR_ACCESS_TOKEN (from Polar.sh organization)
- SEPAY_CLIENT_ID, SEPAY_CLIENT_SECRET (from SePay.vn)
- SEPAY_WEBHOOK_SECRET (configured in SePay.vn)

**Blockers**: None (database schema supports deduplication)

---

### Phase 05: Onboarding Flow ⏳ (0%)

**Status**: PENDING
**Priority**: HIGH
**Estimated Effort**: 4-5 hours
**Target Start**: After Phase 03 complete (parallel with Phase 04)

**Scope**:
- Progressive onboarding (max 3 choices per step):
  - **Step 1/3**: Select roles to monetize (multi-select menu)
  - **Step 2/3**: Set pricing per role (modal input, USD validation)
  - **Step 3/3**: Configure payment providers (Polar, SePay, or both)
- Credential validation:
  - Polar: Test HMAC secret via dummy signature check
  - SePay: Test OAuth2 credentials via token endpoint
- Database persistence:
  - Update `guilds` table: `polarEnabled`, `sepayEnabled` flags
  - Insert into `paid_roles` table: roleId, priceUsd, provider product IDs
- User experience:
  - Progress indicators (1/3, 2/3, 3/3)
  - Ephemeral messages (private to server owner)
  - Error messages: 4-part structure (what, why, how, help)
  - Setup resumable (save progress if interrupted)
  - Mobile-responsive (Discord mobile app support)
- Success confirmation:
  - Embed summary: Configured roles, pricing, providers enabled
  - Next steps: Guide to test with `/purchase` command

**Deliverables**:
- `/mnt/d/www/docobo/src/commands/setup.ts` - Multi-step onboarding (enhanced)
- `/mnt/d/www/docobo/src/utils/validators.ts` - Price validation, credential checks

**Success Criteria**:
- [ ] Setup completes in <3 minutes (90th percentile)
- [ ] Completion rate >80%
- [ ] Invalid credentials rejected before completion
- [ ] Setup resumable (progress saved in database)
- [ ] Mobile completion rate >70%

**Dependencies**:
- Phase 03 complete (slash command framework)
- Valid payment provider credentials (for validation tests)

**Blockers**: None (schema supports guild configuration)

---

### Phase 06: Testing & QA ⏳ (0%)

**Status**: PENDING
**Priority**: CRITICAL
**Estimated Effort**: 4-5 hours
**Target Start**: After Phases 03-05 complete

**Scope**:
- Unit tests (Jest):
  - Environment validation (`src/config/env.test.ts`)
  - Role manager utilities (`src/utils/role-manager.test.ts`)
  - Webhook signature verification (`src/webhooks/polar.test.ts`, `sepay.test.ts`)
  - Database service (`src/services/database.test.ts`)
- Integration tests (Supertest):
  - Polar webhook flow (signature → deduplication → role grant)
  - SePay webhook flow (OAuth2 → transaction ID uniqueness)
  - Bot command execution (`/setup`, `/purchase`, `/status`)
- End-to-end tests:
  - Full payment flow: Purchase → webhook → role granted
  - Cancellation flow: Cancel → webhook → role revoked
  - Error scenarios: Invalid signature, missing role, permission denied
- Test coverage targets:
  - Overall: >80%
  - Critical paths (webhooks, role manager): >95%
  - Database queries: >90%
- Manual QA checklist:
  - Bot connects to Discord
  - Slash commands visible in Discord UI
  - Setup flow completes successfully
  - Payment webhook triggers role grant
  - Role hierarchy respected (bot role position)
  - Error messages clear and actionable

**Deliverables**:
- `/mnt/d/www/docobo/src/**/*.test.ts` - Test suites
- `/mnt/d/www/docobo/jest.config.js` - Jest configuration
- `/mnt/d/www/docobo/docs/testing-guide.md` - QA procedures
- Coverage report (`npm run test:coverage`)

**Success Criteria**:
- [ ] Test coverage >80%
- [ ] All critical paths tested (webhooks, role grants)
- [ ] Zero failing tests in CI/CD pipeline
- [ ] Manual QA checklist 100% passed
- [ ] Docker Compose up = working system

**Dependencies**:
- Phases 03-05 complete (all code implemented)
- Test Discord server with bot invited
- Mock webhook payloads (Polar, SePay examples)

**Blockers**: None (test frameworks already installed)

---

## Future Features (v2.0+)

### Gamification System (v2.0 - 6 weeks)

**Status**: NOT IN MVP
**Rationale**: Adds complexity without validating core payment flow. Defer until MVP proven with real users.

**Planned Features**:
- DPoints earning mechanism:
  - Points on message activity (1 point per message, max 50/day)
  - Bonus points for server events (voice chat, stream, reactions)
  - Multipliers for premium roles (2x, 5x, 10x)
- Leaderboard system:
  - Monthly leaderboard (reset 1st of month)
  - All-time leaderboard (persistent)
  - Top 10 display in dedicated channel
- Achievement badges:
  - "First Purchase" (buy any paid role)
  - "Loyal Member" (30 days active subscription)
  - "Top Contributor" (leaderboard #1)
- Social sharing:
  - Generate shareable leaderboard cards (PNG images)
  - Discord embed with user rank, points, achievements

**Estimated Effort**: 6 weeks (40-50 hours)

**Dependencies**: MVP v1.0 launched with ≥50 active guilds

---

### Advanced Analytics Dashboard (v2.0 - 4 weeks)

**Status**: NOT IN MVP
**Rationale**: Server owners need basic payment verification first. Advanced analytics add value after MVP validated.

**Planned Features**:
- Web dashboard (Next.js + Tailwind CSS):
  - OAuth2 Discord login (server owner verification)
  - Real-time transaction feed (WebSocket updates)
  - Revenue charts (daily, weekly, monthly)
  - Conversion funnels (visitors → purchases)
  - Member churn analysis (cancellation trends)
  - Payment method breakdown (Polar vs SePay)
- Manual operations:
  - Process refunds (Polar/SePay API calls)
  - Override subscription status (admin action)
  - Export transaction data (CSV, JSON)
- Notifications:
  - Email alerts for failed payments
  - Discord DM for new purchases
  - Slack integration for team notifications

**Estimated Effort**: 4 weeks (30-40 hours)

**Dependencies**: MVP v1.0 with ≥100 transactions processed

---

### Multi-Currency Support (v2.0 - 2 weeks)

**Status**: NOT IN MVP
**Rationale**: MVP targets English-speaking markets (USD only). Add later with international demand.

**Planned Features**:
- Currency support: USD, EUR, GBP, VND
- Automatic currency conversion (exchange rate API)
- Region-based pricing (geo-IP detection)
- Display prices in user's preferred currency
- Database schema changes:
  - `paidRoles.currency` (expand from USD-only)
  - `subscriptions.pricePaid` (record actual amount)

**Estimated Effort**: 2 weeks (15-20 hours)

**Dependencies**: Payment provider support (Polar supports multi-currency, SePay VND-focused)

---

### Subscription Tiers & Billing (v2.0 - 3 weeks)

**Status**: NOT IN MVP
**Rationale**: One-time payments simpler for MVP. Recurring subscriptions add complexity.

**Planned Features**:
- Billing cycles: Monthly, yearly (auto-renewal)
- Tier upgrades/downgrades:
  - Prorated billing (charge/credit difference)
  - Immediate role switch on upgrade
  - Delayed role revoke on downgrade (end of period)
- Trial periods:
  - 7-day free trial (role granted immediately)
  - Auto-convert to paid after trial
  - Cancel before trial end = no charge
- Subscription management:
  - `/subscribe upgrade <role>` - Upgrade tier
  - `/subscribe pause` - Pause subscription (keep role for period)
  - `/subscribe resume` - Resume paused subscription

**Estimated Effort**: 3 weeks (20-25 hours)

**Dependencies**: Polar/SePay recurring billing support

---

### Web Admin Dashboard (v2.0 - 5 weeks)

**Status**: NOT IN MVP
**Rationale**: Discord-based admin sufficient for MVP. Web dashboard requires separate infrastructure.

**Planned Features**:
- Browser-based configuration (alternative to `/setup`)
- Real-time transaction feed (WebSocket updates)
- Detailed reports:
  - Revenue breakdown (per role, per provider)
  - Member acquisition funnel
  - Retention metrics (monthly active users)
- Manual refund processing (admin override)
- Bulk operations:
  - Import existing members (CSV upload)
  - Export transaction data (JSON, CSV)
  - Mass role assignment/revocation

**Estimated Effort**: 5 weeks (40-50 hours)

**Dependencies**: Next.js app deployed, Discord OAuth2 configured

---

## Timeline & Milestones

### MVP Development (v0.1.0 - 4 weeks)

**Goal**: Validate core payment flow with beta users

| Week | Phases | Deliverables | Status |
|------|--------|--------------|--------|
| **Week 1** | Phase 01-02 | Environment + Database | ✅ COMPLETE |
| **Week 2** | Phase 03 | Bot core (commands, events, roles) | ⏳ PENDING |
| **Week 3** | Phase 04-05 | Payment webhooks + Onboarding | ⏳ PENDING |
| **Week 4** | Phase 06 | Testing, QA, Docker deployment | ⏳ PENDING |

**Key Milestones**:
- [x] 2025-11-13: Phase 01-02 complete (environment + database)
- [ ] Week 2 End: Bot responds to slash commands
- [ ] Week 3 End: Payment webhook grants role within 5 seconds
- [ ] Week 4 End: MVP v0.1.0 deployed (Docker Compose)

**Success Metrics**:
- Setup completion rate: >80%
- Payment success rate: >95%
- Role grant latency: <5s (p99)
- Test coverage: >80%

---

### Beta Testing (v0.2.0 - 2 weeks)

**Goal**: Test with real users, gather feedback, iterate

**Activities**:
- Invite 10-20 beta Discord servers
- Monitor error logs, webhook delivery rates
- Conduct user surveys (server owners, members)
- Iterate on UX pain points identified
- Fix critical bugs (priority: payment flows)

**Success Metrics**:
- Beta server retention: >70%
- Payment completion rate: >75%
- Admin NPS: >60
- Critical bug count: <5

---

### Public Launch (v1.0.0 - 1 week)

**Goal**: Public release, marketing, monitoring

**Activities**:
- Publish bot to Discord bot listing sites (top.gg, discord.bots.gg)
- Launch marketing campaign (social media, Discord communities)
- 24/7 uptime monitoring (Sentry, Datadog)
- Support channel monitoring (response time <2 hours)
- Performance optimization (database query tuning)

**Success Metrics**:
- Active guilds: 50 (first month)
- Total subscriptions: 200 (first month)
- Uptime: >99.5%
- Support response time: <2 hours

---

### Gamification Launch (v2.0.0 - 6 weeks post-MVP)

**Goal**: Add engagement features (DPoints, leaderboards)

**Prerequisites**:
- MVP v1.0 launched
- ≥50 active guilds
- ≥500 total subscriptions
- Positive user feedback on core features

**Timeline**: 6 weeks after v1.0 stable

---

## Key Dependencies

### Environment Dependencies (✅ Complete)

- [x] Node.js 22+ installed
- [x] PostgreSQL 16+ running (local or Docker)
- [x] npm packages installed (`package.json`)
- [x] TypeScript build pipeline working
- [x] Prisma Client generated

---

### External Service Dependencies (⏳ Pending)

#### Discord Bot Setup (CRITICAL)

**Required For**: Phase 03 (Bot Core)

**Steps**:
1. Create Discord Application (https://discord.com/developers/applications)
2. Enable bot in application settings
3. Generate bot token (DISCORD_BOT_TOKEN)
4. Copy application ID (DISCORD_CLIENT_ID)
5. Configure OAuth2 scopes: `bot`, `applications.commands`
6. Configure bot permissions:
   - Manage Roles (required for role grant/revoke)
   - Send Messages (required for confirmations)
   - Use Slash Commands (required for interactions)
7. Generate OAuth2 invite URL
8. Position bot role above managed roles (role hierarchy)

**Environment Variables**:
```
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
```

---

#### Polar.sh Integration (CRITICAL)

**Required For**: Phase 04 (Payment Webhooks)

**Steps**:
1. Create Polar.sh organization account
2. Generate Organization Access Token (Settings → API)
3. Create webhook endpoint configuration:
   - URL: `https://your-domain.com/webhooks/polar`
   - Events: `subscription.*`, `order.*`
4. Copy webhook signing secret (POLAR_WEBHOOK_SECRET)
5. Create products for Discord roles (product IDs)

**Environment Variables**:
```
POLAR_ACCESS_TOKEN=YOUR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

**Documentation**: https://polar.sh/docs

---

#### SePay.vn Integration (CRITICAL)

**Required For**: Phase 04 (Payment Webhooks)

**Steps**:
1. Register SePay.vn merchant account (https://sepay.vn)
2. Create OAuth2 application
3. Copy OAuth2 client credentials (client ID, client secret)
4. Configure webhook endpoint:
   - URL: `https://your-domain.com/webhooks/sepay`
   - Event: `payment.verified`
5. Generate webhook secret (SEPAY_WEBHOOK_SECRET)

**Environment Variables**:
```
SEPAY_CLIENT_ID=YOUR_CLIENT_ID
SEPAY_CLIENT_SECRET=YOUR_CLIENT_SECRET
SEPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

**Documentation**: https://docs.sepay.vn

---

### Deployment Dependencies (Post-MVP)

**Required For**: Production deployment

- [ ] Domain name registered
- [ ] SSL certificate (Let's Encrypt)
- [ ] Cloud hosting (AWS ECS, Google Cloud Run, DigitalOcean)
- [ ] PostgreSQL managed instance (AWS RDS, Supabase)
- [ ] Webhook public URL (Cloudflare Tunnel, ngrok for dev)
- [ ] Monitoring (Sentry, Datadog, New Relic)
- [ ] CI/CD pipeline (GitHub Actions, GitLab CI)

---

## Risks & Mitigation

### Technical Risks

#### Risk 1: Webhook Replay Attacks ⚠️

**Severity**: CRITICAL
**Likelihood**: Medium
**Impact**: Duplicate role grants, financial loss, security breach

**Mitigation**:
- ✅ Unique constraint on `webhook_events.externalEventId` (database-level)
- ✅ Return 200 OK for duplicate events (idempotent handler)
- ✅ Full payload audit in `webhook_events.rawPayload` (forensics)
- Test coverage for deduplication logic (Phase 06)

**Contingency**:
- Audit database for duplicate `externalEventId` entries
- Manual role revocation for duplicates
- Rotate webhook secrets if breach detected

---

#### Risk 2: Discord API Rate Limiting ⚠️

**Severity**: HIGH
**Likelihood**: Medium (during traffic spikes)
**Impact**: Delayed role grants, poor user experience, 429 errors

**Mitigation**:
- ✅ Discord.js v14 `@discordjs/rest` automatic queue management
- Respect rate limit headers (50 req/s global, 5 req/s per resource)
- Implement exponential backoff on 429 errors
- Monitor rate limit headers in production logs

**Contingency**:
- Queue role grants if rate limited (background job)
- Notify affected users of delay (<1 minute)
- Retry failed role grants via cron job

---

#### Risk 3: Database Connection Exhaustion ⚠️

**Severity**: HIGH
**Likelihood**: Low (with connection pooling)
**Impact**: Service downtime, failed webhooks, 500 errors

**Mitigation**:
- ✅ Prisma connection pooling (10 connections default)
- Monitor connection pool usage (Prisma metrics)
- Set connection timeout limits (prevent hanging queries)
- Horizontal scaling (multiple bot instances, shared database)

**Contingency**:
- Increase connection pool size (20-50 connections)
- Database read replicas for query load distribution
- Restart bot process to reset connections

---

#### Risk 4: Missing Signature Verification 🔴

**Severity**: CRITICAL
**Likelihood**: Low (caught in testing)
**Impact**: Unauthorized role grants, security breach, fraud

**Mitigation**:
- Test coverage for Polar HMAC signature verification (Phase 06)
- Test coverage for SePay OAuth2 token validation (Phase 06)
- Fail-fast validation (reject webhook before processing)
- Security audit before production deployment

**Contingency**:
- Immediate webhook secret rotation
- Audit all role grants in past 24 hours
- Manual revocation of suspicious role assignments
- Incident report to payment providers

---

#### Risk 5: 3-Second Interaction Timeout ⚠️

**Severity**: MEDIUM
**Likelihood**: Medium (complex operations)
**Impact**: Failed slash commands, user frustration

**Mitigation**:
- Use `interaction.deferReply()` for all non-trivial operations
- Async processing pattern (ACK → process → followUp)
- Optimize database queries (indexes, query planning)
- Webhook processing in background (immediate 200 ACK)

**Contingency**:
- Refactor slow commands to use deferred replies
- Cache expensive queries (guild config, role pricing)
- Profile slow operations via logging

---

### Business Risks

#### Risk 6: Low Adoption Rate ⚠️

**Severity**: HIGH
**Likelihood**: Medium
**Impact**: Failed product launch, wasted development effort

**Mitigation**:
- Beta testing with 10-20 servers (validation before launch)
- User surveys to identify pain points (iterate on feedback)
- Marketing to niche communities (course creators, membership sites)
- Free tier for small servers (<100 members)

**Contingency**:
- Pivot to specific niche (e.g., education, gaming guilds)
- Partner with Discord community platforms
- Offer setup assistance (white-glove onboarding)

---

#### Risk 7: Payment Provider Downtime ⚠️

**Severity**: HIGH
**Likelihood**: Low
**Impact**: Members cannot purchase, revenue loss

**Mitigation**:
- ✅ Support 2 providers (Polar + SePay redundancy)
- Monitor provider status pages (automated alerts)
- Display provider status in `/purchase` command
- Graceful degradation (disable unavailable provider)

**Contingency**:
- Communicate downtime to users (ephemeral message)
- Offer alternative payment method (switch to backup provider)
- Manual role grant for affected purchases (support ticket)

---

#### Risk 8: Discord API Breaking Changes ⚠️

**Severity**: MEDIUM
**Likelihood**: Low (Discord provides migration periods)
**Impact**: Bot functionality broken, service downtime

**Mitigation**:
- Monitor Discord changelog (https://discord.com/developers/docs/change-log)
- Update `discord.js` dependencies promptly (patch releases)
- Test bot in development before production deployment
- Maintain backward compatibility during migrations

**Contingency**:
- Hotfix deployment (emergency patch)
- Rollback to previous bot version (Docker image)
- Communicate downtime to users (status page)

---

## Success Metrics

### Product Metrics (MVP v1.0)

| Metric | Target | Measurement | Status |
|--------|--------|-------------|--------|
| Setup completion rate | >80% | Analytics: `/setup` start → completion | ⏳ Not tracked yet |
| Setup duration | <3 min | Analytics: Time between start → success | ⏳ Not tracked yet |
| Purchase completion | >75% | Analytics: `/join` click → role granted | ⏳ Not tracked yet |
| Purchase duration | <2 min | Analytics: Time between click → role grant | ⏳ Not tracked yet |
| Payment error rate | <5% | Logs: Failed webhook events / total | ⏳ Not tracked yet |
| Role grant latency | <5s (p99) | Logs: Webhook received → role granted | ⏳ Not tracked yet |

---

### Technical Metrics (MVP v1.0)

| Metric | Target | Measurement | Status |
|--------|--------|-------------|--------|
| Webhook ACK latency | <500ms (p99) | Logs: Request received → 200 response | ⏳ Not implemented |
| Database query latency | <50ms (p95) | Prisma logs | ⏳ Not tracked yet |
| Bot uptime | >99.5% | Monitoring: Uptime checks | ⏳ Not deployed |
| Test coverage | >80% | Jest coverage report | ⏳ Phase 06 pending |
| TypeScript errors | 0 | Build: `npm run build` | ✅ 0 errors |

---

### Business Metrics (6 months post-launch)

| Metric | Target | Measurement | Status |
|--------|--------|-------------|--------|
| Active guilds | 100 | Database: Active guilds count | ⏳ Pre-launch |
| Total subscriptions | 1,000 | Database: Active subscriptions | ⏳ Pre-launch |
| Monthly recurring revenue | $10K | Analytics: Sum of subscriptions | ⏳ Pre-launch |
| Churn rate | <10% | Analytics: Cancellations / active subs | ⏳ Pre-launch |
| Admin NPS | >60 | Survey: Server owner satisfaction | ⏳ Pre-launch |
| Member NPS | >50 | Survey: Member satisfaction | ⏳ Pre-launch |

---

## Change Log

### v1.0 (2025-11-13)

**Phase 01-02 Completed**:
- Environment setup: TypeScript, dependencies, build pipeline
- Database schema: Prisma schema designed, migration applied
- Bot initialization: Basic Discord client (gateway connection, guild registration)
- Database service: Prisma Client integrated

**Next Steps**:
- Phase 03: Implement slash commands (`/setup`, `/purchase`, `/status`)
- Phase 03: Build role manager utilities (grant/revoke with hierarchy checks)
- Phase 04: Create webhook handlers (Polar HMAC, SePay OAuth2)
- Phase 05: Design progressive onboarding flow (3-step setup)
- Phase 06: Write test suites (unit, integration, E2E)

**Outstanding Questions**:
- Webhook deployment strategy (Cloudflare Tunnel vs ngrok for development)
- Production hosting choice (AWS ECS vs Google Cloud Run vs DigitalOcean)
- Monitoring tool selection (Sentry vs Datadog vs New Relic)

---

**Document Owner**: Project Management Team
**Last Review**: 2025-11-13
**Next Review**: 2025-11-20 (weekly during MVP development)
