# Customer Service AI - Implementation Plan

**Date**: 2025-12-02
**Status**: PENDING
**Priority**: HIGH
**Parent**: [MVP Implementation Plan](../20251113-1746-docobo-mvp-implementation/plan.md)

---

## Overview

Add AI-powered customer service to Docobo Discord bot: knowledge base management, channel tracking, auto-response system, dashboard extension, and bot personality customization.

**Stack**: OpenRouter API (Gemini 2.5 Flash), PostgreSQL JSONB + FTS, setInterval polling (MVP)

---

## Implementation Phases

| Phase | Name | Status | Priority | Est. Time |
|-------|------|--------|----------|-----------|
| [07](./phase-07-knowledge-base.md) | Knowledge Base Management | PENDING | HIGH | 4-5 hrs |
| [08](./phase-08-channel-tracking.md) | Channel Tracking + Polling | PENDING | HIGH | 3-4 hrs |
| [09](./phase-09-auto-response.md) | Question Detection + Answers | PENDING | CRITICAL | 5-6 hrs |
| [10](./phase-10-dashboard.md) | Dashboard Extension | PENDING | MEDIUM | 3-4 hrs |
| [11](./phase-11-personality.md) | Bot Personality | PENDING | LOW | 2-3 hrs |

**Total Estimate**: 17-22 hours

---

## Key Architecture Decisions

1. **LLM Provider**: OpenRouter → Gemini 2.5 Flash (1M context, fast, cost-effective)
2. **Search**: PostgreSQL FTS + GIN indexes (no vector DB needed for MVP)
3. **Polling**: setInterval for MVP; migrate to BullMQ for production scale
4. **Streaming**: Disabled; collect full response, split into Discord messages
5. **Deduplication**: Track answered message IDs in database

---

## Database Schema Additions

New models: `KnowledgeDocument`, `TrackedChannel`, `AnsweredMessage`, `GuildCSConfig`, `LLMUsageLog`

See individual phase files for detailed schema.

---

## Success Criteria

- [ ] `/kb add` creates markdown doc with YAML frontmatter via LLM
- [ ] Tracked channels polled at configured intervals (2-5 min)
- [ ] Questions detected with heuristic gate + LLM validation
- [ ] Semantic search finds relevant docs and generates answers
- [ ] Dashboard shows activity logs and token usage
- [ ] Per-guild personality prompt customization works

---

## Dependencies

- OpenRouter API key (`OPENROUTER_API_KEY`)
- Existing Prisma + PostgreSQL setup
- Discord.js v14 (already installed)
- Fastify server (for dashboard routes)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM rate limits | HIGH | Exponential backoff, queue requests |
| High token costs | MEDIUM | Token budgeting, cache responses |
| Question misdetection | MEDIUM | Heuristic gate before LLM |
| Discord rate limits | HIGH | Respect 5 req/5s per channel |

---

## Next Steps

1. Read [Phase 07: Knowledge Base](./phase-07-knowledge-base.md)
2. Add database migrations
3. Implement OpenRouter service
4. Proceed sequentially through phases
