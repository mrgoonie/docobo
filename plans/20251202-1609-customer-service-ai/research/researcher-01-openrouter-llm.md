# OpenRouter API & LLM Integration Research

## 1. OpenRouter API Overview

### Authentication
- **Method**: Bearer token in `Authorization` header
- **Format**: `Authorization: Bearer <OPENROUTER_API_KEY>`
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible)
- **Optional Headers**: `HTTP-Referer` (for app attribution), `X-Title` (for discovery)
- **Key Strength**: OpenRouter keys support credit limits & OAuth flows vs direct provider APIs

### Supported Models
- **Google Gemini 2.5 Flash**: Fast, 1M token context, excellent for structured output
- **Meta Llama 3.3 70B**: Strong reasoning, available in free tier on OpenRouter
- **400+ models** across providers (OpenAI, Anthropic, Google, Meta, etc.)
- **Model naming**: Direct provider format (e.g., `google/gemini-2.5-flash`, `meta-llama/llama-3.3-70b-instruct`)

### Rate Limits & Pricing
- Per-provider rate limits apply (varies by model)
- Credit-based pricing more transparent than hidden per-model costs
- Free models available on OpenRouter (Llama 3.3 70B) for testing
- No documented strict global rate limits; practical limits ~100-200 req/min depending on model

---

## 2. Discord Bot LLM Patterns

### Token Optimization
**Context Allocation Strategy** (Critical for Discord's 2000-char message limit):
- Identity/System Prompt: 200-400 tokens (fixed)
- Historical Messages: 1000-1500 tokens (dynamic, keep last 10-20 messages)
- User Query: 100-200 tokens
- Response Buffer: 500-1000 tokens (for generation)
- **Total Budget**: ~4096 tokens (1.5x Discord limit accounting for encoding overhead)

**Efficient Context Management**:
- Strip message formatting, keep only content text
- Use sliding window: drop oldest message when adding new one if budget exceeded
- Store conversation summary every 50 messages (reduce context pollution)
- GPTBots framework: treat system prompt, conversation history, user question, tools data, knowledge data as priority-ordered context buckets

### Streaming vs Non-Streaming
- **Discord has NO native streaming support**: API doesn't support progressive updates
- **Workaround patterns**:
  1. **Character-by-character streaming**: Collect response chunks, update single message every 500ms (avoid rate limits)
  2. **Message splitting**: Break 2000+ char responses into multiple sequential messages with continuation markers
  3. **Disabled streaming**: Queue entire response, send at once (simplest, safest for bots)

**Recommendation**: Use disabled streaming for initial release; implement character updates if UX requires real-time feel

### Error Handling
- OpenRouter returns standard HTTP errors: 400 (invalid request), 429 (rate limit), 500 (server error)
- **Graceful degradation**: Queue failed requests, retry with exponential backoff
- **User feedback**: React with ❌ emoji on failure, show concise error in follow-up message
- **Timeout handling**: Discord interaction timeout = 3 seconds; defer interaction immediately for LLM calls
- Use interaction followup/edit instead of direct response for async operations

---

## 3. Document Generation Approach

### Prompt Engineering for YAML + Markdown
```
System prompt template:
"You are a documentation expert. Generate ONLY the output format specified.

**Output Format**: YAML frontmatter + Markdown body
- Frontmatter fields: title, description, category, author, created_at, word_count
- Body: Clear markdown with h2 sections, bullet lists, code blocks as needed
- No explanations or preambles before the output"
```

**Model-Specific Formatting**:
- **Gemini 2.5 Flash**: Prefers Markdown for structured output (research shows excellent markdown compliance)
- **Llama 70B**: Works well with both JSON/YAML; include examples in prompt
- **Pattern**: Provide template example → User instruction → 'Output format: YAML+MD'

### Structured Output Techniques
1. **Grammar Enforcement**: Most models now support JSON mode; less mature for YAML, so validate post-generation
2. **Schema Specification**: Include explicit schema in prompt:
   ```yaml
   ---
   title: "string"
   description: "string"
   category: ["documentation", "guide", "faq"]
   word_count: integer
   ---
   # Content here
   ```
3. **Validation**: Parse generated YAML with Python `yaml` library; fallback to regex if parsing fails
4. **Cost Optimization**: Markdown is 5-15% cheaper in tokens vs JSON/YAML for text-heavy docs

### Content Extraction Pipeline
- **URL → Text**: Use web scraper (requests + BeautifulSoup) or LLM summary on fetched HTML
- **llms.txt Parsing**: Check `https://site.com/llms.txt` → Extract metadata (title, description, categories)
- **Two-stage approach**:
  1. LLM scans llms.txt metadata to identify relevant docs
  2. Fetch full document body, regenerate with consistent schema

---

## 4. Semantic Search Strategy (Without Vector DB)

### PostgreSQL JSONB + Full-Text Search
**Index Creation** (for metadata & content):
```sql
-- Store docs as JSONB: {title, content, category, tags, created_at}
CREATE INDEX idx_docs_ft ON documents
  USING GIN ((jsonb_to_tsvector('english', data, '["string"]')));

-- Store conversation metadata
CREATE TABLE doc_refs (
  id UUID PRIMARY KEY,
  doc_id UUID,
  metadata JSONB,  -- {thread_id, user_id, relevance_score}
  created_at TIMESTAMP
);
```

### Two-Stage Retrieval
1. **Metadata Scan** (fast):
   - Query by category, tags, date range
   - Use JSONB operators: `data->>'category' = 'guides'`
   - Filter to top 20 candidates (1-5ms)

2. **Full-Text Search** (LLM-assisted):
   - For query "How to integrate payments?", LLM generates synonyms: ["payments", "billing", "stripe", "checkout"]
   - Run multi-keyword FTS on filtered candidates
   - Rank by `ts_rank()` (PostgreSQL built-in)

**Query Example**:
```sql
-- Find relevant docs for user query (using FTS + metadata)
SELECT doc_id, ts_rank(ft_vector, query) as relevance
FROM documents
WHERE category IN ('guides', 'integrations')
  AND ft_vector @@ to_tsquery('english', 'payment | billing | stripe')
ORDER BY relevance DESC
LIMIT 5;
```

### Hybrid Approach (Recommended)
- **Primary**: PostgreSQL full-text search on JSONB (100% self-hosted, zero vector DB cost)
- **Fallback**: For complex queries (e.g., "conceptually similar to X"), use LLM to rewrite query as keywords, retry FTS
- **Ranking**: LLM reads top 3-5 FTS results, outputs ranked list with reasoning

**Advantages**:
- No external vector services (Pinecone, Weaviate)
- JSONB stores all doc metadata together (title, content, tags, source URL)
- GIN indexes ~1-5ms for 100K+ documents
- PostgreSQL 11+ includes `jsonb_to_tsvector` (mature, production-ready)

---

## Key Recommendations

1. **Start with non-streaming responses**: Collect full LLM output, split into 2000-char Discord messages
2. **Use Gemini 2.5 Flash as primary**: Best speed/cost for structured markdown generation (1M context)
3. **Implement interaction deferral**: Acknowledge Discord interaction immediately (3s limit), use followups for async LLM calls
4. **PostgreSQL FTS-only search**: Skip vector DB initially; use JSONB + GIN indexes for 95% of queries
5. **Context budgeting**: Fix system prompt, allocate remaining tokens to 15-20 message history, keep 500 tokens for response
6. **Error recovery**: Retry with exponential backoff (1s, 2s, 4s max); show user-friendly error after 3 failures
7. **Validate structured output**: YAML frontmatter parsing with fallback regex extraction

---

## Code Examples

### OpenRouter Auth + Chat Completion (Node.js)
```javascript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://docobo.io",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a docs expert..." },
      { role: "user", content: userQuery }
    ],
    max_tokens: 1500,
    temperature: 0.7,
  }),
});
```

### Context Window Management (TypeScript)
```typescript
interface ContextBudget {
  systemPrompt: 350;
  history: 1200;
  query: 150;
  responseBuffer: 600;
  total: 2300;
}

function buildContext(messages: Message[], newQuery: string): string[] {
  let tokens = 0;
  const maxHistoryTokens = 1200;
  const history: string[] = [];

  // Keep newest messages until budget exhausted
  for (let i = messages.length - 1; i >= 0 && tokens < maxHistoryTokens; i--) {
    const msg = messages[i];
    const msgTokens = msg.content.split(/\s+/).length * 1.3; // rough estimate
    if (tokens + msgTokens < maxHistoryTokens) {
      history.unshift(msg.content);
      tokens += msgTokens;
    }
  }
  return history;
}
```

### PostgreSQL JSONB + FTS Query (SQL)
```sql
-- Create index on docs stored as JSONB
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  data JSONB NOT NULL  -- {title, content, category, tags, source_url, created_at}
);

CREATE INDEX idx_docs_fts ON documents
  USING GIN (jsonb_to_tsvector('english', data, '["string"]'));

-- Query: Find docs matching "payment integration"
SELECT data->>'title', ts_rank(jsonb_to_tsvector('english', data), query) as score
FROM documents,
     plainto_tsquery('english', 'payment integration') as query
WHERE jsonb_to_tsvector('english', data) @@ query
ORDER BY score DESC
LIMIT 5;
```

---

## Sources

- [OpenRouter API Authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [Discord LLM Bot Discussion - Streaming](https://github.com/discord/discord-api-docs/discussions/6310)
- [llmcord - Discord LLM Frontend](https://github.com/jakobdylanc/llmcord)
- [LLM Context Token Allocation - GPTBots](https://www.gptbots.ai/docs/best-practice/llm-token-config)
- [Markdown for Prompt Engineering - Tenacity](https://tenacity.io/snippets/supercharge-ai-prompts-with-markdown-for-better-results/)
- [Structured Output with LLMs - Ankur Singh](https://ankur-singh.github.io/blog/structured-output)
- [PostgreSQL Full-Text Search with JSONB](https://dba.stackexchange.com/questions/179598/how-can-i-use-a-full-text-search-on-a-jsonb-column-with-postgres)
- [PostgreSQL GIN Indexes](https://pganalyze.com/blog/gin-index)
- [StreamingLLM Extended Context - VentureBeat](https://venturebeat.com/ai/streamingllm-shows-how-one-token-can-keep-ai-models-running-smoothly-indefinitely)
