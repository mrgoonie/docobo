# Docobo Discord Bot

Professional paid community management bot. Automates role-based access via payment verification.

**Tech Stack**: TypeScript, Discord.js v14, Prisma, Fastify, PostgreSQL

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Discord bot token ([Developer Portal](https://discord.com/developers))
- Polar.sh account ([polar.sh](https://polar.sh))
- SePay.vn account ([sepay.vn](https://sepay.vn))

### Installation

```bash
# Clone repository
git clone <repository-url>
cd docobo

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env
```

Configure `.env`:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here  # Optional: test guild

# Database
DATABASE_URL=postgresql://postgres:postgresql@localhost:5432/docobo

# Polar.sh (Payment Provider 1)
POLAR_WEBHOOK_SECRET=your_polar_secret_here
POLAR_ACCESS_TOKEN=your_polar_access_token_here

# SePay.vn (Payment Provider 2)
SEPAY_CLIENT_ID=your_sepay_client_id_here
SEPAY_CLIENT_SECRET=your_sepay_client_secret_here
SEPAY_WEBHOOK_SECRET=your_sepay_webhook_secret_here

# Server Configuration
WEBHOOK_PORT=3000
NODE_ENV=development
```

**Critical**: Never commit `.env` file. Keep secrets secure.

### Database Setup

```bash
# Start PostgreSQL (Docker)
docker-compose up -d postgres

# Run migrations
npm run db:migrate

# Optional: Open Prisma Studio
npm run db:studio
```

**Database URL format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### Discord Bot Setup

1. **Create bot** at [Discord Developer Portal](https://discord.com/developers/applications)
2. **Enable intents**: Server Members, Guilds
3. **Generate invite URL**: OAuth2 > URL Generator
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Manage Roles`, `Manage Channels`, `Send Messages`, `Use Slash Commands`
4. **Invite bot** to test server
5. **Copy bot token** to `.env`

**Bot role position**: MUST be above managed paid roles. Check Server Settings > Roles.

### Payment Provider Setup

#### Polar.sh Configuration

1. Create account at [polar.sh](https://polar.sh)
2. Navigate to Settings > API Keys
3. Copy `Access Token` to `.env` (`POLAR_ACCESS_TOKEN`)
4. Navigate to Settings > Webhooks
5. Add webhook URL: `https://your-domain.com/webhooks/polar`
6. Copy `Webhook Secret` to `.env` (`POLAR_WEBHOOK_SECRET`)
7. Enable events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.active`
   - `subscription.canceled`
   - `subscription.revoked`

#### SePay.vn Configuration

1. Create account at [sepay.vn](https://sepay.vn)
2. Navigate to Developer > API Credentials
3. Copy `Client ID` and `Client Secret` to `.env`
4. Navigate to Webhooks
5. Add webhook URL: `https://your-domain.com/webhooks/sepay`
6. Generate webhook secret, copy to `.env` (`SEPAY_WEBHOOK_SECRET`)
7. Enable event: `payment.verified`

---

## Development Workflow

### Start Development Servers

```bash
# Terminal 1: Discord bot
npm run dev

# Terminal 2: Webhook server
npm run dev:webhooks
```

**Ports**:
- Bot: Connects to Discord Gateway (WSS)
- Webhooks: `http://localhost:3000`

### Docker Development

```bash
# Start all services (bot + webhooks + postgres)
docker-compose up

# Rebuild after code changes
docker-compose up --build

# Stop services
docker-compose down
```

### Code Quality

```bash
# Lint TypeScript
npm run lint
npm run lint:fix

# Format code
npm run format

# Type check
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Coverage target**: >80%

### Database Operations

```bash
# Create migration
npm run db:migrate

# Generate Prisma client (after schema changes)
npm run db:generate

# Open Prisma Studio (GUI)
npm run db:studio

# Reset database (DANGER: deletes all data)
npx prisma migrate reset
```

---

## Project Structure

```
docobo/
├── src/
│   ├── bot/                  # Discord bot logic
│   │   ├── commands/         # Slash commands
│   │   ├── events/           # Event handlers
│   │   └── utils/            # Bot utilities
│   ├── webhooks/             # Payment webhook handlers
│   │   ├── polar/            # Polar.sh integration
│   │   └── sepay/            # SePay.vn integration
│   ├── services/             # Business logic
│   │   ├── database.ts       # Prisma client
│   │   ├── role-manager.ts   # Role grant/revoke
│   │   └── subscription.ts   # Subscription logic
│   ├── config/
│   │   └── env.ts            # Environment validation (Zod)
│   ├── index.ts              # Bot entry point
│   └── webhook-server.ts     # Fastify webhook server
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Migration history
├── docs/
│   ├── README.md             # This file
│   ├── project-overview-pdr.md  # Product requirements
│   ├── code-standards.md     # Coding conventions
│   ├── system-architecture.md   # Architecture docs
│   └── design-guidelines.md  # UX/UI design system
├── tests/                    # Test files
├── docker/                   # Dockerfiles
├── .env.example              # Environment template
├── docker-compose.yml        # Docker services
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript config
```

---

## Deployment

### Production Build

```bash
# Build TypeScript
npm run build

# Output: ./dist/
```

### Docker Deployment

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f
```

### Environment Variables (Production)

**Required**:
- `NODE_ENV=production`
- All Discord, database, payment provider credentials
- Valid SSL certificate for webhook endpoints

**Security checklist**:
- [ ] Database uses SSL connection
- [ ] Webhook endpoints use HTTPS
- [ ] Environment variables stored securely (secrets manager)
- [ ] Bot token rotated quarterly
- [ ] Webhook secrets rotated quarterly
- [ ] Database backups automated
- [ ] Monitoring enabled

### Webhook Endpoint Setup

**Requirements**:
- Public HTTPS URL
- Valid SSL certificate
- Fast response (<500ms for webhook ACK)

**Recommended**:
- Use reverse proxy (Nginx, Caddy)
- Enable rate limiting
- Configure firewall rules
- Monitor webhook delivery failures

**Testing webhooks locally**:
Use ngrok or similar tunnel:
```bash
ngrok http 3000
# Copy HTTPS URL to payment provider webhook settings
```

---

## Core Features (MVP)

### 1. Server Onboarding
- Admin runs `/setup` command
- Select roles to monetize
- Set pricing per role
- Configure payment providers
- **Duration**: <3 minutes

### 2. Member Payment Flow
- Member views available paid roles
- Selects payment method (Polar/SePay)
- Completes payment
- Role automatically granted
- **Duration**: <2 minutes

### 3. Payment Webhooks
- Receives webhooks from Polar.sh and SePay.vn
- Verifies signatures (HMAC for Polar, OAuth2 for SePay)
- Deduplicates events (unique constraint on event ID)
- Grants/revokes roles based on subscription status
- **Latency**: Role granted within 5 seconds

### 4. Role Management
- Automatic role grant on payment success
- Automatic role revoke on subscription cancel/refund
- Permission checks (bot role hierarchy)
- Audit trail (all actions logged)

### 5. Error Handling
- Clear error messages (ephemeral, user-friendly)
- Webhook retry logic
- Database transaction rollback
- Admin notifications for critical errors

---

## Common Tasks

### Add New Slash Command

1. Create file in `src/bot/commands/`
2. Export command data and execute function
3. Register command (bot auto-registers on start)

Example:
```typescript
// src/bot/commands/ping.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

export async function execute(interaction) {
  await interaction.reply(`Pong! ${interaction.client.ws.ping}ms`);
}
```

### Add Database Model

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Generate client: `npm run db:generate`
4. Update TypeScript imports

### Add Webhook Event Handler

1. Create handler in `src/webhooks/polar/` or `src/webhooks/sepay/`
2. Implement event type matching
3. Call subscription service
4. Update role via role manager
5. Write tests

### Update Dependencies

```bash
# Check outdated packages
npm outdated

# Update specific package
npm update <package-name>

# Update all (careful with major versions)
npm update
```

---

## Troubleshooting

### Bot not responding to commands

**Check**:
1. Bot online? `npm run dev` running without errors?
2. Bot invited with `applications.commands` scope?
3. Commands registered? Check Discord Developer Portal > Your App > General Information

**Fix**: Re-invite bot with correct permissions, restart bot.

### Webhook not receiving events

**Check**:
1. Webhook server running? `npm run dev:webhooks`
2. Public URL accessible? Test with `curl https://your-domain.com/health`
3. Correct URL in payment provider dashboard?
4. Webhook secret matches `.env`?

**Fix**: Verify webhook URL, check firewall, test with ngrok.

### Database connection failed

**Check**:
1. PostgreSQL running? `docker-compose ps`
2. `DATABASE_URL` correct in `.env`?
3. Network accessible? Firewall blocking port 5432?

**Fix**: Start PostgreSQL, verify credentials, check network.

### Role not granted after payment

**Check**:
1. Bot role above paid role? Server Settings > Roles
2. Bot has `Manage Roles` permission?
3. Webhook event received? Check logs
4. Database updated? Check Prisma Studio

**Fix**: Adjust role hierarchy, grant permissions, check webhook logs.

### TypeScript compilation errors

**Check**:
1. Node modules installed? `npm install`
2. Prisma client generated? `npm run db:generate`
3. TypeScript version compatible? Check `package.json`

**Fix**: Reinstall dependencies, regenerate Prisma client, check tsconfig.

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Webhook ACK | <500ms | Return 200 immediately |
| Role grant (post-webhook) | <5s | Discord API latency |
| Database query | <50ms | With indexes |
| Slash command response | <3s | Discord timeout limit |
| Admin setup completion | <3min | User experience target |
| Test suite execution | <30s | CI/CD requirement |

---

## Security Best Practices

### Environment Security
- Never commit `.env` file
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate credentials quarterly
- Use different credentials per environment (dev/staging/prod)

### Webhook Security
- Always verify HMAC signatures (Polar)
- Always verify OAuth2 tokens (SePay)
- Never skip verification in production
- Use HTTPS only
- Implement rate limiting
- Log all webhook events for audit

### Database Security
- Use SSL connections in production
- Implement connection pooling
- Never expose database publicly
- Regular backups (automated)
- Test restore process

### Discord Security
- Bot token is sensitive (treat like password)
- Minimum required permissions (no Administrator)
- Verify user permissions before actions
- Use ephemeral messages for sensitive data
- Log admin actions

### Code Security
- No secrets in code
- Validate all user input (Zod)
- Sanitize database queries (Prisma prevents SQL injection)
- Regular dependency updates (npm audit)
- Enable TypeScript strict mode

---

## Support & Resources

### Documentation
- **Project Overview**: `/mnt/d/www/docobo/docs/project-overview-pdr.md`
- **Code Standards**: `/mnt/d/www/docobo/docs/code-standards.md`
- **Architecture**: `/mnt/d/www/docobo/docs/system-architecture.md`
- **Design Guidelines**: `/mnt/d/www/docobo/docs/design-guidelines.md`

### External Resources
- [Discord.js Guide](https://discordjs.guide)
- [Discord Developer Portal](https://discord.com/developers)
- [Prisma Documentation](https://prisma.io/docs)
- [Fastify Documentation](https://fastify.dev)
- [Polar.sh API Docs](https://polar.sh/docs)
- [SePay.vn API Docs](https://docs.sepay.vn)

### Community
- GitHub Issues: Bug reports, feature requests
- Discord Server: Community support
- Email: support@docobo.com

---

## Contributing

### Code Contribution Workflow
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Run tests (`npm test`)
5. Push branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Example**:
```
feat(webhooks): add Polar subscription.active handler

Implement role grant logic when subscription becomes active.
Includes signature verification and deduplication.

Closes #42
```

### Code Review Checklist
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] Error handling implemented

---

## License

MIT License - See LICENSE file for details

---

## Changelog

### v0.1.0 (2025-11-13)
- Initial MVP implementation
- Discord bot core with slash commands
- Polar.sh webhook integration
- SePay.vn webhook integration
- PostgreSQL database with Prisma
- Fastify webhook server
- Docker deployment setup
- Comprehensive documentation

---

**Last Updated**: 2025-11-13
**Version**: 0.1.0
**Status**: MVP Development
