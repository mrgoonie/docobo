# Phase 01: Environment Setup

**Date**: 2025-11-13 | **Priority**: HIGH | **Status**: PENDING

[← Back to Plan](./plan.md) | [Next: Phase 02 →](./phase-02-database.md)

---

## Context

Initialize TypeScript project with Discord.js v14, Prisma ORM, Fastify webhook server. Configure dev environment, tooling, dependencies.

---

## Key Insights from Research

- **Discord.js v14**: 1300% perf boost via undici (vs node-fetch), TS-first, full API coverage
- **Prisma**: Best DX for PostgreSQL (codegen, migrations, GUI), good complex query perf
- **Fastify**: 2-3x faster Express, 76k req/s, built-in JSON Schema validation
- **Testing**: Jest (standard) + Vitest (modern alternative) + Supertest (HTTP)
- **Docker**: Multi-stage builds, alpine base, non-root user, health checks

---

## Requirements

### Functional
- Project scaffolding (src/, tests/, prisma/)
- TypeScript configuration (strict mode, paths, decorators)
- Environment variable management (.env + validation)
- Dev tooling (ESLint, Prettier, Husky hooks)
- Docker setup (bot + postgres + fastify services)

### Non-Functional
- Type-safety: strict TypeScript (no `any` allowed)
- Code quality: ESLint + Prettier enforcement
- Security: secrets in .env, never committed
- DX: hot reload, fast compilation (<3s)

---

## Architecture Decisions

**1. Monorepo Structure**
```
docobo/
├── src/
│   ├── bot/           # Discord bot logic
│   ├── webhooks/      # Fastify webhook server
│   ├── services/      # Shared business logic
│   └── utils/         # Helpers, validators
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   ├── Dockerfile.bot
│   └── Dockerfile.webhooks
└── docker-compose.yml
```
**Rationale**: Single repo simplifies shared types, utilities. Clear separation of concerns (bot vs webhooks).

**2. Environment Variables**
- `.env.example` committed (template)
- `.env` gitignored (actual secrets)
- Validation on startup (fail fast if missing)

**3. TypeScript Config**
- `strict: true` (catch errors early)
- `esModuleInterop: true` (Discord.js compatibility)
- `paths`: `@/*` alias for clean imports

---

## Related Code Files

```
/mnt/d/www/docobo/
├── package.json              # To create
├── tsconfig.json             # To create
├── .env.example              # To create
├── .eslintrc.json            # To create
├── .prettierrc               # To create
├── docker-compose.yml        # To create
├── src/
│   ├── index.ts              # Bot entry
│   ├── webhook-server.ts     # Fastify entry
│   └── config/
│       └── env.ts            # Env validation
└── prisma/
    └── schema.prisma         # (Next phase)
```

---

## Implementation Steps

### Step 1: Initialize Project
```bash
# Create project root (if not exists)
mkdir -p /mnt/d/www/docobo
cd /mnt/d/www/docobo

# Initialize npm project
npm init -y

# Update package.json metadata
npm pkg set name="docobo"
npm pkg set version="0.1.0"
npm pkg set description="Professional paid community management Discord bot"
npm pkg set type="module"
```

### Step 2: Install Core Dependencies
```bash
# Discord.js v14
npm install discord.js@^14.14.1

# Prisma ORM
npm install @prisma/client@^5.7.1
npm install -D prisma@^5.7.1

# Fastify + plugins
npm install fastify@^4.25.2
npm install @fastify/helmet@^11.1.1
npm install @fastify/cors@^8.5.0
npm install @fastify/rate-limit@^9.1.0

# Polar SDK (webhook verification)
npm install @polar-sh/sdk@^0.9.0

# Environment validation
npm install dotenv@^16.3.1
npm install zod@^3.22.4

# TypeScript + types
npm install -D typescript@^5.3.3
npm install -D @types/node@^20.10.6
npm install -D tsx@^4.7.0
```

### Step 3: Install Dev Dependencies
```bash
# Testing
npm install -D jest@^29.7.0
npm install -D @types/jest@^29.5.11
npm install -D ts-jest@^29.1.1
npm install -D vitest@^1.1.0
npm install -D supertest@^6.3.3
npm install -D @types/supertest@^6.0.2

# Linting + Formatting
npm install -D eslint@^8.56.0
npm install -D @typescript-eslint/parser@^6.16.0
npm install -D @typescript-eslint/eslint-plugin@^6.16.0
npm install -D prettier@^3.1.1
npm install -D eslint-config-prettier@^9.1.0

# Git hooks
npm install -D husky@^8.0.3
npm install -D lint-staged@^15.2.0
```

### Step 4: Create TypeScript Config
**File**: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 5: Create ESLint Config
**File**: `.eslintrc.json`
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Step 6: Create Prettier Config
**File**: `.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

### Step 7: Create Environment Template
**File**: `.env.example`
```bash
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here

# Database
DATABASE_URL=postgresql://postgres:postgresql@localhost:5432/docobo

# Polar.sh
POLAR_WEBHOOK_SECRET=your_polar_secret_here
POLAR_ACCESS_TOKEN=your_polar_access_token_here

# SePay.vn
SEPAY_CLIENT_ID=your_sepay_client_id_here
SEPAY_CLIENT_SECRET=your_sepay_client_secret_here
SEPAY_WEBHOOK_SECRET=your_sepay_webhook_secret_here

# Server Configuration
WEBHOOK_PORT=3000
NODE_ENV=development
```

### Step 8: Create Environment Validator
**File**: `src/config/env.ts`
```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord bot token required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID required'),
  DISCORD_GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().url('Valid PostgreSQL URL required'),
  POLAR_WEBHOOK_SECRET: z.string().min(1, 'Polar webhook secret required'),
  POLAR_ACCESS_TOKEN: z.string().min(1, 'Polar access token required'),
  SEPAY_CLIENT_ID: z.string().min(1, 'SePay client ID required'),
  SEPAY_CLIENT_SECRET: z.string().min(1, 'SePay client secret required'),
  SEPAY_WEBHOOK_SECRET: z.string().min(1, 'SePay webhook secret required'),
  WEBHOOK_PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
}

export const env = validateEnv();
```

### Step 9: Create Package Scripts
**Update `package.json` scripts**:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:webhooks": "tsx watch src/webhook-server.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:webhooks": "node dist/webhook-server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "prepare": "husky install"
  }
}
```

### Step 10: Configure Git Hooks
```bash
# Initialize Husky
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**File**: `.lintstagedrc.json`
```json
{
  "*.ts": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

### Step 11: Create Docker Setup
**File**: `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: docobo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgresql
      POSTGRES_DB: docobo
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  bot:
    build:
      context: .
      dockerfile: docker/Dockerfile.bot
    container_name: docobo-bot
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://postgres:postgresql@postgres:5432/docobo
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma

  webhooks:
    build:
      context: .
      dockerfile: docker/Dockerfile.webhooks
    container_name: docobo-webhooks
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://postgres:postgresql@postgres:5432/docobo
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src

volumes:
  postgres_data:
```

**File**: `docker/Dockerfile.bot`
```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["node", "dist/index.js"]
```

**File**: `docker/Dockerfile.webhooks`
```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/webhook-server.js"]
```

### Step 12: Create .gitignore
**File**: `.gitignore`
```gitignore
# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# Testing
coverage/
*.lcov

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Docker
.dockerignore

# Prisma
prisma/migrations/*_migration_lock.toml
```

---

## Todo Checklist

- [ ] Initialize npm project
- [ ] Install dependencies (core + dev)
- [ ] Create TypeScript config
- [ ] Configure ESLint + Prettier
- [ ] Create .env.example
- [ ] Implement env validator (src/config/env.ts)
- [ ] Update package.json scripts
- [ ] Configure Husky + lint-staged
- [ ] Create Docker Compose setup
- [ ] Create Dockerfiles (bot + webhooks)
- [ ] Create .gitignore
- [ ] Copy .env.example → .env (fill real secrets)
- [ ] Run `npm install` (verify no errors)
- [ ] Run `npm run lint` (should pass)
- [ ] Start PostgreSQL: `docker-compose up postgres -d`
- [ ] Verify DB connection: `psql postgresql://postgres:postgresql@localhost:5432/docobo`

---

## Success Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript successfully
- [ ] ESLint passes with no errors
- [ ] Environment validation catches missing vars
- [ ] PostgreSQL container runs and accepts connections
- [ ] Docker Compose builds all services
- [ ] Husky pre-commit hook runs lint-staged

---

## Security Considerations

### Critical
- **Never commit .env**: Add to .gitignore immediately
- **Validate env on startup**: Fail fast if secrets missing
- **Non-root Docker user**: Run as nodejs:nodejs (UID 1001)

### Important
- **Dependency audit**: Run `npm audit` monthly
- **Update base images**: Use `node:22-alpine` (smaller attack surface)
- **Health checks**: Prevent unhealthy containers from receiving traffic

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing env vars in production | CRITICAL | Zod validation fails startup |
| Outdated dependencies | MEDIUM | Dependabot alerts, monthly audits |
| Docker image size bloat | LOW | Multi-stage builds, alpine base |
| Type errors in production | MEDIUM | Strict TypeScript, no `any` allowed |

---

## Next Steps

1. Complete all todo items
2. Verify PostgreSQL connection
3. Proceed to [Phase 02: Database Schema](./phase-02-database.md)
4. Do NOT start coding bot logic yet (premature)

---

**Estimated Time**: 2-3 hours
