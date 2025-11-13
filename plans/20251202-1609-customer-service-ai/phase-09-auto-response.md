# Phase 09: Auto-Response System

**Parent**: [Customer Service AI Plan](./plan.md)
**Dependencies**: Phase 07 (Knowledge Base), Phase 08 (Channel Tracking)
**Date**: 2025-12-02 | **Priority**: CRITICAL | **Status**: PENDING

---

## Overview

Detect questions in tracked channels, search knowledge base, generate contextual answers using LLM, and reply automatically. Core feature of Customer Service AI.

---

## Key Insights (From Research)

- **Question detection**: Heuristic gate first (70-80% filtered), then LLM validation
- **Heuristics**: `?` presence, keywords (what/how/why/can/will/does)
- **Context window**: 4096 tokens budget (system: 350, history: 1200, query: 150, response: 600)
- **Reply pattern**: Use `message.reply()` not `channel.send()` (threading, mentions)
- **Cooldowns**: Per-user 60s, per-channel 30s to prevent spam
- **Streaming disabled**: Collect full response, split into 2000-char Discord messages

---

## Requirements

1. Heuristic question detection (fast, no LLM cost)
2. LLM question validation for ambiguous cases
3. Semantic search on knowledge base (FTS + LLM reranking)
4. Answer generation with system prompt + KB context
5. Deduplication via `AnsweredMessage` table
6. Reply to original message with generated answer
7. Cooldown protection (user/channel)

---

## Database Schema

```prisma
model AnsweredMessage {
  id          String   @id @default(cuid())
  guildId     String
  channelId   String   @db.VarChar(20)
  messageId   String   @db.VarChar(20)
  documentIds String[] // Array of KB doc IDs used

  question    String   @db.Text  // Original question text
  answer      String   @db.Text  // Generated answer
  tokensUsed  Int      @default(0)

  answeredAt  DateTime @default(now())

  @@unique([messageId])
  @@index([guildId])
  @@index([channelId])
  @@index([answeredAt])
  @@map("answered_messages")
}

model LLMUsageLog {
  id        String   @id @default(cuid())
  guildId   String
  model     String   @db.VarChar(100)
  tokens    Int
  cost      Decimal  @db.Decimal(10, 6)
  operation String   @db.VarChar(50) // 'doc_generation', 'question_detection', 'answer_generation'

  createdAt DateTime @default(now())

  @@index([guildId])
  @@index([createdAt])
  @@map("llm_usage_logs")
}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Auto-Response Pipeline                        │
└──────────────────────────────────────────────────────────────────┘

  Message from Polling
          │
          ▼
┌─────────────────────┐    No
│ Already Answered?   ├────────► Skip
│ (check messageId)   │
└─────────┬───────────┘
          │ Yes (new)
          ▼
┌─────────────────────┐    No
│ Heuristic Check     ├────────► Skip
│ (? mark, keywords)  │
└─────────┬───────────┘
          │ Yes (likely question)
          ▼
┌─────────────────────┐    No (not a question)
│ LLM Question        ├────────► Skip
│ Validation (0.3s)   │
└─────────┬───────────┘
          │ Yes (confirmed question)
          ▼
┌─────────────────────┐    No docs found
│ KB Semantic Search  ├────────► Generic response
│ (FTS + rerank)      │          "Sorry, no info"
└─────────┬───────────┘
          │ Found docs
          ▼
┌─────────────────────┐
│ Answer Generation   │
│ (system + KB + Q)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Split to 2000 char  │
│ Discord messages    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ message.reply()     │
│ + Log to DB         │
└─────────────────────┘
```

---

## Related Files

- `src/services/question-detector.ts` - Heuristics + LLM validation
- `src/services/semantic-search.ts` - FTS + LLM reranking
- `src/services/answer-generator.ts` - Answer generation
- `src/services/auto-responder.ts` - Orchestration
- `src/services/cooldown-manager.ts` - Rate limiting
- `src/utils/message-splitter.ts` - Split long responses

---

## Implementation Steps

### 1. Database Migration (15 min)
- Add `AnsweredMessage` and `LLMUsageLog` models
- Run migration

### 2. Question Detector Service (1 hr)
```typescript
// src/services/question-detector.ts
const QUESTION_PATTERNS = /\b(what|why|how|who|when|where|does|can|will|should|is|are)\b/i;

export function isLikelyQuestion(content: string): boolean {
  // Heuristic gate (fast, no LLM cost)
  if (content.includes('?')) return true;
  if (QUESTION_PATTERNS.test(content)) return true;
  return false;
}

export async function validateQuestion(
  content: string,
  openrouter: OpenRouterService
): Promise<boolean> {
  // LLM validation for ambiguous cases
  const response = await openrouter.chat({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: 'Reply YES if this is a question seeking information, NO otherwise. One word only.' },
      { role: 'user', content }
    ],
    max_tokens: 5,
    temperature: 0,
  });
  return response.trim().toUpperCase() === 'YES';
}
```

### 3. Semantic Search Service (1.5 hr)
```typescript
// src/services/semantic-search.ts
export async function searchKnowledgeBase(
  guildId: string,
  query: string,
  limit: number = 5
): Promise<KnowledgeDocument[]> {
  // Stage 1: PostgreSQL FTS (fast)
  const docs = await prisma.$queryRaw<KnowledgeDocument[]>`
    SELECT id, title, description, content, metadata,
           ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
    FROM knowledge_documents
    WHERE guild_id = ${guildId}
      AND search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit * 2}
  `;

  if (docs.length === 0) return [];

  // Stage 2: LLM reranking (optional, for better relevance)
  // For MVP: skip reranking, just return FTS results
  return docs.slice(0, limit);
}
```

### 4. Answer Generator Service (1.5 hr)
```typescript
// src/services/answer-generator.ts
const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer service assistant for a Discord community.
Answer questions based ONLY on the provided knowledge base documents.
If the answer isn't in the documents, say "I don't have information about that."
Be concise, friendly, and professional.`;

export async function generateAnswer(
  question: string,
  documents: KnowledgeDocument[],
  systemPrompt: string | null,
  openrouter: OpenRouterService
): Promise<GeneratedAnswer> {
  const kbContext = documents
    .map((d, i) => `[Doc ${i + 1}] ${d.title}\n${d.content.slice(0, 2000)}`)
    .join('\n\n');

  const response = await openrouter.chat({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: `Knowledge Base:\n${kbContext}\n\nQuestion: ${question}` }
    ],
    max_tokens: 600,
    temperature: 0.5,
  });

  return {
    answer: response,
    documentIds: documents.map(d => d.id),
    tokensUsed: /* from response metadata */,
  };
}
```

### 5. Message Splitter Utility (30 min)
```typescript
// src/utils/message-splitter.ts
const DISCORD_MAX_LENGTH = 2000;

export function splitMessage(content: string): string[] {
  if (content.length <= DISCORD_MAX_LENGTH) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Find last paragraph/sentence break before limit
    let splitAt = remaining.lastIndexOf('\n\n', DISCORD_MAX_LENGTH);
    if (splitAt === -1) splitAt = remaining.lastIndexOf('. ', DISCORD_MAX_LENGTH);
    if (splitAt === -1) splitAt = remaining.lastIndexOf(' ', DISCORD_MAX_LENGTH);
    if (splitAt === -1) splitAt = DISCORD_MAX_LENGTH;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}
```

### 6. Cooldown Manager (30 min)
```typescript
// src/services/cooldown-manager.ts
const USER_COOLDOWN_MS = 60_000;   // 1 minute per user
const CHANNEL_COOLDOWN_MS = 30_000; // 30 seconds per channel

export class CooldownManager {
  private userCooldowns = new Map<string, number>();
  private channelCooldowns = new Map<string, number>();

  canRespond(userId: string, channelId: string): boolean {
    const now = Date.now();

    const userLast = this.userCooldowns.get(userId) ?? 0;
    if (now - userLast < USER_COOLDOWN_MS) return false;

    const channelLast = this.channelCooldowns.get(channelId) ?? 0;
    if (now - channelLast < CHANNEL_COOLDOWN_MS) return false;

    return true;
  }

  recordResponse(userId: string, channelId: string): void {
    const now = Date.now();
    this.userCooldowns.set(userId, now);
    this.channelCooldowns.set(channelId, now);
  }
}
```

### 7. Auto-Responder Orchestration (1 hr)
```typescript
// src/services/auto-responder.ts
export class AutoResponder {
  constructor(
    private questionDetector: QuestionDetector,
    private semanticSearch: SemanticSearch,
    private answerGenerator: AnswerGenerator,
    private cooldownManager: CooldownManager,
    private openrouter: OpenRouterService
  ) {}

  async processMessage(message: Message): Promise<void> {
    // Skip bots and own messages
    if (message.author.bot) return;

    // Check deduplication
    const existing = await prisma.answeredMessage.findUnique({
      where: { messageId: message.id },
    });
    if (existing) return;

    // Cooldown check
    if (!this.cooldownManager.canRespond(message.author.id, message.channelId)) return;

    // Heuristic gate
    if (!isLikelyQuestion(message.content)) return;

    // LLM validation (for longer messages)
    if (message.content.length > 50 && !message.content.includes('?')) {
      const isQuestion = await this.questionDetector.validate(message.content);
      if (!isQuestion) return;
    }

    // Search KB
    const guildId = message.guildId!;
    const docs = await this.semanticSearch.search(guildId, message.content);

    // Get guild config for system prompt
    const config = await prisma.guildCSConfig.findUnique({ where: { guildId } });

    // Generate answer
    const { answer, documentIds, tokensUsed } = await this.answerGenerator.generate(
      message.content,
      docs,
      config?.systemPrompt ?? null
    );

    // Split and reply
    const chunks = splitMessage(answer);
    for (const chunk of chunks) {
      await message.reply({
        content: chunk,
        allowedMentions: { repliedUser: false },
      });
    }

    // Record response
    this.cooldownManager.recordResponse(message.author.id, message.channelId);

    // Log to database
    await prisma.answeredMessage.create({
      data: {
        guildId,
        channelId: message.channelId,
        messageId: message.id,
        documentIds,
        question: message.content,
        answer,
        tokensUsed,
      },
    });

    // Log LLM usage
    await prisma.lLMUsageLog.create({
      data: {
        guildId,
        model: 'google/gemini-2.5-flash',
        tokens: tokensUsed,
        cost: tokensUsed * 0.000001, // Approximate cost
        operation: 'answer_generation',
      },
    });
  }
}
```

---

## Todo List

- [ ] Add AnsweredMessage model to Prisma schema
- [ ] Add LLMUsageLog model to Prisma schema
- [ ] Run database migration
- [ ] Create question-detector service
- [ ] Create semantic-search service with FTS
- [ ] Create answer-generator service
- [ ] Create message-splitter utility
- [ ] Create cooldown-manager service
- [ ] Create auto-responder orchestration
- [ ] Integrate with polling manager (Phase 08)
- [ ] Add error handling and retry logic
- [ ] Write unit tests for each service
- [ ] Write integration test for full pipeline

---

## Success Criteria

- [ ] Heuristic gate filters 70%+ non-questions
- [ ] LLM validation catches ambiguous questions
- [ ] Semantic search returns relevant docs in <100ms
- [ ] Answers generated in <3s
- [ ] Long answers split correctly at paragraph boundaries
- [ ] Deduplication prevents double replies
- [ ] Cooldowns prevent spam
- [ ] Token usage logged per guild

---

## Security Considerations

- Sanitize KB content before including in LLM prompt
- Rate limit LLM calls per guild (prevent abuse)
- Log and monitor for prompt injection attempts
- No PII in LLM logs

---

## Error Handling

```typescript
try {
  await this.processMessage(message);
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // OpenRouter rate limit - exponential backoff
    await sleep(error.retryAfter * 1000);
    return this.processMessage(message);
  }

  if (error.code === 50013) {
    // Discord: Missing Permissions
    logger.warn('Cannot reply - missing permissions', { channelId: message.channelId });
    return;
  }

  logger.error('Auto-response failed', { error, messageId: message.id });
}
```

---

## Next Steps

After completion, proceed to [Phase 10: Dashboard](./phase-10-dashboard.md)
