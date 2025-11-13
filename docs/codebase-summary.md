# Docobo Codebase Summary

**Generated**: 2025-11-13
**Source**: repomix-output.xml
**Total Files**: 325 files
**Total Tokens**: 909,720 tokens
**Total Characters**: 3,345,765 chars

---

## Project Structure

```
docobo/
├── src/                      # Application source code
│   ├── config/               # Configuration and environment
│   ├── services/             # Business logic services
│   ├── index.ts              # Discord bot entry point
│   └── webhook-server.ts     # Fastify webhook server
├── prisma/                   # Database schema and migrations
│   ├── schema.prisma         # Database models
│   └── migrations/           # Migration history
├── docs/                     # Project documentation
│   ├── README.md             # Main documentation
│   ├── project-overview-pdr.md  # Product requirements
│   ├── code-standards.md     # Coding conventions
│   ├── system-architecture.md   # Architecture docs
│   ├── design-guidelines.md  # UX/UI design system
│   └── wireframes/           # Interactive HTML prototypes
├── plans/                    # Implementation plans
│   └── 20251113-1746-docobo-mvp-implementation/
│       ├── plan.md
│       ├── phase-01-setup.md
│       ├── phase-02-database.md
│       ├── phase-03-bot-core.md
│       ├── phase-04-payment-webhooks.md
│       ├── phase-05-onboarding.md
│       ├── phase-06-testing.md
│       └── SUMMARY.md
├── docker/                   # Docker configuration
│   ├── Dockerfile.bot
│   └── Dockerfile.webhooks
├── .claude/                  # Claude AI agent configuration
│   ├── agents/               # Agent definitions
│   ├── commands/             # Slash commands
│   └── skills/               # Agent skills
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json            # ESLint rules
├── .prettierrc               # Prettier config
├── docker-compose.yml        # Docker services
└── .env.example              # Environment template
```

---

## Core Source Files

### Entry Points

#### `src/index.ts` (45 lines)
**Purpose**: Discord bot initialization and connection
**Key Features**:
- Discord.js client initialization with required intents
- Database connection testing
- Auto-guild registration on join
- Event handlers: `ClientReady`, `GuildCreate`

**Intents Used**:
- `Guilds`: Server information
- `GuildMembers`: Member role management

**Database Integration**:
- Prisma client connection test on ready
- Auto-upsert guild on join
- Graceful shutdown handling

---

#### `src/webhook-server.ts` (69 lines)
**Purpose**: Fastify HTTP server for payment webhooks
**Key Features**:
- Security middleware (Helmet, CORS, Rate Limiting)
- Health check endpoint (`/health`)
- Webhook endpoints: `/webhooks/polar`, `/webhooks/sepay`
- Structured logging (Pino)

**Middleware Stack**:
1. Helmet: Security headers
2. CORS: Disabled (webhooks don't need CORS)
3. Rate Limit: 100 req/min

**Endpoints**:
- `GET /health`: Database connectivity check
- `POST /webhooks/polar`: Polar.sh webhooks (placeholder)
- `POST /webhooks/sepay`: SePay.vn webhooks (placeholder)

---

### Configuration

#### `src/config/env.ts` (35 lines)
**Purpose**: Environment variable validation using Zod
**Validated Variables**:
- `DISCORD_BOT_TOKEN`: Required, string
- `DISCORD_CLIENT_ID`: Required, string
- `DISCORD_GUILD_ID`: Optional, for testing
- `DATABASE_URL`: Required, must be valid URL
- `POLAR_WEBHOOK_SECRET`: Required
- `POLAR_ACCESS_TOKEN`: Required
- `SEPAY_CLIENT_ID`: Required
- `SEPAY_CLIENT_SECRET`: Required
- `SEPAY_WEBHOOK_SECRET`: Required
- `WEBHOOK_PORT`: Default 3000
- `NODE_ENV`: Enum (development, production, test)

**Validation**: Fails fast on startup with detailed error messages

---

### Services

#### `src/services/database.ts` (26 lines)
**Purpose**: Prisma client singleton with graceful shutdown
**Features**:
- Singleton pattern (prevents multiple instances)
- Environment-based logging (query logs in development)
- Graceful shutdown on SIGINT/SIGTERM
- Connection pooling via Prisma

---

## Database Schema

### Schema Overview (`prisma/schema.prisma`)

**Total Models**: 5

#### 1. Guild Model
**Purpose**: Discord server configurations
**Fields**:
- `id`: Internal UUID (cuid)
- `guildId`: Discord snowflake (unique, indexed)
- `guildName`: Server name
- `prefix`: Command prefix (default "!")
- `locale`: Language (default "en")
- `polarEnabled`: Payment provider flag
- `sepayEnabled`: Payment provider flag
- `settings`: JSONB for flexible config

**Relationships**:
- `members`: One-to-many
- `roles`: One-to-many (PaidRole)

---

#### 2. PaidRole Model
**Purpose**: Monetized roles with pricing
**Fields**:
- `id`: Internal UUID
- `guildId`: FK to Guild
- `roleId`: Discord role snowflake
- `roleName`: Role name
- `priceUsd`: Decimal(10,2) - max $99,999,999.99
- `currency`: Default "USD"
- `polarProductId`: Polar product ID (nullable)
- `sepayProductId`: SePay product ID (nullable)
- `description`: Optional description
- `isActive`: Boolean flag

**Indexes**:
- Unique: `(guildId, roleId)`
- Indexed: `guildId`, `roleId`

---

#### 3. Member Model
**Purpose**: User records per guild
**Fields**:
- `id`: Internal UUID
- `userId`: Discord user snowflake
- `guildId`: FK to Guild
- `username`: Discord username
- `discriminator`: Legacy discriminator (nullable)
- `joinedAt`: Timestamp

**Relationships**:
- `subscriptions`: One-to-many

**Indexes**:
- Unique: `(userId, guildId)` - user can be in multiple guilds
- Indexed: `userId`, `guildId`

---

#### 4. Subscription Model
**Purpose**: Payment and role status tracking
**Fields**:
- `id`: Internal UUID
- `memberId`: FK to Member
- `roleId`: FK to PaidRole
- `provider`: Enum (POLAR, SEPAY)
- `externalSubscriptionId`: Provider subscription ID (unique per provider)
- `externalCustomerId`: Provider customer ID (nullable)
- `status`: Enum (PENDING, ACTIVE, PAST_DUE, CANCELLED, REVOKED, REFUNDED)
- `currentPeriodStart`: Billing period start (nullable)
- `currentPeriodEnd`: Billing period end (nullable)
- `cancelAtPeriodEnd`: Boolean flag
- `metadata`: JSONB for provider-specific data

**Relationships**:
- `webhookEvents`: One-to-many

**Indexes**:
- Unique: `(externalSubscriptionId, provider)` - deduplication
- Indexed: `memberId`, `status`, `provider`

---

#### 5. WebhookEvent Model
**Purpose**: Audit trail and deduplication
**Fields**:
- `id`: Internal UUID
- `externalEventId`: Provider event ID (unique) - deduplication key
- `provider`: Enum (POLAR, SEPAY)
- `eventType`: Enum (multiple types, see schema)
- `subscriptionId`: FK to Subscription (nullable)
- `rawPayload`: JSONB - full webhook payload
- `processed`: Boolean flag
- `processedAt`: Timestamp (nullable)
- `errorMessage`: Error details (nullable)
- `receivedAt`: Timestamp

**Event Types**:
- Polar: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_ACTIVE`, `SUBSCRIPTION_CANCELED`, `SUBSCRIPTION_UNCANCELED`, `SUBSCRIPTION_REVOKED`, `ORDER_CREATED`, `ORDER_UPDATED`, `ORDER_PAID`, `ORDER_REFUNDED`
- SePay: `PAYMENT_IN`, `PAYMENT_OUT`, `PAYMENT_VERIFIED`

**Indexes**:
- Unique: `externalEventId` - prevents duplicate processing
- Indexed: `provider`, `processed`, `eventType`

---

## Implementation Status

### Completed (MVP Phase 1)

**Environment Setup**:
- [x] TypeScript project configuration
- [x] ESLint + Prettier + Husky setup
- [x] Docker Compose (bot + webhooks + postgres)
- [x] Environment validation (Zod)

**Database**:
- [x] Prisma schema (5 models)
- [x] Initial migration (`20251113110148_init`)
- [x] Database service with singleton pattern
- [x] Indexes on foreign keys and status fields

**Bot Core**:
- [x] Discord.js client initialization
- [x] Gateway connection with intents
- [x] Auto-guild registration
- [x] Database connection test

**Webhook Server**:
- [x] Fastify server setup
- [x] Security middleware (Helmet, CORS, Rate Limit)
- [x] Health check endpoint
- [x] Webhook endpoint placeholders

---

### Pending (MVP Phase 2-6)

**Bot Features** (Phase 3):
- [ ] Slash command registration
- [ ] `/setup` command (admin onboarding)
- [ ] `/join` command (member payment flow)
- [ ] `/help` command
- [ ] Event handlers (interactions, errors)
- [ ] Role management utilities

**Payment Webhooks** (Phase 4):
- [ ] Polar webhook signature verification
- [ ] SePay webhook OAuth2 verification
- [ ] Event deduplication logic
- [ ] Subscription status updates
- [ ] Role grant/revoke automation
- [ ] Error handling and retry logic

**Onboarding UX** (Phase 5):
- [ ] Progressive disclosure flow (3 steps)
- [ ] Interactive components (select menus, modals, buttons)
- [ ] Setup state persistence
- [ ] Embed builders with design system
- [ ] Permission checks

**Testing** (Phase 6):
- [ ] Unit tests (services, utilities)
- [ ] Integration tests (webhook endpoints)
- [ ] E2E tests (payment → role grant)
- [ ] Jest configuration
- [ ] GitHub Actions CI pipeline
- [ ] >80% code coverage

---

## Dependencies

### Core Dependencies

**Discord Integration**:
- `discord.js@14.24.2`: Discord API wrapper
- `@discordjs/rest`: REST API client
- `@discordjs/builders`: Command/embed builders

**HTTP Server**:
- `fastify@4.29.1`: Fast web framework
- `@fastify/helmet@11.1.1`: Security headers
- `@fastify/cors@8.5.0`: CORS middleware
- `@fastify/rate-limit@9.1.0`: Rate limiting

**Database**:
- `@prisma/client@5.22.0`: Prisma ORM client
- `prisma@5.22.0`: Prisma CLI (dev)

**Payment Providers**:
- `@polar-sh/sdk@0.9.0`: Polar.sh integration

**Validation**:
- `zod@3.25.76`: Schema validation

**Utilities**:
- `dotenv@16.6.1`: Environment variables

---

### Development Dependencies

**TypeScript**:
- `typescript@5.9.3`: TypeScript compiler
- `@types/node@20.19.25`: Node.js types
- `tsx@4.20.6`: TypeScript execution

**Testing**:
- `jest@29.7.0`: Test framework
- `ts-jest@29.4.5`: TypeScript Jest integration
- `@types/jest@29.5.14`: Jest types
- `supertest@6.3.4`: HTTP testing
- `@types/supertest@6.0.3`: Supertest types

**Linting & Formatting**:
- `eslint@8.57.1`: JavaScript linter
- `@typescript-eslint/eslint-plugin@6.21.0`: TypeScript linting
- `@typescript-eslint/parser@6.21.0`: TypeScript parser
- `prettier@3.6.2`: Code formatter
- `eslint-config-prettier@9.1.2`: Prettier integration

**Git Hooks**:
- `husky@8.0.3`: Git hooks
- `lint-staged@15.5.2`: Run linters on staged files

---

## Configuration Files

### TypeScript Configuration (`tsconfig.json`)

**Compiler Options**:
- `target`: ES2022 (modern JavaScript)
- `module`: ESNext (ES modules)
- `strict`: true (strict type checking)
- `outDir`: ./dist (compiled output)
- `esModuleInterop`: true (CommonJS compatibility)
- `paths`: `@/*` → `./src/*` (path aliases)

**Includes**: `src/**/*`
**Excludes**: `node_modules`, `dist`, `tests`

---

### ESLint Configuration (`.eslintrc.json`)

**Parser**: `@typescript-eslint/parser`
**Extends**:
- `eslint:recommended`
- `plugin:@typescript-eslint/recommended`
- `plugin:@typescript-eslint/recommended-requiring-type-checking`
- `prettier` (disable conflicting rules)

**Rules**:
- `no-explicit-any`: error (no `any` type)
- `explicit-function-return-type`: warn (document return types)
- `no-unused-vars`: error (with underscore prefix exception)
- `no-console`: warn (allow warn/error)

---

### Prettier Configuration (`.prettierrc`)

**Settings**:
- `semi`: true (semicolons)
- `singleQuote`: true (single quotes)
- `trailingComma`: es5 (trailing commas)
- `printWidth`: 100 (line width)
- `tabWidth`: 2 (indentation)
- `arrowParens`: always (arrow function parentheses)

---

## Docker Configuration

### Docker Compose Services

**Services**:
1. **postgres**: PostgreSQL 14 database
   - Port: 5432
   - Volume: `postgres-data`
   - Credentials: postgres/postgresql

2. **bot**: Discord bot (future)
   - Depends on: postgres
   - Env file: `.env`

3. **webhooks**: Webhook server (future)
   - Port: 3000
   - Depends on: postgres
   - Env file: `.env`

---

## Documentation Files

### Core Documentation

**README.md** (579 lines):
- Quick start guide
- Environment setup instructions
- Development workflow
- Deployment guide
- Troubleshooting
- Security best practices

**project-overview-pdr.md**:
- Product vision and goals
- Target users
- MVP scope and features
- Technical architecture
- User journeys
- Success metrics
- Risk assessment

**code-standards.md**:
- TypeScript conventions
- File organization
- Error handling patterns
- Database query patterns
- Testing requirements
- Git commit conventions
- Security best practices

**system-architecture.md**:
- System component breakdown
- Data flow diagrams
- Security architecture
- Deployment architecture
- Monitoring strategy
- Performance benchmarks

**design-guidelines.md** (1,547 lines):
- Brand identity and colors
- Discord embed patterns
- Interactive components
- Typography system
- Icons and visual assets
- Messaging tone
- Accessibility standards
- Responsive design

---

## Development Plans

### Implementation Plan (`plans/20251113-1746-docobo-mvp-implementation/`)

**Total Phases**: 6
**Estimated Time**: 23-31 hours

**Phase 01**: Environment Setup (2-3 hrs)
- TypeScript project, dependencies, Docker, linting

**Phase 02**: Database Schema (3-4 hrs)
- Prisma models, migrations, indexes

**Phase 03**: Bot Core (4-6 hrs)
- Discord gateway, slash commands, event handlers

**Phase 04**: Payment Webhooks (6-8 hrs)
- Webhook endpoints, signature verification, deduplication

**Phase 05**: Onboarding Flow (4-5 hrs)
- Progressive disclosure UX, interactive components

**Phase 06**: Testing & QA (4-5 hrs)
- Unit tests, integration tests, E2E tests, CI/CD

---

## File Statistics

**Top Files by Size**:
1. `docs/design-guidelines.md`: 42KB (1,547 lines)
2. `prisma/schema.prisma`: 5.4KB (211 lines)
3. `docs/README.md`: 14KB (579 lines)
4. `package.json`: 1.5KB (60 lines)

**Code Distribution**:
- Source code: 4 files (177 lines TypeScript)
- Database: 1 schema + 1 migration
- Documentation: 5 files (>3000 lines)
- Configuration: 8 files (ESLint, Prettier, TypeScript, Docker)

---

## Code Metrics

### TypeScript Files

**Total Lines**: ~177 lines
**Average File Size**: 44 lines
**Longest File**: `webhook-server.ts` (69 lines)

**Type Safety**:
- Strict mode: Enabled
- No `any` types: Enforced
- Return type annotations: Required

---

### Database Schema

**Total Models**: 5
**Total Fields**: ~50 fields
**Indexes**: 15 indexes
**Relationships**: 6 foreign keys

---

## Claude AI Integration

### Agent Configuration (`.claude/`)

**Agents** (16 agents):
- `brainstormer.md`: Feature ideation
- `code-reviewer.md`: Code review
- `copywriter.md`: Content writing
- `database-admin.md`: Database management
- `debugger.md`: Bug fixing
- `docs-manager.md`: Documentation (current agent)
- `git-manager.md`: Git operations
- `planner.md`: Implementation planning
- `project-manager.md`: Project coordination
- `researcher.md`: Technical research
- `scout.md`: Codebase exploration
- `tester.md`: Test automation
- `ui-ux-designer.md`: Design systems

**Commands** (40+ slash commands):
- `/ask`: Technical questions
- `/bootstrap`: New project setup
- `/cook`: Feature implementation
- `/debug`: Issue debugging
- `/fix`: Bug fixes
- `/plan`: Implementation planning
- `/test`: Test execution
- `/docs:init`: Documentation generation (used for this summary)

**Skills** (20+ skills):
- `backend-development`: Backend patterns
- `databases`: MongoDB, PostgreSQL
- `debugging`: Systematic debugging
- `devops`: Docker, Cloudflare deployment
- `ui-styling`: shadcn/ui, Tailwind CSS
- `web-frameworks`: Next.js, Remix

---

## Security Considerations

### Sensitive Files (Excluded from Repomix)

**6 files flagged**:
1. `.env.example` (example credentials)
2. `docker-compose.yml` (contains default passwords)
3. Implementation plan files (contain setup instructions)

**Note**: These files contain example/default credentials and setup instructions. Production credentials must be stored securely and never committed.

---

### Binary Files (Excluded)

**4 files**:
- `.claude/skills/*/tests/.coverage` (test coverage data)

---

## Next Steps

### Immediate (Current Sprint)

1. **Implement Bot Commands** (Phase 3):
   - Create command loader
   - Implement `/setup` command
   - Implement `/join` command
   - Add permission checks

2. **Implement Webhook Handlers** (Phase 4):
   - Add Polar signature verification
   - Add SePay OAuth2 verification
   - Implement deduplication
   - Add role management logic

3. **Add Testing** (Phase 6):
   - Set up Jest
   - Write unit tests for services
   - Add integration tests for webhooks
   - Achieve 80% coverage

---

### Future Enhancements (v2.0+)

- Gamification system (DPoints, leaderboards)
- Web admin dashboard (Next.js)
- Multi-currency support
- Subscription tier management
- Advanced analytics
- Message queue (RabbitMQ)
- Caching layer (Redis)

---

## References

**External Documentation**:
- [Discord.js Guide](https://discordjs.guide)
- [Prisma Documentation](https://prisma.io/docs)
- [Fastify Documentation](https://fastify.dev)
- [Polar.sh API Docs](https://polar.sh/docs)
- [SePay.vn API Docs](https://docs.sepay.vn)

**Research Documents**:
- `discord-bot-research.md`: Discord bot best practices
- `discord-bot-ux-research.md`: UX patterns and guidelines
- `polar-sepay-payment-integration-research.md`: Payment integration

---

**Generated by**: Docs Manager Agent
**Repomix Version**: 1.8.0
**Last Updated**: 2025-11-13
