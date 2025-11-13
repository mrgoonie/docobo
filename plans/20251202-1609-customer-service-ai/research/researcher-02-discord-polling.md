# Discord Channel Polling & Auto-Response Research

**Date:** 2025-12-02
**Focus:** Discord.js v14 channel polling, question detection, auto-response patterns, scheduled tasks

---

## 1. Message Polling in Discord.js v14

### API Methods & Core Pattern
- **Primary method:** `channel.messages.fetch(options)` with pagination
- **v14 API change:** Second parameter removed; options merged: `fetch({ message: 'id', cache: false, force: true })`
- **Rate limit:** Discord enforces 100 message limit per fetch call
- **Pagination pattern:** Use `before` parameter to fetch older batches (set to last message ID from previous fetch)

### Fetching Multiple Messages (>100)
```javascript
// Batch fetching with pagination
async function fetchRecentMessages(channel, limit = 500) {
  let messages = [];
  let lastId;

  while (messages.length < limit) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      ...(lastId && { before: lastId })
    });
    if (fetched.size === 0) break;

    messages = [...messages, ...fetched.values()];
    lastId = fetched.last().id;
  }
  return messages.slice(0, limit);
}
```

### Rate Limit Considerations
- **Per-endpoint:** 5 requests per 5 seconds per channel is safe
- **Abuse threshold:** 5+ messages in <1-2 seconds triggers rate limiting for minutes
- **Auto-handling:** Discord.js v14 has built-in REST rate limit handling (respects 429 responses)
- **Caching strategy:** Check `channel.messages.cache` before fetching; avoid redundant API calls

### Efficient Polling Intervals
- **Recommended:** 2-5 minute intervals for customer service scenarios (balance freshness vs rate limits)
- **Per-guild coordination:** Track last polled message ID per channel to avoid re-fetching
- **Webhook alternative:** If possible, use Discord webhooks instead of polling (Discord pushes data)

---

## 2. Question Detection Strategies

### Simple Heuristics (No LLM)
**When to use:** Fast, zero-cost filtering before LLM round-trip
- **Question mark presence:** `message.content.includes('?')`
- **Question keywords:** Regex for "what", "why", "how", "who", "when", "where", "does", "can", "will"
- **Multi-message handling:** Track conversation threads; check if message is reply to another message

```javascript
function isLikelyQuestion(content) {
  // Quick heuristic filter
  const questionPatterns = /\b(what|why|how|who|when|where|does|can|will|should)\b/i;
  return content.includes('?') || questionPatterns.test(content);
}
```

### When to Invoke LLM
- **After heuristic gate:** Only pass heuristic-positive messages to LLM
- **Reduces LLM calls:** 70-80% of messages filtered by simple regex, saves cost & latency
- **Example:** If message has `?` mark OR matches question keywords, then send to LLM for confidence scoring

### Multi-Message Conversations
- **Discord threads:** Use `message.hasThread` and `message.thread.messages` to track context
- **Reply chains:** Check `message.reference` to link messages in same conversation
- **Context window:** Keep last 5-10 messages for conversation history

---

## 3. Auto-Response Patterns

### Reply vs New Message
- **Reply pattern (recommended):** `message.reply({ content: 'answer' })`
  - Automatically mentions author, maintains conversation threading
  - Shows reply context in Discord UI
- **New message:** `channel.send()` - Use only for announcements/broadcasts

### Avoiding Spam & Reputation Damage
1. **Never reply to own messages:** Check `if (message.author.id === client.user.id) return;`
2. **Skip bot messages:** `if (message.author.bot) return;`
3. **Cooldown per user:** 60-300 second window (don't respond to same user twice in minutes)
4. **Per-channel rate limiting:** Max 1 response per 30-60 seconds per channel (prevents flood)

```javascript
// Cooldown map: userId -> lastResponseTime
const userCooldowns = new Map();
const COOLDOWN_MS = 60000; // 1 minute

async function autoRespond(message) {
  if (message.author.bot) return;

  const now = Date.now();
  const lastResponse = userCooldowns.get(message.author.id) || 0;

  if (now - lastResponse < COOLDOWN_MS) return;

  // Process response...
  userCooldowns.set(message.author.id, now);
}
```

### Mention Etiquette
- **Use reply mentions:** Automatic with `.reply()`, don't manually add mentions
- **Discord AutoMod:** Built-in mention spam filter flags excessive @role/@user mentions (>50)
- **Avoid ping fatigue:** Keep mentions minimal; Discord's reply system handles notification

---

## 4. Scheduled Task Approaches

### Comparison Matrix

| Approach | Use Case | Persistence | Horizontal Scaling | Learning Curve |
|----------|----------|-------------|-------------------|-----------------|
| **setInterval** | Single process, simple tasks | No | Poor | Trivial |
| **node-cron** | Cron-based scheduling, low volume | No | Poor | Easy |
| **BullMQ** | High-volume, distributed jobs, retries | Redis | Excellent | Medium |
| **Agenda** | Database-persisted jobs | MongoDB | Good | Easy |

### setInterval (Simple Polling)
```javascript
setInterval(async () => {
  for (const [guildId, channels] of guildConfigs) {
    for (const channel of channels) {
      await pollChannel(channel);
    }
  }
}, 300000); // 5 minutes
```
**Pros:** No dependencies
**Cons:** Not persistent, no retries, poor error handling

### node-cron (Cron-Based)
```javascript
const cron = require('node-cron');

// Poll every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  await pollAllChannels();
});
```
**Pros:** Familiar cron syntax, minimal setup
**Cons:** Single-process only, no persistence

### BullMQ (Production-Grade)
```javascript
const Queue = require('bullmq').Queue;
const Worker = require('bullmq').Worker;

const pollQueue = new Queue('channel-polling', { connection: redis });

// Schedule repeating job
await pollQueue.add('poll-channels', {}, {
  repeat: { pattern: '*/5 * * * *' } // Every 5 minutes
});

// Worker processes jobs
new Worker('channel-polling', async (job) => {
  await pollAllChannels();
}, { connection: redis });
```
**Pros:** Distributed, persists jobs, retries, horizontal scaling
**Cons:** Requires Redis

### Per-Guild Coordination
- **Track state:** Store `lastPolledMessageId` per channel in database
- **Prevent duplicates:** Only process messages after stored ID
- **Error recovery:** If polling fails, retry same batch on next interval

```javascript
async function pollChannel(channel) {
  const lastId = await getLastPolledId(channel.id);

  const messages = await channel.messages.fetch({
    limit: 100,
    ...(lastId && { after: lastId })
  });

  for (const msg of messages.values()) {
    await processMessage(msg);
    await updateLastPolledId(channel.id, msg.id);
  }
}
```

### Graceful Shutdown
```javascript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');

  // Stop polling
  clearInterval(pollingInterval);

  // Wait for in-flight operations
  await Promise.all(pendingResponses);

  // Disconnect bot
  await client.destroy();
  process.exit(0);
});
```

---

## Key Recommendations

1. **Polling interval:** 3-5 minutes balances freshness and API quota; start at 5 minutes
2. **Question detection:** Heuristic gate first (cheap), LLM validation second (expensive)
3. **Task scheduler:** `setInterval` for MVP, migrate to BullMQ for production multi-guild scale
4. **Cooldowns:** Per-user (1 min), per-channel (30-60s) to prevent reputation damage
5. **Rate limits:** Monitor `client.rest.requestManager` response codes; back off on 429s
6. **Caching:** Always check `channel.messages.cache` before `.fetch()` calls
7. **Reply pattern:** Use `.reply()` not `.send()` for auto-responses (threading, mentions)
8. **Guild coordination:** Track polled message IDs in database; resume from last checkpoint

---

## Code Examples

### Minimal Polling + Auto-Response Loop
```javascript
const { Client, ChannelType, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const polledChannels = new Map(); // channelId -> lastMessageId

client.once('ready', () => {
  console.log('Bot ready, starting polling...');

  // Poll every 5 minutes
  setInterval(pollChannels, 300000);
});

async function pollChannels() {
  for (const [guildId, guild] of client.guilds.cache) {
    for (const [channelId, channel] of guild.channels.cache) {
      if (channel.type !== ChannelType.GuildText) continue;

      await pollChannel(channel);
    }
  }
}

async function pollChannel(channel) {
  try {
    const lastId = polledChannels.get(channel.id);

    const messages = await channel.messages.fetch({
      limit: 50,
      ...(lastId && { after: lastId })
    });

    if (messages.size === 0) return;

    for (const msg of messages.values()) {
      if (msg.author.bot) continue;
      if (!isLikelyQuestion(msg.content)) continue;

      // Auto-respond to questions
      await msg.reply({
        content: 'Checking knowledge base...',
        allowedMentions: { repliedUser: false }
      });
    }

    // Track last polled
    polledChannels.set(channel.id, messages.last().id);
  } catch (err) {
    console.error(`Error polling ${channel.id}:`, err.message);
  }
}

function isLikelyQuestion(content) {
  return /[?]\s*$/.test(content) || /\b(what|how|why|can|will)\b/i.test(content);
}

client.login(process.env.DISCORD_TOKEN);
```

---

## Sources

- [Command response methods | discord.js Guide](https://discordjs.guide/slash-commands/response-methods.html)
- [Updating from v13 to v14 | discord.js Guide](https://discordjs.guide/additional-info/changes-in-v14.html)
- [Rate Limits & API Optimization | discordjs/discord.js | DeepWiki](https://deepwiki.com/discordjs/discord.js/5.3-rate-limits-and-api-optimization)
- [Discord Developer Portal - Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- [Job Scheduling in Node.js with BullMQ | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [Comparing the best Node.js schedulers - LogRocket Blog](https://blog.logrocket.com/comparing-best-node-js-schedulers/)
- [Filter Messages Using Regular Expressions (Regex) – Discord](https://support.discord.com/hc/en-us/articles/10069840290711-Filter-Messages-Using-Regular-Expressions-Regex)
- [Building a Discord Question-Answer Bot: My Personal Studying Assistant | Medium](https://medium.com/@wxxq84/building-a-discord-question-answer-bot-a57666979c3d)
- [Discord Anti-Spam Module - npm](https://www.npmjs.com/package/discord-anti-spam)
- [AutoMod FAQ – Discord](https://support.discord.com/hc/en-us/articles/4421269296535-AutoMod-FAQ)

---

**Report Status:** Complete
**Unresolved Questions:** None - all research topics adequately covered
