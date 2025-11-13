# Phase 07: Knowledge Base Management

**Parent**: [Customer Service AI Plan](./plan.md)
**Dependencies**: Phase 02 (Database), Phase 03 (Bot Core)
**Date**: 2025-12-02 | **Priority**: HIGH | **Status**: PENDING

---

## Overview

Implement knowledge base CRUD operations with LLM-powered document generation from URLs or raw text.

---

## Key Insights (From Research)

- **OpenRouter Auth**: Bearer token, endpoint `https://openrouter.ai/api/v1/chat/completions`
- **Model**: `google/gemini-2.5-flash` - best for structured markdown output
- **llms.txt**: Check `https://site.com/llms.txt` for metadata before full scrape
- **YAML validation**: Parse generated YAML, fallback to regex extraction
- **Token efficiency**: Markdown 5-15% cheaper than JSON for text-heavy docs

---

## Requirements

1. Slash command `/kb add <link-or-text>` (admin/mod only)
2. Accept URLs (prioritize llms.txt) or raw text input
3. Generate markdown with YAML frontmatter via OpenRouter
4. Store in PostgreSQL JSONB with FTS indexes
5. Commands: `/kb list`, `/kb remove <id>`, `/kb update <id>`, `/kb search <query>`

---

## Database Schema

```prisma
model KnowledgeDocument {
  id          String   @id @default(cuid())
  guildId     String
  guild       Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)

  title       String   @db.VarChar(255)
  description String   @db.Text  // SEO-like for semantic search
  content     String   @db.Text
  sourceUrl   String?  @db.VarChar(2048)

  // JSONB for flexible metadata
  metadata    Json?    @db.JsonB  // {author, category, tags[], references[], word_count}

  // FTS vector (generated column in migration)
  // searchVector tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || description || ' ' || content))

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([guildId])
  @@map("knowledge_documents")
}
```

**Migration SQL** (add after Prisma migration):
```sql
-- Add FTS index
ALTER TABLE knowledge_documents ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(content,''))) STORED;

CREATE INDEX idx_knowledge_docs_fts ON knowledge_documents USING GIN (search_vector);
```

---

## Architecture

```
User runs /kb add <url>
        │
        ▼
┌─────────────────┐
│ Command Handler │
└────────┬────────┘
         │ 1. Validate admin/mod perms
         ▼
┌─────────────────┐
│ URL Processor   │ 2. Check llms.txt first
└────────┬────────┘    Fallback: fetch full page
         │
         ▼
┌─────────────────┐
│ OpenRouter API  │ 3. Generate markdown + YAML
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ YAML Validator  │ 4. Parse frontmatter
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │ 5. Store document
└─────────────────┘
```

---

## Related Files

- `src/bot/commands/kb.ts` - Slash command handler
- `src/services/openrouter.ts` - LLM API client
- `src/services/knowledge-base.ts` - CRUD operations
- `src/services/url-processor.ts` - URL fetching + llms.txt
- `src/types/knowledge.ts` - TypeScript interfaces
- `prisma/schema.prisma` - Database model

---

## Implementation Steps

### 1. Database Migration (30 min)
- Add `KnowledgeDocument` model to Prisma schema
- Run `npx prisma migrate dev --name add_knowledge_documents`
- Execute FTS index SQL manually

### 2. OpenRouter Service (1 hr)
```typescript
// src/services/openrouter.ts
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export async function generateDocument(content: string, config: OpenRouterConfig): Promise<GeneratedDoc> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://docobo.io',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: DOCUMENT_GENERATION_PROMPT },
        { role: 'user', content }
      ],
      max_tokens: config.maxTokens,
      temperature: 0.3, // Lower for consistent output
    }),
  });
  // Parse and validate YAML frontmatter
}
```

### 3. URL Processor (45 min)
- Fetch URL, check for `/llms.txt` first
- Extract text content (strip HTML)
- Limit to 10K chars for LLM context

### 4. Knowledge Base Service (1 hr)
- CRUD operations with Prisma
- FTS search: `WHERE search_vector @@ plainto_tsquery('english', $query)`
- Pagination for `/kb list`

### 5. Slash Commands (1.5 hr)
- `/kb add <url|text>` - Generate and store doc
- `/kb list [page]` - Paginated list with embed
- `/kb remove <id>` - Delete confirmation modal
- `/kb update <id>` - Edit modal with current values
- `/kb search <query>` - FTS search with relevance ranking

### 6. Permission Checks (30 min)
- Check `ManageGuild` or `ManageMessages` permission
- Ephemeral error for unauthorized users

---

## Todo List

- [ ] Add KnowledgeDocument model to Prisma schema
- [ ] Run database migration
- [ ] Add FTS index via raw SQL
- [ ] Create OpenRouter service with retry logic
- [ ] Implement URL processor with llms.txt support
- [ ] Create knowledge-base service (CRUD)
- [ ] Implement /kb add command
- [ ] Implement /kb list command
- [ ] Implement /kb remove command
- [ ] Implement /kb update command
- [ ] Implement /kb search command
- [ ] Add permission checks
- [ ] Write unit tests for services
- [ ] Write integration tests for commands

---

## Success Criteria

- [ ] `/kb add https://example.com` generates structured doc
- [ ] YAML frontmatter includes title, description, category
- [ ] FTS search returns relevant docs in <50ms
- [ ] Admin-only access enforced
- [ ] LLM errors handled gracefully with user feedback

---

## Security Considerations

- Validate URLs (no internal IPs, localhost)
- Sanitize fetched content before LLM processing
- Rate limit `/kb add` (prevent abuse)
- Log LLM token usage per guild

---

## Next Steps

After completion, proceed to [Phase 08: Channel Tracking](./phase-08-channel-tracking.md)
