# Phase 08: Channel Tracking + Polling

**Parent**: [Customer Service AI Plan](./plan.md)
**Dependencies**: Phase 07 (Knowledge Base)
**Date**: 2025-12-02 | **Priority**: HIGH | **Status**: PENDING

---

## Overview

Enable per-guild channel tracking with configurable polling intervals. Track which channels to monitor for customer service questions.

---

## Key Insights (From Research)

- **Discord.js v14**: `channel.messages.fetch({ limit: 100, after: lastId })`
- **Rate limit**: 5 requests per 5 seconds per channel is safe
- **Polling interval**: 2-5 min balances freshness vs API quota
- **Track last polled ID**: Store per channel to avoid re-fetching
- **Graceful shutdown**: Clear intervals, wait for in-flight operations

---

## Requirements

1. `/cs channels add <#channel>` - Add channel to tracking
2. `/cs channels remove <#channel>` - Remove channel
3. `/cs channels list` - Show tracked channels
4. `/cs config interval <2|5>` - Set polling interval
5. `/cs config enable|disable` - Toggle CS feature
6. Polling loop with per-guild interval configuration

---

## Database Schema

```prisma
model TrackedChannel {
  id        String   @id @default(cuid())
  guildId   String
  guild     Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)
  channelId String   @db.VarChar(20)

  enabled   Boolean  @default(true)
  lastPolledMessageId String? @db.VarChar(20)  // Resume from here

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([guildId, channelId])
  @@index([guildId])
  @@map("tracked_channels")
}

model GuildCSConfig {
  id              String   @id @default(cuid())
  guildId         String   @unique
  guild           Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)

  pollingInterval Int      @default(5) // minutes: 2 or 5
  systemPrompt    String?  @db.Text    // Custom bot personality
  enabled         Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("guild_cs_configs")
}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Polling Manager                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Guild A    │  │  Guild B    │  │  Guild C    │  │
│  │  interval:2 │  │  interval:5 │  │  interval:2 │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │          │
│         └────────────────┼────────────────┘          │
│                          ▼                           │
│                  ┌──────────────┐                    │
│                  │ Poll Executor│                    │
│                  └──────┬───────┘                    │
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │   Per-Channel Message Fetch   │
           │   channel.messages.fetch()    │
           └──────────────┬───────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │   Question Detection Queue    │
           │   (Phase 09)                  │
           └──────────────────────────────┘
```

---

## Related Files

- `src/bot/commands/cs.ts` - Slash command (subcommands)
- `src/services/polling-manager.ts` - Interval management
- `src/services/channel-tracker.ts` - Channel CRUD
- `src/types/cs-config.ts` - TypeScript interfaces
- `prisma/schema.prisma` - Database models

---

## Implementation Steps

### 1. Database Migration (20 min)
- Add `TrackedChannel` and `GuildCSConfig` models
- Add relations to existing `Guild` model
- Run migration

### 2. Channel Tracker Service (45 min)
```typescript
// src/services/channel-tracker.ts
export class ChannelTracker {
  async addChannel(guildId: string, channelId: string): Promise<TrackedChannel> {
    return prisma.trackedChannel.upsert({
      where: { guildId_channelId: { guildId, channelId } },
      create: { guildId, channelId },
      update: { enabled: true },
    });
  }

  async getTrackedChannels(guildId: string): Promise<TrackedChannel[]> {
    return prisma.trackedChannel.findMany({
      where: { guildId, enabled: true },
    });
  }

  async updateLastPolled(channelId: string, messageId: string): Promise<void> {
    await prisma.trackedChannel.update({
      where: { channelId },
      data: { lastPolledMessageId: messageId },
    });
  }
}
```

### 3. Polling Manager (1.5 hr)
```typescript
// src/services/polling-manager.ts
export class PollingManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map(); // guildId -> interval

  async start(client: Client): Promise<void> {
    const guilds = await prisma.guildCSConfig.findMany({ where: { enabled: true } });
    for (const config of guilds) {
      this.scheduleGuild(client, config.guildId, config.pollingInterval);
    }
  }

  scheduleGuild(client: Client, guildId: string, intervalMinutes: number): void {
    // Clear existing interval if any
    this.clearGuild(guildId);

    const ms = intervalMinutes * 60 * 1000;
    const interval = setInterval(() => void this.pollGuild(client, guildId), ms);
    this.intervals.set(guildId, interval);
  }

  async pollGuild(client: Client, guildId: string): Promise<void> {
    const channels = await prisma.trackedChannel.findMany({
      where: { guildId, enabled: true },
    });

    for (const tc of channels) {
      await this.pollChannel(client, tc);
      await sleep(1000); // Rate limit protection
    }
  }

  async pollChannel(client: Client, tc: TrackedChannel): Promise<void> {
    const channel = await client.channels.fetch(tc.channelId);
    if (!channel?.isTextBased()) return;

    const messages = await channel.messages.fetch({
      limit: 50,
      ...(tc.lastPolledMessageId && { after: tc.lastPolledMessageId }),
    });

    if (messages.size === 0) return;

    // Queue messages for question detection (Phase 09)
    for (const msg of messages.values()) {
      if (!msg.author.bot) {
        await questionQueue.add(msg);
      }
    }

    // Update last polled
    const newestId = messages.first()?.id;
    if (newestId) {
      await prisma.trackedChannel.update({
        where: { id: tc.id },
        data: { lastPolledMessageId: newestId },
      });
    }
  }

  clearGuild(guildId: string): void {
    const interval = this.intervals.get(guildId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(guildId);
    }
  }

  shutdown(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}
```

### 4. Slash Commands (1 hr)
- `/cs channels add #channel` - Add with confirmation embed
- `/cs channels remove #channel` - Remove with confirmation
- `/cs channels list` - Paginated embed list
- `/cs config interval 2|5` - Dropdown select
- `/cs config enable|disable` - Toggle button

### 5. Bot Lifecycle Integration (30 min)
- Start polling on `ClientReady` event
- Graceful shutdown on SIGTERM/SIGINT
- Reschedule on config change

---

## Todo List

- [ ] Add TrackedChannel model to Prisma schema
- [ ] Add GuildCSConfig model to Prisma schema
- [ ] Update Guild model with new relations
- [ ] Run database migration
- [ ] Create channel-tracker service
- [ ] Create polling-manager service
- [ ] Implement /cs channels add command
- [ ] Implement /cs channels remove command
- [ ] Implement /cs channels list command
- [ ] Implement /cs config interval command
- [ ] Implement /cs config enable/disable command
- [ ] Integrate polling start on ClientReady
- [ ] Add graceful shutdown handler
- [ ] Write unit tests

---

## Success Criteria

- [ ] Channels tracked per guild with enable/disable
- [ ] Polling runs at configured interval (2 or 5 min)
- [ ] Polling resumes from last message ID after restart
- [ ] Graceful shutdown waits for in-flight polls
- [ ] Rate limits respected (no 429 errors)

---

## Security Considerations

- Validate channel is in same guild
- Check bot has `ViewChannel` and `ReadMessageHistory` permissions
- Admin-only for channel/config commands

---

## Next Steps

After completion, proceed to [Phase 09: Auto-Response](./phase-09-auto-response.md)
