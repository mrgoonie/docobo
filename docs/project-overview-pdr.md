# Docobo - Product Development Requirements (PDR)

**Version**: 1.0
**Created**: 2025-11-13
**Status**: MVP Development
**Product Type**: Discord Bot SaaS

---

## Product Vision

### Mission Statement
Docobo automates paid community management on Discord. Server owners monetize roles via seamless payment integration. Members gain instant role-based access upon payment verification.

### Problem Statement
Discord lacks native role-gated payment systems. Current solutions:
- Manual role assignment (time-consuming, error-prone)
- External paywalls disconnected from Discord
- Third-party bots requiring complex setup
- No unified payment provider support

**Pain Points**:
- Server owners spend hours managing payments manually
- Members wait for role assignment (poor UX)
- Payment disputes due to manual errors
- Limited payment method support

### Solution
Automated Discord bot with:
- One-command server setup (<3 minutes)
- Instant role grant via payment webhooks (<5 seconds)
- Dual payment provider support (Polar.sh, SePay.vn)
- Zero ongoing management overhead

---

## Target Users

### Primary User: Discord Server Owners
**Demographics**:
- Age: 25-45
- Tech-savvy (comfortable with Discord admin)
- Manages paid communities (courses, memberships, premium content)
- Revenue: $500-$50K/month

**Motivations**:
- Automate repetitive tasks
- Reduce payment management overhead
- Improve member experience
- Scale community without scaling admin work

**Behaviors**:
- Checks admin dashboard 2-3x per week
- Responds to payment issues within 24 hours
- Experiments with pricing strategies
- Values reliability and security

### Secondary User: Community Members
**Demographics**:
- Age: 18-35
- Comfortable with online payments
- Values instant access
- Expects mobile-friendly UX

**Motivations**:
- Immediate access to paid content
- Clear pricing and benefits
- Secure payment methods
- Transparent processes

**Behaviors**:
- Completes purchase in <2 minutes or abandons
- Uses mobile 60% of the time
- Contacts support if payment fails
- Expects automated refunds

---

## MVP Scope (v1.0)

### Core Features (MUST HAVE)

#### 1. Server Onboarding Flow
**User Story**: As a server owner, I want to configure paid roles quickly so I can start earning revenue immediately.

**Acceptance Criteria**:
- [ ] Setup completes in <3 minutes (90th percentile)
- [ ] Maximum 3 steps with clear progress indicators
- [ ] Role selection from existing server roles
- [ ] Per-role pricing configuration (USD, 2 decimal precision)
- [ ] Payment provider selection (Polar, SePay, or both)
- [ ] API credential validation before completion
- [ ] Setup resumable (saves progress if interrupted)
- [ ] Mobile-responsive (375px width minimum)

**Technical Requirements**:
- Slash command: `/setup`
- Interactive components: Select menus, modals, buttons
- Database persistence: Guild config, paid roles
- Permission check: `ManageGuild` required

**Success Metrics**:
- Setup completion rate: >80%
- Average completion time: <3 minutes
- Error rate: <10%
- Mobile completion rate: >70%

---

#### 2. Member Payment Flow
**User Story**: As a member, I want to purchase roles securely and receive instant access.

**Acceptance Criteria**:
- [ ] View all available paid roles with pricing
- [ ] Select role and payment method
- [ ] Redirect to payment provider checkout
- [ ] Return to Discord after payment
- [ ] Receive role within 5 seconds of payment
- [ ] Transaction ID provided for reference
- [ ] Clear error messages if payment fails
- [ ] 30-day refund policy displayed

**Technical Requirements**:
- Slash command: `/join` or `/purchase`
- Embed display: Role cards with pricing
- Payment integration: Polar/SePay checkout URLs
- Role assignment: Discord API role grant
- Database updates: Member, subscription records

**Success Metrics**:
- Purchase completion rate: >75%
- Average purchase time: <2 minutes
- Payment error rate: <5%
- Member satisfaction (NPS): >60

---

#### 3. Payment Webhook Processing
**User Story**: As the system, I must process payment events reliably and grant roles automatically.

**Acceptance Criteria**:
- [ ] Webhook endpoint responds <500ms (ACK)
- [ ] HMAC signature verification (Polar)
- [ ] OAuth2 token verification (SePay)
- [ ] Event deduplication (unique constraint)
- [ ] Role granted within 5 seconds of webhook
- [ ] Database transaction consistency
- [ ] Error logging and admin notification
- [ ] Retry logic for transient failures

**Technical Requirements**:
- Fastify server on port 3000
- Endpoints: `/webhooks/polar`, `/webhooks/sepay`
- Security: Signature verification, rate limiting
- Database: Webhook event logging
- Background processing: Async role updates

**Success Metrics**:
- Webhook ACK latency: <500ms (99th percentile)
- Role grant latency: <5s (99th percentile)
- Deduplication success rate: 100%
- Zero duplicate role grants

---

#### 4. Role Management
**User Story**: As the bot, I must manage Discord roles accurately and safely.

**Acceptance Criteria**:
- [ ] Grant role on subscription active
- [ ] Revoke role on subscription cancel/refund
- [ ] Check bot role hierarchy before operations
- [ ] Handle permission errors gracefully
- [ ] Audit log all role changes
- [ ] Support multiple roles per member
- [ ] Prevent duplicate role assignments

**Technical Requirements**:
- Discord.js role management API
- Permission checks: `ManageRoles`, role hierarchy
- Database updates: Subscription status tracking
- Error handling: Ephemeral user messages

**Success Metrics**:
- Role operation success rate: >99%
- Permission error rate: <1%
- Audit log completeness: 100%

---

#### 5. Error Handling
**User Story**: As a user, I want clear guidance when errors occur.

**Acceptance Criteria**:
- [ ] Plain language error messages (no jargon)
- [ ] 4-part structure: what, why, how, help
- [ ] Actionable next steps provided
- [ ] Ephemeral messages for privacy
- [ ] Admin notifications for critical errors
- [ ] Retry options for transient failures

**Technical Requirements**:
- Error classification: User vs system errors
- Logging: Structured logs with context
- Monitoring: Error rate alerts
- User messages: Discord embeds

**Success Metrics**:
- User error resolution rate: >70% (without support)
- Average resolution time: <5 minutes
- Support ticket reduction: 50% vs manual system

---

### Future Features (NOT in MVP)

#### Gamification System (v2.0)
- DPoints earning mechanism
- Leaderboard rankings (monthly, all-time)
- Achievement badges
- Social sharing

**Rationale**: Adds complexity without validating core payment flow. Defer until MVP proven.

#### Advanced Analytics Dashboard (v2.0)
- Revenue charts
- Conversion funnels
- Member churn analysis
- Payment method breakdown

**Rationale**: Server owners need basic payment verification first. Analytics add value later.

#### Multi-Currency Support (v2.0)
- EUR, GBP, VND pricing
- Automatic currency conversion
- Region-based pricing

**Rationale**: MVP targets English-speaking markets (USD). Add later with demand.

#### Subscription Tiers (v2.0)
- Monthly/yearly billing cycles
- Tier upgrades/downgrades
- Prorated billing
- Trial periods

**Rationale**: One-time payments simpler for MVP. Recurring subscriptions add complexity.

#### Web Admin Dashboard (v2.0)
- Browser-based configuration
- Real-time transaction feed
- Manual refund processing
- Detailed reports

**Rationale**: Discord-based admin sufficient for MVP. Web dashboard requires separate infrastructure.

---

## Technical Architecture

### System Components

#### 1. Discord Bot
**Technology**: Discord.js v14, TypeScript
**Responsibilities**:
- Slash command registration and handling
- Event processing (guild joins, interactions)
- Role assignment via Discord API
- Embed message rendering

**Key Libraries**:
- `discord.js@14.24.2`: Discord API wrapper
- `@discordjs/rest`: API request handling
- `@discordjs/builders`: Command/embed builders

**Performance Targets**:
- Command response: <3s (Discord timeout)
- Event processing: <1s
- Role grant: <5s (including Discord API latency)

---

#### 2. Webhook Server
**Technology**: Fastify v4, TypeScript
**Responsibilities**:
- Receive payment provider webhooks
- Verify signatures/tokens
- Deduplicate events
- Trigger role management

**Key Libraries**:
- `fastify@4.29.1`: HTTP server
- `@fastify/helmet`: Security headers
- `@fastify/rate-limit`: DDoS protection
- `@fastify/cors`: CORS handling

**Performance Targets**:
- Webhook ACK: <500ms
- Request throughput: 100 req/min
- Error rate: <1%

---

#### 3. Database
**Technology**: PostgreSQL 14+, Prisma ORM
**Responsibilities**:
- Persistent data storage
- Transaction management
- Query optimization

**Schema**:
- `guilds`: Discord server configurations
- `members`: User records per guild
- `paid_roles`: Role pricing and provider IDs
- `subscriptions`: Payment and role status
- `webhook_events`: Audit trail and deduplication

**Performance Targets**:
- Query latency: <50ms (with indexes)
- Connection pool: 10 connections
- Backup frequency: Daily

---

#### 4. Payment Integrations

**Polar.sh**:
- HMAC signature verification (`@polar-sh/sdk`)
- Events: `subscription.created`, `subscription.active`, `subscription.canceled`, `subscription.revoked`
- Webhook URL: `https://domain.com/webhooks/polar`

**SePay.vn**:
- OAuth2 Bearer token verification
- Event: `payment.verified`
- Webhook URL: `https://domain.com/webhooks/sepay`
- Client-side deduplication (transaction ID)

---

### Data Flow

#### Payment Success Flow
```
1. Member initiates payment
   ↓
2. Payment provider processes transaction
   ↓
3. Provider sends webhook to Docobo
   ↓
4. Webhook server verifies signature
   ↓
5. Check database for duplicate event (unique constraint)
   ↓ (if not duplicate)
6. Create/update subscription record (status: ACTIVE)
   ↓
7. Trigger role manager service
   ↓
8. Discord API: Assign role to member
   ↓
9. Send confirmation message to member
   ↓
10. Log webhook event (processed: true)
```

**Failure Handling**:
- Signature verification fails → 403 Forbidden, log security event
- Duplicate event → 200 OK (idempotent), skip processing
- Database error → 500 Internal Error, log, retry webhook
- Discord API error → Log, notify admin, mark subscription PENDING

---

#### Payment Cancellation Flow
```
1. Member cancels subscription (payment provider portal)
   ↓
2. Provider sends `subscription.canceled` webhook
   ↓
3. Webhook server verifies and deduplicates
   ↓
4. Update subscription record (status: CANCELLED)
   ↓
5. Trigger role manager service
   ↓
6. Discord API: Remove role from member
   ↓
7. Send notification to member
   ↓
8. Log webhook event
```

---

### Security Architecture

#### Authentication & Authorization
- **Discord Bot Token**: OAuth2 bearer token (never exposed)
- **Payment Webhooks**: HMAC signatures (Polar) + OAuth2 (SePay)
- **Database**: Connection pooling with SSL in production
- **Admin Commands**: Permission check (`ManageGuild`)

#### Data Protection
- **Environment Variables**: Validated on startup (Zod), never logged
- **Webhook Secrets**: Rotated quarterly, stored in secrets manager
- **Database**: No plaintext sensitive data, encrypted at rest
- **Logging**: Structured logs, PII excluded

#### Rate Limiting
- Webhook endpoints: 100 req/min per IP
- Discord API: Respect rate limits (50 req/s global)
- Database queries: Connection pooling prevents exhaustion

#### Audit Trail
- All role grants/revokes logged with timestamp, user, reason
- Webhook events stored permanently (compliance, debugging)
- Admin actions logged separately (separate table)

---

## User Journeys

### Journey 1: Server Owner Setup

**Actors**: Discord Server Owner, Docobo Bot
**Duration**: 3 minutes
**Frequency**: Once per server

**Steps**:
1. Owner invites bot to server (OAuth2 URL with permissions)
2. Bot auto-registers guild in database
3. Owner runs `/setup` command
4. **Step 1/3**: Select roles to monetize (multi-select menu)
5. **Step 2/3**: Set pricing per role (modal input, validation)
6. **Step 3/3**: Configure payment providers (button selection)
   - If Polar: Enter webhook secret (modal)
   - If SePay: Enter client credentials (modal)
7. Bot validates credentials (test API call)
8. Success embed displayed with summary
9. Bot sends "Setup complete" DM to owner

**Pain Points Addressed**:
- Complex setup reduced to 3 steps
- Credential validation prevents errors later
- Progress saved (resume if interrupted)

**Success Criteria**:
- Completion rate >80%
- Average time <3 minutes
- Error rate <10%

---

### Journey 2: Member Purchase

**Actors**: Community Member, Docobo Bot, Payment Provider
**Duration**: 2 minutes
**Frequency**: Once per role per member

**Steps**:
1. Member sees announcement about paid roles
2. Member runs `/join` command
3. Bot displays pricing cards (embed with buttons)
4. Member selects desired role
5. Bot displays payment method selection (Polar/SePay buttons)
6. Member clicks payment button
7. Bot generates checkout URL, sends ephemeral message
8. Member redirected to payment provider
9. Member completes payment (external)
10. Provider sends webhook to Docobo
11. Bot grants role within 5 seconds
12. Member receives confirmation message (transaction ID)
13. Member can access role-gated channels immediately

**Pain Points Addressed**:
- Instant access (no waiting for manual approval)
- Secure payment (industry-standard providers)
- Transparent pricing (no hidden fees)
- Mobile-friendly (Discord native UX)

**Success Criteria**:
- Purchase completion >75%
- Average time <2 minutes
- Payment error rate <5%

---

### Journey 3: Subscription Cancellation

**Actors**: Member, Payment Provider, Docobo Bot
**Duration**: 30 seconds (after external cancellation)
**Frequency**: Variable (churn-dependent)

**Steps**:
1. Member cancels subscription (payment provider portal)
2. Provider sends `subscription.canceled` webhook
3. Bot receives webhook, verifies signature
4. Bot updates subscription status (CANCELLED)
5. Bot schedules role revocation (end of billing period OR immediate)
6. Bot sends notification to member (ephemeral)
   - "Your subscription was canceled"
   - "Access until: [date]" OR "Access revoked"
   - "Resubscribe anytime: `/join`"
7. At revocation time, bot removes role
8. Member loses access to role-gated channels

**Pain Points Addressed**:
- Automated process (no manual intervention)
- Clear communication (when access ends)
- Easy resubscription (same command)

**Success Criteria**:
- Revocation accuracy: 100%
- Notification delivery: 100%
- Resubscribe rate: >20%

---

## Non-Functional Requirements

### Performance
- Webhook ACK response: <500ms (p99)
- Role grant latency: <5s (p99)
- Database query: <50ms (p95)
- Slash command response: <3s (Discord timeout)
- Concurrent webhooks: 100 req/min

### Reliability
- Uptime: 99.5% (monthly)
- Zero duplicate role grants
- Webhook deduplication: 100%
- Database backups: Daily (7-day retention)
- Disaster recovery: <4 hours

### Scalability
- Support 1,000 concurrent guilds
- Process 10,000 webhooks/day
- Database: 100K subscriptions (with indexes)
- Discord API rate limit compliance

### Security
- HMAC signature verification: 100%
- OAuth2 token validation: 100%
- Environment secrets validation: Startup check
- Audit logging: 100% coverage
- Credential rotation: Quarterly

### Usability
- Setup completion rate: >80%
- Purchase completion rate: >75%
- Mobile usability: >70% completion on mobile
- Error self-resolution: >70% without support
- Admin NPS: >60

### Maintainability
- Test coverage: >80%
- TypeScript strict mode: Enabled
- Linting: ESLint + Prettier
- Documentation: All public APIs
- Code review: Required for all PRs

---

## Success Metrics (KPIs)

### Product Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Setup completion rate | >80% | Analytics: `/setup` start → completion |
| Setup duration | <3 min | Analytics: Time between start → success |
| Purchase completion | >75% | Analytics: `/join` click → role granted |
| Purchase duration | <2 min | Analytics: Time between click → role grant |
| Payment error rate | <5% | Logs: Failed webhook events / total |
| Role grant latency | <5s (p99) | Logs: Webhook received → role granted |

### Technical Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Webhook ACK latency | <500ms (p99) | Logs: Request received → 200 response |
| Database query latency | <50ms (p95) | Prisma logs |
| Bot uptime | >99.5% | Monitoring: Uptime checks |
| Test coverage | >80% | Jest coverage report |
| TypeScript errors | 0 | Build: `npm run build` |

### Business Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Active guilds | 100 (6 months) | Database: Active guilds count |
| Total subscriptions | 1,000 (6 months) | Database: Active subscriptions |
| Monthly recurring revenue | $10K (6 months) | Analytics: Sum of subscriptions |
| Churn rate | <10% | Analytics: Cancellations / active subs |
| Admin NPS | >60 | Survey: Server owner satisfaction |
| Member NPS | >50 | Survey: Member satisfaction |

---

## Risk Assessment

### Technical Risks

#### Risk 1: Webhook Replay Attacks
**Severity**: CRITICAL
**Likelihood**: Medium
**Impact**: Duplicate role grants, financial loss
**Mitigation**: Unique constraint on `webhook_events.externalEventId`, return 200 for duplicates
**Contingency**: Audit database for duplicates, manual role revocation

#### Risk 2: Missing Signature Verification
**Severity**: CRITICAL
**Likelihood**: Low (caught in testing)
**Impact**: Unauthorized role grants, security breach
**Mitigation**: Test coverage for signature verification, fail-fast validation
**Contingency**: Rotate webhook secrets, audit all recent grants

#### Risk 3: Discord API Rate Limiting
**Severity**: HIGH
**Likelihood**: Medium (during high traffic)
**Impact**: Delayed role grants, poor UX
**Mitigation**: Respect rate limits, implement backoff, queue requests
**Contingency**: Notify affected users, retry failed grants

#### Risk 4: Database Connection Exhaustion
**Severity**: HIGH
**Likelihood**: Low (with connection pooling)
**Impact**: Service downtime, failed webhooks
**Mitigation**: Prisma connection pooling (10 connections), monitoring
**Contingency**: Horizontal scaling, increase pool size

#### Risk 5: 3-Second Interaction Timeout
**Severity**: MEDIUM
**Likelihood**: Medium (complex operations)
**Impact**: Failed commands, poor UX
**Mitigation**: Defer all non-trivial operations, use `interaction.deferReply()`
**Contingency**: Optimize slow operations, async processing

---

### Business Risks

#### Risk 6: Low Adoption Rate
**Severity**: HIGH
**Likelihood**: Medium
**Impact**: Failed product launch
**Mitigation**: Beta testing with 10-20 servers, iterate based on feedback
**Contingency**: Pivot to niche (e.g., course creators only)

#### Risk 7: Payment Provider Downtime
**Severity**: HIGH
**Likelihood**: Low
**Impact**: Members cannot purchase, revenue loss
**Mitigation**: Support 2 providers (Polar + SePay), monitor provider status
**Contingency**: Communicate downtime, offer alternative payment method

#### Risk 8: Discord API Breaking Changes
**Severity**: MEDIUM
**Likelihood**: Low (Discord provides migration periods)
**Impact**: Bot functionality broken
**Mitigation**: Monitor Discord changelog, update dependencies promptly
**Contingency**: Hotfix deployment, fallback to previous version

---

## Compliance & Legal

### Data Privacy (GDPR, CCPA)
- **Data Collected**: Discord user IDs, usernames, guild IDs, payment metadata (no credit cards)
- **Data Storage**: PostgreSQL (encrypted at rest), 7-day log retention
- **Data Deletion**: User can request deletion via support email
- **Third-Party Sharing**: Payment provider webhooks only (necessary for service)

### Payment Compliance (PCI-DSS)
- **No Card Data**: Docobo never handles credit card information
- **Payment Providers**: PCI-compliant (Polar.sh, SePay.vn)
- **Webhooks**: HTTPS only, signature verification

### Terms of Service
- 30-day refund policy
- No guarantees of uptime (best effort)
- Server owner responsible for legal use
- Prohibition of illegal content/communities

---

## Development Roadmap

### Phase 1: MVP (v0.1.0) - 4 weeks
**Goal**: Validate core payment flow
- [x] Environment setup (Week 1)
- [x] Database schema + migrations (Week 1)
- [x] Discord bot core + slash commands (Week 2)
- [x] Payment webhook handlers (Week 2-3)
- [x] Role management service (Week 3)
- [x] Progressive onboarding UX (Week 3)
- [x] Testing + CI/CD (Week 4)
- [x] Documentation (Week 4)

### Phase 2: Beta (v0.2.0) - 2 weeks
**Goal**: Test with real users
- [ ] Invite 10-20 beta servers
- [ ] Monitor error logs, webhook delivery
- [ ] Gather user feedback (surveys)
- [ ] Iterate on UX pain points
- [ ] Fix critical bugs

### Phase 3: Launch (v1.0.0) - 1 week
**Goal**: Public release
- [ ] Publish bot to Discord bot list
- [ ] Launch marketing campaign
- [ ] Monitor metrics (KPIs)
- [ ] 24/7 support monitoring
- [ ] Performance optimization

### Phase 4: Gamification (v2.0.0) - 6 weeks
**Goal**: Add leaderboard features
- [ ] DPoints system
- [ ] Leaderboard display (monthly, all-time)
- [ ] Achievement badges
- [ ] Social sharing
- [ ] Analytics dashboard

---

## Appendix

### Glossary
- **Guild**: Discord server
- **Snowflake**: Discord unique ID (64-bit integer)
- **Interaction**: User action (slash command, button click)
- **Ephemeral**: Message visible only to user
- **HMAC**: Hash-based message authentication code
- **Webhook**: HTTP callback for event notification
- **Deduplication**: Preventing duplicate event processing

### References
- [Discord Developer Portal](https://discord.com/developers)
- [Discord.js Guide](https://discordjs.guide)
- [Prisma Documentation](https://prisma.io/docs)
- [Polar.sh API Docs](https://polar.sh/docs)
- [SePay.vn API Docs](https://docs.sepay.vn)

### Change Log

#### v1.0 (2025-11-13)
- Initial PDR creation
- MVP scope defined
- Technical architecture documented
- Risk assessment completed

---

**Document Owner**: Product Team
**Last Review**: 2025-11-13
**Next Review**: 2025-12-13 (monthly)
