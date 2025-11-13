# Docobo Discord Bot - Implementation Plan Summary

**Created**: 2025-11-13 17:46
**Plan Directory**: `/mnt/d/www/docobo/plans/20251113-1746-docobo-mvp-implementation/`
**Total Phases**: 6
**Estimated Time**: 23-31 hours

---

## Executive Summary

Comprehensive step-by-step implementation plan for Docobo Discord Bot MVP. Covers environment setup, database design, bot core, payment webhooks, progressive onboarding, and testing. Built on research from 5 authoritative sources totaling 10+ citations.

**Tech Stack**: TypeScript, Discord.js v14, Prisma ORM, Fastify, PostgreSQL
**Payment Providers**: Polar.sh (HMAC), SePay.vn (OAuth2/API Key)
**MVP Scope**: Onboarding, payment webhooks, role automation (NO gamification/DPoints)

---

## File Structure

```
plan.md                    # Main overview (80 lines)
├── phase-01-setup.md      # Environment setup (148 lines)
├── phase-02-database.md   # Database schema (147 lines)
├── phase-03-bot-core.md   # Discord bot core (150 lines)
├── phase-04-payment-webhooks.md  # Webhook processing (144 lines)
├── phase-05-onboarding.md # Progressive disclosure UX (142 lines)
└── phase-06-testing.md    # Testing & QA (150 lines)
```

**Total Documentation**: ~900 lines across 7 files

---

## Key Architecture Decisions

### 1. Database: PostgreSQL via Prisma
- **Why**: ACID compliance for financial transactions, type-safe client
- **Schema**: Guilds → Members → Subscriptions → Webhook Events
- **Deduplication**: Unique constraint on `webhook_events.externalEventId`

### 2. Webhook Security
- **Polar**: Standard Webhooks HMAC signature via `@polar-sh/sdk`
- **SePay**: OAuth2 Bearer token + client-side dedup (transaction ID)
- **Pattern**: Return 200 immediately, process async (prevent timeout)

### 3. Role Automation
- **Grant**: `subscription.active` event → assign role within 5s
- **Revoke**: `subscription.revoked` event → remove role
- **Safety**: DB transaction + role hierarchy check

### 4. UX Patterns (Research-Driven)
- **Progressive disclosure**: Max 3 choices per step
- **3-second rule**: Defer all non-trivial interactions
- **First 15 min critical**: Onboarding completes in <3 min
- **Mobile-first**: Test on 375px width

---

## Phase Breakdown

### Phase 01: Environment Setup (2-3 hrs)
**Deliverables**:
- TypeScript project with strict mode
- Discord.js v14, Prisma, Fastify dependencies
- ESLint + Prettier + Husky hooks
- Docker Compose (bot + postgres + webhooks)
- Environment validation (Zod)

**Success Criteria**: `npm install` completes, PostgreSQL connects, Docker builds

---

### Phase 02: Database Schema (3-4 hrs)
**Deliverables**:
- Prisma schema (guilds, members, subscriptions, roles, webhook_events)
- Migrations + seed script
- Database service (connection pooling, helpers)
- Indexes on foreign keys + status fields

**Success Criteria**: Migrations run, Prisma Studio shows test data, queries <50ms

---

### Phase 03: Bot Core (4-6 hrs)
**Deliverables**:
- Discord gateway connection + intents
- Slash command registration (global/guild)
- Commands: `/setup`, `/join`, `/help`
- Role management utilities (grant/revoke)
- Event handlers (ready, guildCreate, interactionCreate)

**Success Criteria**: Bot connects, commands visible in Discord, permission checks work

---

### Phase 04: Payment Webhooks (6-8 hrs)
**Deliverables**:
- Fastify server on port 3000
- Polar webhook endpoint (`/webhooks/polar`) with signature verification
- SePay webhook endpoint (`/webhooks/sepay`) with auth verification
- Deduplication logic (check before processing)
- Role automation service (grant/revoke on events)
- Event processors (Polar 6 events, SePay 1 event)

**Success Criteria**: Webhooks ACK <500ms, role granted in <5s, duplicates ignored

---

### Phase 05: Onboarding Flow (4-5 hrs)
**Deliverables**:
- Admin setup: 3-step flow (roles → pricing → payment)
- Interactive components (select menus, buttons, modals)
- Setup state persistence (resume partial setup)
- Member join flow (role selection → payment)
- Progress indicators (Step X/Y • Z% complete)
- Embed builders (colors, formatting from design guidelines)

**Success Criteria**: Setup completes <3 min, all interactions <3s, mobile-compatible

---

### Phase 06: Testing & QA (4-5 hrs)
**Deliverables**:
- Jest configuration + test setup
- Unit tests (database, deduplication, services)
- Integration tests (webhook endpoints, commands)
- E2E tests (payment → role grant flow)
- Discord API mocks
- GitHub Actions CI pipeline
- >80% code coverage

**Success Criteria**: All tests pass, coverage >80%, CI passes, <30s test suite

---

## Research Integration

### Source Analysis
| Research File | Key Insights Used |
|---------------|-------------------|
| `discord-bot-research.md` | Rate limiting, slash commands, role hierarchy, webhook security |
| `discord-bot-stack/251113-condensed.md` | TypeScript + Discord.js v14 + Prisma + Fastify decision |
| `polar-sepay-payment-integration-research.md` | Polar HMAC signature, SePay dedup, webhook patterns |
| `discord-bot-ux-research.md` | 3-second rule, progressive disclosure, embed design |
| `design-guidelines.md` | Colors, typography, component patterns, accessibility |

**Total Citations**: 26+ sources across research files

---

## Security Considerations (Critical)

1. **Webhook Verification**
   - ALWAYS verify Polar HMAC signature (fail fast)
   - ALWAYS verify SePay OAuth2/API Key
   - Never skip verification in production

2. **Deduplication**
   - Unique constraint on `externalEventId`
   - Return 200 for duplicates (prevent retry loops)
   - Critical for financial integrity

3. **Role Hierarchy**
   - Bot role MUST be above managed roles
   - Check position before role operations
   - Fail gracefully with clear error

4. **Environment Security**
   - Never commit `.env` file
   - Validate env on startup (Zod)
   - Rotate webhook secrets quarterly

5. **Permission System**
   - Admin commands: Check `ManageGuild`
   - Bot permissions: Least privilege (no Administrator)
   - Ephemeral errors (user-specific visibility)

---

## Risk Assessment

| Risk | Impact | Mitigation | Phase |
|------|--------|------------|-------|
| Webhook replay attacks | CRITICAL | Unique constraint on event ID | 04 |
| Missing signature verification | CRITICAL | Fail-fast validation, tests | 04, 06 |
| 3-second timeout | HIGH | Defer all non-trivial interactions | 03, 05 |
| Role hierarchy conflict | HIGH | Check bot role position | 03, 04 |
| Database connection exhaustion | MEDIUM | Prisma connection pooling | 02 |
| Webhook processing timeout | MEDIUM | Async processing via setImmediate | 04 |
| Incomplete setup | MEDIUM | Resume functionality, state persistence | 05 |
| Test flakiness | MEDIUM | Deterministic data, avoid timers | 06 |

---

## Performance Benchmarks

| Metric | Target | Phase |
|--------|--------|-------|
| Webhook ACK response | <500ms | 04 |
| Role grant (after webhook) | <5s | 04 |
| Database query (role check) | <50ms | 02 |
| Interaction response | <3s | 03, 05 |
| Admin setup completion | <3 min | 05 |
| Test suite execution | <30s | 06 |

---

## MVP Scope Boundaries

### ✅ INCLUDED
- Bot slash commands (`/setup`, `/join`, `/help`)
- PostgreSQL database (5 tables)
- Polar.sh webhook integration (HMAC signature)
- SePay.vn webhook integration (OAuth2/API Key)
- Role automation (grant on payment, revoke on cancel)
- Progressive onboarding (3-step admin, 1-step member)
- Error handling (ephemeral messages, clear feedback)
- Testing (unit, integration, E2E, >80% coverage)
- Docker deployment (bot + postgres + webhooks)

### ❌ EXCLUDED (Future Scope)
- DPoints/gamification system
- Leaderboards
- Analytics dashboard
- Web admin panel
- Multi-language support (English only MVP)
- Advanced admin commands (stats, reports)
- Automated refund handling
- Subscription tier upgrades/downgrades
- Discord server subscriptions (native feature)

---

## Implementation Sequence

**Critical Path** (must be sequential):
```
Phase 01 → Phase 02 → Phase 03 → Phase 04 → Phase 05 → Phase 06
```

**Parallelizable Work** (after Phase 03):
- Phase 04 (webhooks) can partially overlap with Phase 05 (onboarding UI)
- Testing (Phase 06) ongoing throughout (TDD approach recommended)

**Blocking Dependencies**:
- Phase 04 requires Phase 02 (database schema)
- Phase 04 requires Phase 03 (role automation utilities)
- Phase 05 requires Phase 03 (command framework)
- Phase 06 requires all previous phases (integration tests)

---

## Success Metrics (MVP Completion)

### Technical
- [ ] Bot online, serving guilds
- [ ] Database migrations applied
- [ ] Webhook endpoints respond to health checks
- [ ] Polar signature verification 100% pass rate
- [ ] SePay auth verification 100% pass rate
- [ ] Role granted within 5s (99th percentile)
- [ ] Role revoked within 5s (99th percentile)
- [ ] Zero duplicate webhook processing
- [ ] Test coverage >80% (all categories)
- [ ] Docker Compose: `up` → working system

### User Experience
- [ ] Admin setup completes in <3 min (90th percentile)
- [ ] Member join flow completes in <1 min
- [ ] All interactions respond within 3s
- [ ] Mobile compatibility (375px width)
- [ ] Error messages clear, actionable
- [ ] Setup resumable (state persistence works)

### Security
- [ ] Environment validation fails startup if secrets missing
- [ ] Webhook endpoints reject invalid signatures (403)
- [ ] Admin commands verify `ManageGuild` permission
- [ ] Bot role hierarchy validated before operations
- [ ] No secrets in logs or error messages
- [ ] Rate limiting active on webhook endpoints

---

## Next Steps After Plan Review

1. **Approve Plan**: Review all phase files, confirm scope
2. **Create GitHub Repo**: Initialize with `.gitignore`, `README.md`
3. **Start Phase 01**: Follow `phase-01-setup.md` step-by-step
4. **Daily Standups**: Track progress, blockers, deviations
5. **Complete Phases Sequentially**: Do NOT skip ahead
6. **Test Continuously**: Run tests after each phase
7. **Document Deviations**: Update plan if requirements change
8. **Deploy to Staging**: After Phase 06 completion
9. **Manual QA**: User acceptance testing
10. **Production Deployment**: After QA sign-off

---

## File Locations

- **Main Plan**: `/mnt/d/www/docobo/plans/20251113-1746-docobo-mvp-implementation/plan.md`
- **Phase Files**: `./phase-01-setup.md` through `./phase-06-testing.md`
- **Database URL**: `postgresql://postgres:postgresql@localhost:5432/docobo`
- **Webhook Port**: `3000`

---

## Contact & Support

For questions about this plan:
- Review research files in `/mnt/d/www/docobo/`
- Check Discord.js documentation: https://discord.js.org
- Check Prisma documentation: https://prisma.io/docs
- Check Polar.sh API docs: https://polar.sh/docs
- Check SePay.vn API docs: https://docs.sepay.vn

---

**Plan Status**: READY FOR IMPLEMENTATION
**Last Updated**: 2025-11-13 17:55
**Estimated Completion**: 23-31 developer hours
