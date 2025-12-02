# Docobo Discord Bot - MVP Implementation Plan

**Date**: 2025-11-13
**Status**: IN PROGRESS (Phase 5 of 6)
**Objective**: Production-ready paid community management bot - MVP core features only
**Last Updated**: 2025-12-02 (Phase 04 Complete)

---

## Overview

Build professional Discord bot for role-gated payment verification with TypeScript, Discord.js v14, Prisma ORM, Fastify webhooks. Focus: onboarding, payment processing, role automation. Exclude: gamification/DPoints (future).

**Database**: PostgreSQL @ `postgresql://postgres:postgresql@localhost:5432/docobo`

---

## Tech Stack (From Research)

- **Language**: TypeScript (Node 22+)
- **Discord**: Discord.js v14 (1300% perf boost via undici)
- **ORM**: Prisma (best DX, migrations, type-safety)
- **Webhooks**: Fastify (2-3x Express, built-in validation)
- **Payments**: Polar.sh (Standard Webhooks HMAC) + SePay.vn (OAuth2/API Key)
- **Testing**: Jest + Vitest + Supertest
- **Deploy**: Docker Compose → Cloud Run/ECS

---

## Implementation Phases

| Phase | Status | Priority | Est. Time |
|-------|--------|----------|-----------|
| [Phase 01: Environment Setup](./phase-01-setup.md) | COMPLETED | HIGH | 2-3 hrs |
| [Phase 02: Database Schema](./phase-02-database.md) | COMPLETED | HIGH | 3-4 hrs |
| [Phase 03: Bot Core](./phase-03-bot-core.md) | COMPLETED | HIGH | 4-6 hrs |
| [Phase 04: Payment Webhooks](./phase-04-payment-webhooks.md) | COMPLETED ✅ | CRITICAL | 6-8 hrs |
| [Phase 05: Onboarding Flow](./phase-05-onboarding.md) | PENDING | HIGH | 4-5 hrs |
| [Phase 06: Testing & QA](./phase-06-testing.md) | PENDING | CRITICAL | 4-5 hrs |

**Total Estimate**: 23-31 hours

---

## MVP Scope (STRICT)

### ✅ INCLUDED
- Bot basic setup (slash commands, interactions)
- PostgreSQL database (guilds, members, subscriptions, webhooks)
- Polar.sh webhook verification (HMAC signature)
- SePay.vn webhook verification (OAuth2/API Key)
- Role assignment on payment success
- Role removal on subscription cancel/revoke
- Progressive onboarding (3-step setup for server owners)
- Error handling (ephemeral messages, clear feedback)

### ❌ EXCLUDED (Future)
- DPoints/gamification system
- Leaderboards
- Analytics dashboard
- Web panel
- Multi-language support (English only MVP)
- Advanced admin commands
- Refund automation
- Subscription tier upgrades/downgrades

---

## Key Architecture Decisions

**1. Database**: PostgreSQL via Prisma
- ACID compliance for financial transactions
- Complex query support (joins for subscription tracking)
- Prisma Client type-safety eliminates runtime errors

**2. Webhook Security**
- Polar: Standard Webhooks HMAC via `@polar-sh/sdk/webhooks`
- SePay: OAuth2 token + client-side deduplication (transaction `id` uniqueness)
- All webhooks return 200 + `{"success": true}` for idempotent retry handling

**3. Rate Limiting**
- Discord.js v14 @discordjs/rest handles automatic queue mgmt
- Fastify rate-limit plugin for webhook endpoints
- IP ban protection: monitor 401/403/429 errors (10k invalid/10min = ban)

**4. Interaction Pattern**
- 3-second response rule: immediate ACK via `interaction.deferReply()`
- Long operations (payment): Lambda pattern (ACK → process → followUp)
- Ephemeral errors, public confirmations

**5. Onboarding UX**
- Progressive disclosure (max 3 choices per step)
- First 15 minutes critical (research: 5-10 sec dropout window)
- Avoid walls of text, use select menus + buttons
- No DMs (users may disable), use private channels

---

## Success Criteria

- [ ] Bot connects to Discord gateway
- [ ] Database migrations run successfully
- [ ] Polar webhook signature verification passes
- [ ] SePay webhook deduplication prevents replays
- [ ] Role granted within 5 seconds of payment success
- [ ] Role removed on subscription cancellation
- [ ] Onboarding completes in <3 minutes
- [ ] All interactions respond within 3 seconds
- [ ] Test suite coverage >80%
- [ ] Docker compose up = working system

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Discord API rate limits | HIGH | Use @discordjs/rest queue, monitor headers |
| Payment webhook replays | CRITICAL | Transaction ID uniqueness constraints |
| Bot permission hierarchy | HIGH | Position bot role above managed roles |
| Database connection pool exhaustion | MEDIUM | Prisma connection pooling, limits |
| Webhook timeout (3sec) | MEDIUM | Immediate ACK, async processing |

---

## Dependencies

- Node.js 22+
- PostgreSQL 16+ (running locally or Docker)
- Discord Bot Token (from Discord Developer Portal)
- Polar.sh Organization Access Token + Webhook Secret
- SePay.vn API credentials (OAuth2 client ID/secret)

---

## Next Steps

1. Read [Phase 01: Environment Setup](./phase-01-setup.md)
2. Initialize project structure
3. Configure environment variables
4. Install dependencies
5. Proceed sequentially through phases

---

**Note**: Each phase file contains detailed implementation steps, code snippets, security considerations, success criteria. Follow progressive disclosure - complete one phase before next.
