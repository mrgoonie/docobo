# Discord Bot Development Research - Paid Community Management

## 1. Library Comparison: Discord.js vs discord.py vs Alternatives

### Discord.js (Node.js)
- **Performance**: 1300% speed boost after switching to undici from node-fetch [1]
- **Features**: Rich event handling, comprehensive API coverage, frequent updates [8]
- **Best for**: High-traffic apps, JavaScript ecosystem integration
- **Popularity**: 303K weekly npm downloads [8]
- **Rate limiting**: Built-in via @discordjs/rest - automatic queue mgmt, smart retries, bucket tracking [4]

### discord.py (Python)
- **Performance**: Optimized for speed/memory; varies by runtime (CPython, Cython) [8]
- **Features**: Event-based architecture, discord.ext.commands framework, ML/data processing integration [8]
- **Best for**: Data-heavy bots, Python ecosystem (numpy, ML libs)
- **Rate limiting**: Automatic handling - pauses/retries on 429s by default [4]

### Alternatives
- **Discord.Net** (C#): Enterprise apps, .NET integration [6]
- **DPP** (C++): Ultra-high performance, low-level control [6]
- **Recommendation**: Use language you're most comfortable with - both libraries handle small-medium bots well [8]

## 2. Slash Commands & Interaction Handling

### Interaction Types [6]
- Application Commands: slash, user, message commands
- Message Components: buttons, select menus
- Modals: form inputs

### Response Requirements [6]
- **MUST** respond within 3 seconds to acknowledge interaction
- Response types: pong (ping), message, async acknowledgement
- Interaction payload includes user-submitted values, resolved users/messages

### Best Practices
- Use slash commands over prefix commands (deprecated pattern)
- Register commands globally (1hr cache) or per-guild (instant updates) [6,7]
- Implement defer/followup pattern for long operations [6]
- Validate inputs server-side, never trust client data

## 3. Role Management & Permission Systems

### Principle of Least Privilege [3]
- Grant ONLY minimum required permissions
- Avoid Administrator permission unless absolutely necessary
- Create dedicated bot role vs granting individual permissions

### Role Hierarchy [3]
- Bot can only manage users with roles LOWER than bot's highest role
- Position bot role appropriately in server hierarchy
- Test permissions on test server with multiple accounts

### Permission Auditing [3]
- Review bot permissions monthly minimum
- Document why each permission is needed
- Monitor bot activity for suspicious behavior
- Use channel-specific permission overrides for granular control

### Dangerous Permissions to Avoid
- Manage Webhooks (remove after initial setup)
- Manage Roles, Manage Channels, Administrator [2]

## 4. Webhook Security & Payment Verification

### Webhook Security [2]
- **Signature verification**: Use HMAC cryptography with timestamp to prevent replay attacks
- **URL protection**: Treat webhook URLs like passwords - never expose in client code/repos
- **Secret rotation**: Rotate secrets periodically and on exposure
- **Timestamp validation**: Verify request timestamps to prevent replay attacks

### Payment Verification [2]
- Discord uses Stripe for bot verification identity checks
- Validate inbound interactions using Discord's public key
- For subscriptions: webhook listeners for payment success/failure/cancellation events

### Implementation Pattern [2]
```
1. Payment gateway sends webhook with signature
2. Verify HMAC signature + timestamp
3. Process event (subscription.created, subscription.updated, subscription.deleted)
4. Update user roles accordingly
5. Return 200 OK within timeout
```

## 5. Bot Onboarding Flow Best Practices

### Core Principles [9]
- **First 15 minutes critical**: Get members chatting quickly
- **Keep in-flow**: No external windows/DM switches - use private onboarding channels
- **Progressive disclosure**: Ask about skills/interests → assign relevant roles/channels

### UX Guidelines [9]
- **Simplicity**: Each text paragraph increases dropout rate
- **Remove friction**: Skip complex bot verification - Discord's built-in captcha handles security
- **Avoid DMs**: Members may have DMs disabled for non-friends
- **Strategic ordering**: Read-only channels → chattable channels → most active channel

### Engagement Tactics [9]
- Customization questions for role/channel selection
- Vary question structure - avoid repetition
- Gamification with interactive elements
- 5-10 second window before most users leave

### What NOT to Do [9]
- Bot-powered verification that confuses newcomers
- Breaking continuous flow with pings/DMs
- Overwhelming with too much text upfront
- Complex multi-step processes

## 6. Database Schema Design for Guilds/Members

### MongoDB Pattern (NoSQL) [5]
```javascript
// Guild Schema
{
  guildId: String (unique),
  guildName: String,
  prefix: { type: String, default: "!" },
  locale: String,
  settings: {
    welcomeChannel: Schema.Types.ObjectId,
    welcomeMessage: String
  },
  createdAt: Date
}

// User Schema
{
  userId: String (unique),
  guildId: Schema.Types.ObjectId (ref: Guild),
  username: String,
  roles: [String],
  subscriptionTier: String,
  subscriptionStatus: { type: String, enum: ['active', 'expired', 'cancelled'] },
  subscriptionExpiry: Date,
  joinedAt: Date
}
```

**Why MongoDB**: Flexible schema, fast BSON retrieval, handles nested data well [5]

### PostgreSQL Pattern (Relational) [5]
```sql
-- guilds table
CREATE TABLE guilds (
  guild_id BIGINT PRIMARY KEY,  -- Discord ID always unique
  guild_name VARCHAR(100),
  prefix VARCHAR(10) DEFAULT '!',
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- members table
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  guild_id BIGINT REFERENCES guilds(guild_id),
  subscription_tier VARCHAR(50),
  subscription_status VARCHAR(20),
  subscription_expiry TIMESTAMP,
  UNIQUE(user_id, guild_id)  -- User can be in multiple guilds
);

-- subscriptions table (for paid communities)
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT,
  guild_id BIGINT,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan_id VARCHAR(100),
  status VARCHAR(20),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Why PostgreSQL**: ACID compliance, complex queries, better for financial data [5]

### Key Considerations [5]
- **User uniqueness**: Store (guildId + userId) - users exist in multiple servers
- **guildCreate event**: Check if settings exist, create with defaults if new
- **State tracking**: Databases enable tracking changes while bot offline (e.g., member joins)
- **Indexes**: Index guild_id, user_id, subscription_status for query performance

## 7. Rate Limiting & Discord API Best Practices

### Rate Limit Types [4]
- **Global limit**: 50 requests/second across all endpoints
- **Per-route limits**: Specific to endpoint buckets
- **Resource-specific**: Guild-level, channel-level operations
- **Shared limits**: Don't count against your invalid request count (X-RateLimit-Scope: shared) [4]

### Critical Headers [4]
```
X-RateLimit-Limit: Rate limit ceiling
X-RateLimit-Remaining: Requests remaining
X-RateLimit-Reset: Unix timestamp when reset
X-RateLimit-Reset-After: Seconds until reset
X-RateLimit-Scope: Type of rate limit
Retry-After: Milliseconds to wait (on 429)
```

### Handling 429 Errors [4]
1. **ALWAYS respect Retry-After header** - wait specified time before retry
2. **Proactive management**: Inspect rate limit headers, don't exhaust buckets
3. **Exponential backoff**: Implement retry with increasing delays
4. **Use library features**: Both discord.js and discord.py handle automatically

### Advanced Strategies [4]
- **Sharding**: Split bot into instances, each handling subset of guilds - distributes load
- **Centralized queueing**: Redis-based rate limit sync across processes
- **HTTP proxy**: Route all requests through central proxy (e.g., twilight-http-proxy)

### IP Ban Protection [4]
- **10,000 invalid requests per 10 minutes** triggers temporary IP restriction
- Invalid = 401, 403, or 429 status codes
- Monitor error rates to avoid bans

### Library-Specific Handling
- **Discord.js**: @discordjs/rest handles queues, buckets, retries automatically [4]
- **discord.py**: Automatic pause/retry on rate limits by default [4]

## 8. Paid Membership Management Patterns

### Subscription Lifecycle [10]
```
1. Payment webhook → Verify signature
2. subscription.created → Assign role, grant channel access
3. subscription.updated → Update tier, modify permissions
4. subscription.deleted/cancelled → Remove role, revoke access
5. subscription.payment_failed → Grace period → revoke if not resolved
```

### Role-Based Access Control [10]
- Tiered membership structure (basic, premium, VIP)
- Each tier = Discord role with specific channel permissions
- Automated role assignment on payment success
- Automated role removal on cancellation/expiry

### Payment Integration Patterns [10]
- **Stripe webhooks**: subscription events, payment intents, invoices
- **PayPal IPN**: Recurring payment notifications
- **Verify signatures**: HMAC validation on all webhook payloads
- **Idempotency**: Handle duplicate webhook deliveries gracefully

### Database Schema for Subscriptions [10]
```javascript
{
  userId: String,
  guildId: String,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  tier: { type: String, enum: ['basic', 'premium', 'vip'] },
  status: { type: String, enum: ['active', 'past_due', 'cancelled', 'expired'] },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: Boolean,
  metadata: Object
}
```

### Automation Features [10]
- Expiry reminders (7 days, 3 days, 1 day before)
- Grace period handling (3-7 days for failed payments)
- Automatic downgrade on cancellation
- Audit logs for permission changes

### Third-Party Solutions
- **AccessDock**: Charge for server access, paid roles [10]
- **LaunchPass/Upgrade.Chat**: Auto role sync, invite management [10]
- **Memberful/Patreon**: Native Discord integration, tier sync [10]

## 9. Additional Best Practices

### Security
- Store tokens in environment variables/secret managers, never in code
- Use principle of least privilege for all permissions
- Implement rate limiting on custom endpoints
- Validate all user inputs server-side
- Log security events (failed auth, permission changes)

### Performance
- Cache Discord data (guilds, channels, roles) to reduce API calls
- Use lazy loading for large guild datasets
- Implement connection pooling for databases
- Use CDN for static assets (images, embeds)

### Monitoring
- Track API error rates (401, 403, 429, 500)
- Monitor latency (gateway ping, API response times)
- Alert on unusual activity (permission changes, mass bans)
- Log financial transactions with audit trail

### Testing
- Test on multiple guilds (small, medium, large)
- Simulate high load with rate limit scenarios
- Test permission edge cases (role hierarchy)
- Validate payment webhook replay attacks

## Sources
[1] GitHub - discordjs/discord.js discussions
[2] Hookdeck - Discord Webhooks Security Guide
[3] Toxigon - Discord Bot Permissions Best Practices
[4] Discord Developer Docs - Rate Limits + community guides
[5] Stack Overflow + Medium - MongoDB/PostgreSQL patterns
[6] Discord Developer Docs - Interactions
[7] Discord.js Guide - Slash Commands
[8] npm trends + Library Comparison discussions
[9] Discord Community + Medium - Onboarding guides
[10] Best Friends Club + BuildShip - Paid membership guides

## Unresolved Questions
- Specific latency benchmarks for discord.js v14+ vs discord.py v2+
- Recommended sharding thresholds (guild count)
- Discord's official stance on third-party payment integrations vs native Server Subscriptions
- Database schema recommendations from Discord directly
- Rate limit bucket identification algorithms (proprietary)
