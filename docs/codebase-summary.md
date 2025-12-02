# Docobo Codebase Summary

**Generated**: 2025-12-03
**Last Updated**: Phase 07 - Knowledge Base Management Completion
**Source**: repomix-output.xml
**Total Files**: 325+ files
**Total Tokens**: ~950,000 tokens (estimated)
**Total Characters**: ~3,500,000 chars (estimated)

---

## Project Structure

```
docobo/
├── src/                      # Application source code
│   ├── bot/                  # Discord bot implementation
│   │   ├── client.ts         # Discord.js client
│   │   ├── commands/         # Slash commands
│   │   ├── events/           # Event handlers
│   │   ├── interactions/     # Button/menu/modal handlers
│   │   └── utils/            # Role management utilities
│   ├── webhooks/             # Payment webhook handlers
│   │   ├── server.ts         # Fastify server factory
│   │   ├── routes/           # Polar & SePay endpoints
│   │   ├── services/         # Event processors
│   │   └── utils/            # Signature verification & deduplication
│   ├── config/               # Configuration and environment
│   ├── services/             # Shared business logic
│   ├── index.ts              # Discord bot entry point
│   └── webhook-server.ts     # Webhook server entry point
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

#### `src/index.ts` (43 lines)
**Purpose**: Discord bot initialization and orchestration
**Key Features**:
- Discord.js client initialization
- Event handler registration (ready, guildCreate, interactionCreate)
- Slash command registration and deployment
- Graceful shutdown (Discord gateway + database)

**Event Handlers**:
- `handleReady`: Database connectivity check, bot presence
- `handleGuildCreate`: Auto-upsert guild on join
- `handleInteractionCreate`: Dispatcher for all interaction types

**Shutdown Logic**:
- SIGINT/SIGTERM handlers
- Graceful Discord gateway disconnect
- Database connection cleanup

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
- `POST /webhooks/polar`: Polar.sh webhooks (HMAC-SHA256 signature verification)
- `POST /webhooks/sepay`: SePay.vn webhooks (API Key authentication)

---

### Configuration

#### `src/config/env.ts` (37 lines)
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
- `OPENROUTER_API_KEY`: Optional, required when using `/kb add` command

**Validation**: Fails fast on startup with detailed error messages

---

### Bot Core (Phase 03)

#### `src/bot/client.ts` (42 lines)
**Purpose**: Discord.js client and REST API configuration
**Exports**:
- `client`: Gateway-based Discord client with intents
- `rest`: REST API client for command registration
- `registerCommands()`: Deploy slash commands globally or guild-specific

**Intents Used**:
- `Guilds`: Server metadata
- `GuildMembers`: Role management capability
- `GuildMessages`: Message content access

**Command Registration**:
- Development: Guild-specific (instant, for testing)
- Production: Global (1-hour cache)

---

#### `src/bot/events/ready.ts` (28 lines)
**Purpose**: Client ready event handler
**Functionality**:
- Log successful bot connection
- Display guild count
- Test database connectivity
- Set bot presence (`/help for commands`)
- Exit on database connection failure

---

#### `src/bot/events/guildCreate.ts` (15 lines, referenced)
**Purpose**: Auto-register guild on bot join
**Functionality**:
- Upsert guild to database
- Initialize guild configuration

---

#### `src/bot/events/interactionCreate.ts` (47 lines)
**Purpose**: Central interaction dispatcher
**Interaction Types Handled**:
- Chat input commands (slash commands)
- Button clicks
- String select menus
- Modal submissions

**Error Handling**:
- Try-catch wrapping all handlers
- Graceful error responses (ephemeral)
- Logs interaction errors to console

**Features**:
- Deferred replies support
- Ephemeral error messages
- Handles replied/deferred state

---

#### `src/bot/commands/index.ts` (34 lines)
**Purpose**: Slash command registry and dispatcher
**Exports**:
- `Command` interface (data + execute)
- `commands` collection (Discord.js Collection)
- `handleSlashCommand()` dispatcher
- `commandData` (JSON export for registration)

**Command List**:
- `setup`: Admin server configuration
- `join`: Member role purchase
- `help`: Help/documentation

**Dispatcher Features**:
- Case-sensitive command lookup
- Unknown command handling
- Ephemeral error replies

---

#### `src/bot/commands/admin/setup.ts` (71 lines)
**Purpose**: Admin server setup command
**Permission**: Requires `MANAGE_GUILD`
**Functionality**:
- Guild upsert (create if new)
- Bot permission validation (`MANAGE_ROLES`)
- Display current configuration status
- Fetch existing paid roles

**Embed Output**:
- Docobo Blue color (0x4a90e2)
- Welcome message
- Setup progress (Step 1/3)
- Current status (roles, Polar, SePay)

**Note**: Interactive buttons added in Phase 05

---

#### `src/bot/commands/member/join.ts` (61 lines)
**Purpose**: Member role purchase interface
**Functionality**:
- Fetch guild configuration
- List active paid roles
- Display pricing and descriptions
- Handle non-configured servers

**Embed Output**:
- Role name, price, currency, description
- Footer: "Click a role below to purchase"
- Timestamp for context

**Note**: Select menu interaction added in Phase 05

---

#### `src/bot/commands/utils/help.ts` (referenced)
**Purpose**: Help/command documentation
**Status**: Placeholder for Phase 03

---

#### `src/bot/interactions/buttons.ts` (referenced - MODIFIED in Phase 07)
**Purpose**: Button interaction handler registry
**Pattern**:
- Handler map indexed by customId prefix
- Registration function for extensibility
- Extracted prefix from customId (e.g., `confirm_payment_123` -> `confirm_payment`)

**Error Handling**:
- Unknown button logging
- Ephemeral "no longer active" message

**Registered Handlers**:
- Setup flow: resume, restart, pricing, back, complete
- Payment: polar, sepay, both
- Role purchase: purchase_role
- Knowledge base: kb_list (pagination), kb_delete (document removal)

**Status**: Handlers populated in Phase 05 (onboarding flow) + Phase 07 (KB handlers)

---

#### `src/bot/interactions/selectMenus.ts` (referenced)
**Purpose**: Select menu interaction handler
**Pattern**: Similar registry pattern to buttons
**Status**: Handlers populated in Phase 05

---

#### `src/bot/interactions/modals.ts` (referenced)
**Purpose**: Modal submission handler
**Pattern**: Similar registry pattern to buttons/menus
**Status**: Handlers populated in Phase 05

---

#### `src/bot/utils/roles.ts` (71 lines)
**Purpose**: Role management utilities
**Functions**:

**`grantRole()`**:
- Fetch member and role
- Check existence before granting
- Add role to member
- Return success status

**`revokeRole()`**:
- Fetch member and role
- Check existence before revoking
- Remove role from member
- Return success status

**`checkBotRolePosition()`**:
- Validate role hierarchy
- Ensure bot can manage target role

**`canManageRoles()`**:
- Verify bot has ManageRoles permission
- Return capability status

**Error Handling**:
- Idempotent operations (no error if already granted/revoked)
- Logging for all operations
- Return false on failure

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

### Payment Webhooks (Phase 04)

#### `src/webhooks/server.ts` (46 lines)
**Purpose**: Fastify webhook server factory
**Key Features**:
- Helmet security headers (CSP disabled for payload flexibility)
- CORS disabled (webhooks are server-to-server)
- Rate limiting: 100 req/min per IP
- Health check with database connectivity test
- Dynamic route registration for Polar & SePay

**Server Configuration**:
- Debug logging in development, info in production
- Async initialization for plugin registration
- Graceful error handling

---

#### `src/webhooks/routes/polar.ts` (75 lines)
**Purpose**: Polar.sh webhook endpoint handler
**Authentication**: Standard Webhooks HMAC-SHA256 signature verification
**Key Features**:
- Raw body parser for signature verification
- Event deduplication check (prevents duplicate processing)
- Async processing with `setImmediate` (non-blocking)
- Immediate 202 acknowledgment (prevents timeout retries)
- Signature verification errors return 403

**Event Processing Flow**:
1. Parse request body (raw + JSON)
2. Verify HMAC signature using `webhook-id`, `webhook-timestamp`, `webhook-signature` headers
3. Check deduplication cache (externalEventId)
4. Acknowledge receipt (202 Accepted)
5. Process async via `processPolarEvent()`
6. Log errors separately (don't block acknowledgment)

**Event Types Handled**:
- `subscription.created`: Log only
- `subscription.active`: Update status to ACTIVE, grant role
- `subscription.canceled`: Mark CANCELLED, defer revoke to period end
- `subscription.uncanceled`: Update status
- `subscription.revoked`: Update status to REVOKED, revoke role
- `order.created`: Log only
- `order.updated`: Log only
- `order.paid`: Handled by subscription.active
- `order.refunded`: Update status to REFUNDED, revoke role

---

#### `src/webhooks/routes/sepay.ts` (86 lines)
**Purpose**: SePay.vn webhook endpoint handler
**Authentication**: API Key in Authorization header (Apikey or Bearer format)
**Key Features**:
- Simple API key validation (substring matching)
- Filters incoming transfers only (`transferType === 'in'`)
- Event deduplication check (transaction ID)
- Async processing with `setImmediate`
- Always returns 200 to prevent SePay retries

**Transaction Processing Flow**:
1. Verify Authorization header (Apikey or Bearer token)
2. Check deduplication (SePay transaction ID)
3. Filter outgoing transfers (only process `transferType === 'in'`)
4. Acknowledge receipt (200 OK)
5. Process async via `processSepayTransaction()`
6. Log errors separately

**SePay Transaction Structure**:
- `id`: Transaction ID (primary dedup key)
- `gateway`: Bank gateway name
- `transactionDate`: ISO timestamp
- `accountNumber`: Account receiving payment
- `transferType`: 'in' or 'out'
- `transferAmount`: Amount in VND or USD
- `referenceCode`: Custom merchant reference (DOCOBO-guildId-roleId-userId)
- `description`: Transaction notes

---

#### `src/webhooks/utils/signature.ts` (80 lines)
**Purpose**: Standard Webhooks HMAC-SHA256 signature verification
**Spec**: Implements [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) specification (Polar uses this)
**Key Features**:
- Replay attack prevention (timestamp within 5 minutes)
- Timing-safe comparison (prevents timing attacks)
- Multi-signature support (v1 version prefixing)
- Base64 secret decoding (handles `whsec_` prefix)
- Custom error class for verification failures

**Verification Process**:
1. Extract headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`
2. Validate timestamp (±5 minutes from current time)
3. Build signed content: `{id}.{timestamp}.{payload}`
4. Decode secret from base64 (strip `whsec_` prefix if present)
5. Compute HMAC-SHA256 signature
6. Compare with provided signature (timing-safe comparison)
7. Support multiple signature formats: `v1,<sig1> v1,<sig2>`

**Error Handling**:
- `WebhookVerificationError` thrown on verification failure
- Missing headers → "Missing required webhook headers"
- Old timestamp → "Webhook timestamp too old"
- Invalid signature → "Invalid webhook signature"

---

#### `src/webhooks/utils/deduplication.ts` (50 lines)
**Purpose**: Webhook event deduplication and audit trail
**Key Functions**:

**`checkDuplication(externalEventId, provider)`**:
- Query database for existing webhook event
- Returns true if event already processed
- Prevents double-processing of webhook replays

**`recordWebhookEvent(externalEventId, provider, eventType, rawPayload, subscriptionId?)`**:
- Create WebhookEvent record in database
- Store raw provider payload for audit
- Link to subscription if available
- Returns event ID for reference

**`markEventProcessed(externalEventId, errorMessage?)`**:
- Update processed flag and timestamp
- Store error message if processing failed
- Allows retry logic later

**Database Audit Benefits**:
- Complete webhook history
- Correlation with subscriptions
- Error tracking and debugging
- Replay/idempotency verification

---

#### `src/webhooks/services/polar-service.ts` (204 lines)
**Purpose**: Polar event processor and subscription lifecycle manager
**Key Functions**:

**`processPolarEvent(event)`**:
- Record webhook event to database
- Map Polar event types to internal enums
- Route to specific handlers
- Mark event as processed with success/error

**Event Handlers**:

*Subscription Events*:
- `handleSubscriptionCreated`: Log subscription creation (no action)
- `handleSubscriptionActive`: Find subscription, update to ACTIVE, grant role
- `handleSubscriptionCanceled`: Mark CANCELLED, set `cancelAtPeriodEnd` flag
- `handleSubscriptionRevoked`: Update to REVOKED, revoke role
- `handleSubscriptionUncanceled`: Update status back to ACTIVE

*Order Events*:
- `handleOrderPaid`: Log order (subscription activation via subscription.active event)
- `handleOrderRefunded`: Find subscription, update to REFUNDED, revoke role

**Role Grant/Revoke Integration**:
- Import `grantRoleForSubscription()`, `revokeRoleForSubscription()` from role-automation
- Pass subscription with full relations (member, paidRole.guild)
- Log success/failure for audit trail

**Error Handling**:
- Try-catch wrapping entire processor
- Log errors to console
- Mark event as processed with error message
- Re-throw error for monitoring

---

#### `src/webhooks/services/sepay-service.ts` (161 lines)
**Purpose**: SePay transaction processor and reference code parsing
**Key Functions**:

**`processSepayTransaction(transaction)`**:
- Record transaction to database as PAYMENT_IN event
- Parse reference code to extract subscription info
- Find paid role in database
- Verify payment amount meets minimum
- Find or create member record
- Create subscription with ACTIVE status
- Grant role to member
- Mark event as processed

**`parseReferenceCode(code)`**:
- Extract guildId, roleId, userId from reference code
- Support standard format: `DOCOBO-{guildId}-{roleId}-{userId}`
- Fallback to Discord ID extraction (17-19 digit numbers)
- Return null if parsing fails

**Payment Validation**:
- Match paid role by guildId + roleId
- Verify amount >= expected price
- Log insufficient payment errors
- Store error in webhook event for audit

**Member Lifecycle**:
- Find existing member by userId + guildId
- Create new member if not found
- Set initial username placeholder
- Update on member interaction (bot commands)

**Subscription Creation**:
- Link member to paid role
- Set provider to SEPAY
- Use transaction ID as externalSubscriptionId
- Set status to ACTIVE immediately
- Store transaction metadata (gateway, date, amount, reference code)

---

#### `src/services/role-automation.ts` (76 lines)
**Purpose**: Discord role grant/revoke automation triggered by webhooks
**Key Features**:
- Fetch guild from Discord gateway
- Validate guild existence before attempting role operations
- Error handling for guild not found scenarios
- Console logging with emoji indicators (✅ for success)

**`grantRoleForSubscription(subscription)`**:
- Extract Discord guild ID from subscription relations
- Fetch guild from Discord client
- Call `grantRole()` utility to add role
- Log success with role name and user ID
- Return boolean success status

**`revokeRoleForSubscription(subscription)`**:
- Extract Discord guild ID from subscription relations
- Fetch guild from Discord client
- Call `revokeRole()` utility to remove role
- Log success with role name and user ID
- Return boolean success status

**Error Handling**:
- Guild not found → log error, return false
- Role operation failure → return false from grantRole/revokeRole
- Catch all errors → log and return false

**Integration Points**:
- Called by `polar-service.ts` on subscription lifecycle events
- Called by `sepay-service.ts` on successful payment
- Depends on bot client being initialized and connected
- Requires bot to have ManageRoles permission in guild

---

### Knowledge Base Management (Phase 07)

#### `src/services/openrouter.ts` (179 lines)
**Purpose**: LLM-powered document generation via OpenRouter API
**Key Features**:
- Uses Google Gemini 2.5 Flash as default model
- Retry mechanism with exponential backoff (3 attempts)
- YAML frontmatter parsing from generated markdown
- API key validation
- Timeout and error handling

**`generateDocument(content, config)`**:
- Send content to OpenRouter for processing
- Extract metadata from YAML frontmatter (title, description, category, tags)
- Return structured `GeneratedDocument` with content and metadata
- Retry on failure with exponential backoff (1s, 2s, 4s)
- Log token usage for cost tracking

**`validateApiKey(apiKey)`**:
- Verify OpenRouter API key validity
- Return boolean result
- Used before attempting document generation

**Prompt Engineering**:
- Generates documents with structured frontmatter format
- Extracts categories (guide, reference, tutorial, faq, policy, general)
- Generates 3-7 semantic tags for searchability
- Removes noise (ads, navigation, scripts)
- Output: Clean markdown with metadata

---

#### `src/services/url-processor.ts` (224 lines)
**Purpose**: Safe URL fetching with llms.txt protocol support
**Security Features**:
- Blocks private/internal IP addresses (RFC 1918, IPv6 unique local)
- Blocks localhost and cloud metadata endpoints (AWS, GCP)
- URL validation (http/https only)
- Timeout protection (10 seconds fetch, 5 seconds llms.txt)
- User-Agent headers with Docobo identification

**`processUrl(url)`**:
- Validate URL safety (no internal IPs)
- Try fetching `llms.txt` first (AI-optimized content)
- Fall back to regular URL fetch if llms.txt unavailable
- Strip HTML tags and clean content
- Truncate to 10K chars for LLM context
- Return processed content with metadata

**`stripHtml(html)`**:
- Remove script and style tags
- Remove nav, header, footer, aside elements
- Decode HTML entities (nbsp, amp, lt, gt, quot)
- Clean up extra whitespace
- Return plain text

**`processText(text)`**:
- Trim and clean plain text input
- Truncate to 10K chars
- For non-URL document creation

**Safety Validations**:
- Blocks: 127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 169.254.0.0/16, IPv6 loopback/link-local
- Blocks cloud metadata: AWS (169.254.169.254), GCP (metadata.google.internal)

---

#### `src/services/knowledge-base.ts` (183 lines)
**Purpose**: CRUD operations and full-text search for knowledge documents
**Key Functions**:

**`createDocument(input)`**:
- Create new knowledge document in guild
- Accepts: guildId, title, description, content, sourceUrl, metadata
- Upsert guild if not exists
- Return created document
- Log operation with document ID

**`getDocument(id)`**:
- Fetch single document by ID
- Return document or null if not found

**`listDocuments(guildId, page)`**:
- Paginate documents for guild (10 per page)
- Order by creation date (newest first)
- Return documents array, total count, page count
- Support pagination

**`updateDocument(id, input)`**:
- Partial update of document fields
- Only update provided fields (title, description, content, metadata)
- Return updated document
- Log operation with document ID

**`deleteDocument(id)`**:
- Remove document by ID
- No soft delete - permanent removal
- Log operation with document ID

**`searchDocuments(guildId, query, limit=5)`**:
- Full-text search using PostgreSQL ts_rank
- Raw SQL query for ranking support
- Filter by guild
- Return array of KnowledgeSearchResult (id, title, description, relevance)
- Support semantic search on title and description

**Database Helpers**:
- `ensureGuild(guildId, guildName)`: Upsert guild, return internal ID
- `documentBelongsToGuild(docId, guildId)`: Permission check
- `getDocumentCount(guildId)`: Get total documents for guild

---

#### `src/bot/commands/ai/kb.ts` (referenced - NEW)
**Purpose**: `/kb` slash command for knowledge base management
**Permissions**: Requires `MANAGE_GUILD` or `MANAGE_MESSAGES`
**Subcommands**:

**`/kb add <input>`**:
- Accept URL or plain text input (max 4000 chars)
- Validate OpenRouter API key configured
- If URL: fetch content via url-processor
- If text: process as raw text
- Generate document structure via OpenRouter
- Create document in knowledge base
- Display confirmation with document ID

**`/kb list [page]`**:
- List all documents for guild
- Paginate (10 per page)
- Show title, description, creation date
- Include pagination info

**`/kb remove <id>`**:
- Delete document by ID
- Permission check (belongs to guild)
- Confirmation message

**`/kb search <query>`**:
- Full-text search across knowledge base
- Display top 5 results with relevance scores
- Show title and description

**`/kb view <id>`**:
- Display full document content
- Show title, description, metadata
- Include source URL if available

**Features**:
- Deferred replies for long-running operations (add command)
- Embed-based UI following design guidelines
- Error handling for missing API keys
- Permission checks

---

## Database Schema

### Schema Overview (`prisma/schema.prisma`)

**Total Models**: 6

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

#### 6. KnowledgeDocument Model
**Purpose**: AI-generated knowledge base documents for customer service
**Fields**:
- `id`: Internal UUID (cuid)
- `guildId`: FK to Guild (indexed)
- `title`: Document title (VarChar 255)
- `description`: SEO-optimized summary for search (Text)
- `content`: Full document markdown content (Text)
- `sourceUrl`: Original URL source if created from URL (VarChar 2048, nullable)
- `metadata`: JSONB for flexible metadata (category, tags, references, word_count)
- `createdAt`: Document creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- `guild`: One-to-many from Guild

**Indexes**:
- Indexed: `guildId`

---

## Implementation Status

### Completed (MVP Phase 1-4, 7)

**Environment Setup** (Phase 1):
- [x] TypeScript project configuration
- [x] ESLint + Prettier + Husky setup
- [x] Docker Compose (bot + webhooks + postgres)
- [x] Environment validation (Zod)

**Database** (Phase 2):
- [x] Prisma schema (5 models)
- [x] Initial migration (`20251113110148_init`)
- [x] Database service with singleton pattern
- [x] Indexes on foreign keys and status fields

**Bot Core** (Phase 3):
- [x] Discord.js client initialization (Discord.js v14)
- [x] Gateway connection with intents (Guilds, GuildMembers, GuildMessages)
- [x] REST API client for command registration
- [x] Slash command registration (guild-specific dev, global prod)
- [x] Auto-guild registration
- [x] Database connection test
- [x] Client ready event handler
- [x] Guild create event handler
- [x] Interaction create event handler (all types)
- [x] Slash command dispatcher
- [x] `/setup` command (admin onboarding)
- [x] `/join` command (member payment flow)
- [x] `/help` command (placeholder)
- [x] Button interaction handler (extensible registry)
- [x] Select menu interaction handler (extensible registry)
- [x] Modal interaction handler (extensible registry)
- [x] Role management utilities (grant, revoke, permissions)
- [x] Error handling for interactions
- [x] Bot presence/status setting

**Webhook Server** (Phase 2):
- [x] Fastify server setup
- [x] Security middleware (Helmet, CORS, Rate Limit)
- [x] Health check endpoint
- [x] Webhook endpoint placeholders

**Payment Webhooks** (Phase 4):
- [x] Polar webhook signature verification (Standard Webhooks HMAC-SHA256)
- [x] SePay webhook API Key verification (Apikey/Bearer authentication)
- [x] Event deduplication logic (database-backed)
- [x] Subscription status updates (ACTIVE, CANCELLED, REVOKED, REFUNDED)
- [x] Role grant/revoke automation via Discord gateway
- [x] Error handling with audit trail (WebhookEvent records)
- [x] Async processing with immediate acknowledgment (prevents timeouts)
- [x] Reference code parsing for SePay transactions
- [x] Replay attack prevention (5-minute timestamp window)
- [x] Timing-safe signature comparison (prevents timing attacks)

**Knowledge Base Management** (Phase 07):
- [x] KnowledgeDocument database model with full-text search support
- [x] OpenRouter LLM service for document generation (Gemini 2.5 Flash)
- [x] URL fetching with llms.txt protocol support
- [x] URL safety validation (blocks private IPs, cloud metadata)
- [x] YAML frontmatter parsing from generated documents
- [x] Full-text search with PostgreSQL ts_rank ranking
- [x] CRUD operations for documents (create, read, update, delete, list)
- [x] `/kb add` command (URL or text input with LLM processing)
- [x] `/kb list` command (paginated document listing)
- [x] `/kb search` command (full-text search with relevance)
- [x] `/kb view` command (view full document content)
- [x] `/kb remove` command (delete document)
- [x] OpenRouter API key validation
- [x] Retry mechanism with exponential backoff (3 attempts)
- [x] Environment variable for optional OPENROUTER_API_KEY

---

### Pending (MVP Phase 5-6)

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
2. `prisma/schema.prisma`: 5.6KB (236 lines) - Updated with KnowledgeDocument model
3. `docs/codebase-summary.md`: 60KB+ (updated with Phase 07)
4. `docs/README.md`: 14KB (579 lines)
5. `package.json`: 1.5KB (60 lines)

**Code Distribution**:
- Source code: 10+ files (500+ lines TypeScript)
  - Services: database, role-automation, knowledge-base, openrouter, url-processor
  - Commands: setup, join, help, kb (knowledge base)
  - Interactions: buttons, selectMenus, modals
  - Webhooks: server, routes (polar, sepay), services, utils
- Database: 1 schema + migrations
- Documentation: 6 files (>4000 lines)
- Configuration: 8 files (ESLint, Prettier, TypeScript, Docker)

**Phase 07 New Files**:
- `src/services/openrouter.ts` (179 lines) - LLM API integration
- `src/services/url-processor.ts` (224 lines) - Safe URL fetching
- `src/services/knowledge-base.ts` (183 lines) - CRUD + FTS search
- `src/bot/commands/ai/kb.ts` (~150 lines) - Knowledge base command
- `src/types/knowledge.ts` (55 lines) - Type definitions
- `tests/unit/services/knowledge-base.test.ts` - Unit tests
- `tests/unit/services/openrouter.test.ts` - Unit tests
- `tests/unit/services/url-processor.test.ts` - Unit tests

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

1. **Implement Onboarding UX** (Phase 5):
   - Progressive disclosure flow (3 steps)
   - Interactive components (select menus, modals, buttons)
   - Setup state persistence
   - Embed builders with design system

2. **Add Testing & CI/CD** (Phase 6):
   - Set up Jest test framework
   - Write unit tests for services and utilities
   - Add integration tests for webhooks
   - Implement E2E tests (payment flow)
   - Setup GitHub Actions CI pipeline
   - Achieve 80%+ code coverage

3. **Knowledge Base Integration** (Phase 07 - COMPLETED):
   - LLM-powered document generation from URLs/text
   - Full-text search with semantic ranking
   - Discord `/kb` command suite for CRUD operations
   - Supports multiple input sources (URLs, llms.txt, raw text)

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
**Last Updated**: 2025-12-03 (Phase 07 - Knowledge Base Management Complete)

### Phase 07 Summary

Phase 07 adds customer service AI capabilities with LLM-powered document generation and full-text search. The implementation includes:

**Core Services**:
- OpenRouter LLM integration for automatic document structuring with metadata extraction
- Safe URL fetching with llms.txt protocol support and security validations
- PostgreSQL full-text search with semantic ranking via ts_rank
- Complete CRUD operations with pagination support

**Discord Integration**:
- `/kb add` for uploading documents from URLs or text
- `/kb list` for browsing knowledge base with pagination
- `/kb search` for full-text queries with relevance ranking
- `/kb view` for reading full document content
- `/kb remove` for deleting documents

**Safety & Quality**:
- Private IP blocking (RFC 1918, IPv6 unique local)
- Cloud metadata endpoint protection (AWS, GCP)
- LLM retry with exponential backoff (1s, 2s, 4s)
- YAML frontmatter parsing for metadata extraction
- Optional OPENROUTER_API_KEY for graceful degradation

**Database**:
- New KnowledgeDocument model with relationships to Guild
- Indexed guildId for fast lookups
- JSONB metadata for flexible categorization
