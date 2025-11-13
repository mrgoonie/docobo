# Discord Bot + Payment Webhooks Tech Stack

**Date:** 2025-11-13 | **Sources:** 10+ authoritative (official docs, benchmarks, production cases)

## TLDR: TypeScript + Discord.js v14 + Prisma + Fastify

Best balance DX/perf/type-safety. Fastify 2-3x faster Express w/ validation. Rust/Axum only if mission-critical > DX.

---

## 1. Languages

**TypeScript ⭐**
Perf: Good I/O. Discord.js undici = 1300% boost [1] | Type safety: Full | DX: Best ecosystem (10,920 projects) [4] | Prod: Mature sharding | Weakness: Higher memory vs Go/Rust

**Go**
Perf: Superior goroutines, lower memory [2] | Type safety: Strong static | DX: Simple, smaller ecosystem | Prod: Excellent scale | Choose: Raw perf needs or Go expertise

**Rust**
Perf: Discord Go→Rust eliminated GC spikes [3] | Type safety: Strongest (ownership) | DX: Steep, verbose | Prod: Unmatched reliability | Choose: Mission-critical payments

**Python** - Not recommended (GIL, slowest)

---

## 2. Discord Libraries

**Discord.js v14 (TS) ⭐** - TS-first, 100% API, largest community, sharding [5]
**Discordeno (TS)** - Max perf for 100k+ guilds, functional, steeper
**DiscordGo (Go)** - Best Go, excellent goroutine perf
**Serenity (Rust)** - Leverages Rust safety, transparent sharding [6]
**discord.py (Python)** - Largest (8,570 projects) but perf limited

---

## 3. PostgreSQL ORMs

**Prisma (TS) ⭐**
Type: Full codegen [7] | Perf: Good complex queries [8] | DX: Best migrations/pooling/GUI [9] | Trade-off: Larger runtime (slower serverless cold starts)

**Drizzle (TS)**
Type: Strong TS schemas | Perf: ~2x faster simple queries [10] | Serverless: Smaller cold starts [8] | Choose: SQL-centric or edge

**TypeORM (TS)** - Legacy, less compelling
**GORM (Go)** - Convenient, medium type safety (reflection) [11]. Alt: `sqlc`+`pgx` max perf
**SeaORM (Rust)** - v2.0 strongly-typed, async [12]

---

## 4. Webhook Frameworks

**Fastify (TS) ⭐**
Perf: 2-3x Express, 76k req/s [13] | Validation: Built-in JSON Schema [14] | Type: First-class TS | Security: Helmet/CORS/rate-limit | Why: Fast + validates payloads

**Hono (TS)** - 5x smaller Express, fastest cold starts [13]. Edge/serverless (Cloudflare)
**Express (TS)** - Popular but slower
**FastAPI (Python)** - Near Go/Node perf [15], Pydantic validation [16]
**Axum (Rust)** - Exceptional perf, compile-time type-safe routing [17], memory safety
**Fiber (Go)** - Fast, Express-like, Go typing

---

## 5. Testing

**TypeScript:** Jest (standard [18]) / Vitest (modern) / Supertest (HTTP)
**Python:** Pytest [19] / unittest
**Go:** `testing` [20] / Testify
**Rust:** Cargo / Proptest [21] / Insta

---

## 6. Docker Deployment

**Optimization:** `alpine`/`slim` base | Multi-stage builds [22] | `.dockerignore` | Layer caching

**Security:** No embedded secrets - env vars/managers [23] | Non-root user | Updated images | Resource limits

**Reliability:** Health checks | Structured logging | Restart policies

**Deployment:** Docker Compose [24] | Cloud: ECS/Cloud Run/ACI | CI/CD: GitHub Actions [25] | Sharding [26] | K8s: Only if 100k+ guilds

---

## Final Stacks

### 🥇 TypeScript (Recommended)
```
Lang: TS (Node 22+) | Discord: Discord.js v14 | ORM: Prisma
Webhooks: Fastify | Test: Jest+Vitest+Supertest
Deploy: Docker Compose → ECS/Cloud Run
```
**Why:** Optimal balance. Fastest production. Mature.

### 🥈 Go (High Performance)
```
Lang: Go 1.22+ | Discord: DiscordGo | ORM: GORM (or sqlc+pgx)
Webhooks: Fiber | Test: testing+Testify | Deploy: Docker → K8s/ECS
```
**Why:** Superior perf, lower memory.

### 🥉 Rust (Mission-Critical)
```
Lang: Rust | Discord: Serenity | ORM: SeaORM 2.0
Webhooks: Axum | Test: Cargo+Proptest | Deploy: Docker → K8s
```
**Why:** Max reliability. Discord uses [3].

---

## Decision Matrix

| Factor | TypeScript | Go | Rust |
|--------|-----------|-----|------|
| Time to Prod | ⭐⭐⭐ Fast | ⭐⭐ Med | ⭐ Slow |
| Performance | ⭐⭐ Good | ⭐⭐⭐ Exc | ⭐⭐⭐ Exc |
| Type Safety | ⭐⭐⭐ Full | ⭐⭐⭐ Strong | ⭐⭐⭐ Strongest |
| DX | ⭐⭐⭐ Best | ⭐⭐ Good | ⭐ Steep |
| Ecosystem | ⭐⭐⭐ Largest | ⭐⭐ Med | ⭐ Small |
| Webhook Reliability | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## Sources (26 citations)

[1] GitHub: Discord.js undici perf | [2] Latenode: Go memory/perf | [3] Discord Eng: Go→Rust GC fix
[4] GitHub: Bot lang stats | [5] Discord.js: v14 docs | [6] Docs.rs: Serenity
[7] Prisma: Type safety | [8] Prisma: Benchmarks | [9] Better Stack: Drizzle vs Prisma
[10] Drizzle: Benchmarks | [11] Daily.dev: GORM | [12] SeaQL: SeaORM 2.0
[13] Better Stack: Framework comparison | [14] Fastify: JSON Schema | [15] Medium: FastAPI perf
[16] FastAPI: Pydantic | [17] Docs.rs: Axum routing | [18] Jest docs
[19] Pytest docs | [20] Go testing | [21] Proptest docs
[22] Docker: Multi-stage | [23] Aqua: Security | [24] Python Discord: Compose
[25] GitHub: CI/CD | [26] Discord.js: Sharding

**Full report:** `/mnt/d/www/docobo/plans/discord-bot-stack/reports/251113-discord-bot-payment-webhooks-stack.md`
