# Discord Bot UX & Onboarding Patterns Research

## 1. EMBED DESIGN BEST PRACTICES

### Core Specifications
- **Max embeds per message**: 10 [1]
- **Image optimization**: Host images online vs repeated attachments for faster responses [1]
- **Internal references**: Use `attachment://fileName.extension` for embed images [1]

### Design Tools & Utilities
- **EmbedBuilder** (discord.js): Standard utility for embed construction [1]
- **Embed Visualizer**: Preview tool for designing embeds before implementation [1]
- **Message.style**: No-code embed generator [1]

### Visual Hierarchy
- Use embeds for structured information display
- Leverage fields for key-value pairs
- Apply color coding for status/category identification
- Include thumbnails/images sparingly to avoid visual clutter

**Sources**: [1] discordjs.guide, [2] discord.js documentation

---

## 2. INTERACTIVE COMPONENT PATTERNS

### Component Types & Constraints

**Buttons** [3]
- Type: Clickable (type: 2)
- Styles: Primary, Secondary, Success, Danger, Link
- Width: 1 unit per button
- Customizable with text + emoji

**Select Menus** [3]
- Static: Developer-defined options with labels/descriptions
- Dynamic: User, Role, Channel, Mentionable (auto-populated)
- Width: 5 units (full row)
- String selects now supported in modals [3]

**Modals** [3]
- Pop-up forms for structured user input
- Callback structure (not standalone component)
- Support for String Selects + top-level Label component with descriptions

### Action Rows [3]
- **Max per message**: 5 rows
- **Width system**: 5 units per row
  - Button = 1 unit
  - Select menu = 5 units (entire row)
- Pack efficiently: 5 buttons OR 1 select per row

### Custom IDs & Interaction Handling [3]
- Define `custom_id` in component payload
- Received in interaction payload on user action
- **Critical timing**: All interactions require response within 3 seconds or fail [3]
- Use unique IDs for tracking component state

### Response Patterns [3,8]
- **Immediate ACK**: Respond with "Processing..." then update
- **Ephemeral messages**: Error messages should be user-specific
- **Lambda pattern**: ACK → process → update for long operations [8]

**Sources**: [3] Discord Developer Docs, [8] GitHub discussions

---

## 3. STEP-BY-STEP SETUP FLOWS

### Onboarding Critical Window
- **15-minute rule**: Get users chatting within first 15 min or lose them [4]
- Avoid overwhelming walls of text in welcome messages [4]

### Progressive Disclosure Pattern [4]
1. Ask about user skills/interests
2. Assign relevant roles automatically
3. Link to appropriate channels
4. Avoid one-size-fits-all messaging

### Decision Tree Architecture [4]
- Map all information, options, responses upfront
- Branch based on user selections
- Use select menus for multi-option choices
- Buttons for binary/simple decisions

### Gamification & AI Assistance [4]
- Allow Q&A about community via bot
- Create game-like learning experience
- Reduce bot-powered verification friction
- Grant roles/channels from start (leverage Community Onboarding)

### Technical Frameworks [4]
- discord.js (Node.js)
- nextcord/Pycord (Python)
- Both effective for server communication flows

**Sources**: [4] Alloverse, CommunityOne blog, Discord Community guides

---

## 4. ERROR MESSAGING & USER FEEDBACK

### Error Handler Hierarchy [7]

**Per-Command** (most specific)
```python
@command.error
async def handle_error(ctx, error):
    # Handle command-specific errors
```

**Per-Cog** (grouped commands)
```python
def cog_command_error(ctx, error):
    # Handle errors for all commands in cog
```

**Global** (bot-wide)
```python
@bot.event
async def on_application_command_error(ctx, error):
    # Centralized error handling
```

### Feedback Message Patterns [7,8]

**Success**: "Thanks for the feedback! Received: `Great bot!`" [7]
**Timeout**: "Timed out, please try again!" [7]
**Permission**: "Sorry, only the bot owner can use this command!" [7]
**Cooldown**: "This command is currently on cooldown!" [7]
**Platform improvements**: "This command is outdated, please try again in a few minutes" [8]

### Best Practices [7,8]
- Use ephemeral messages for user-specific errors [8]
- Re-raise unhandled errors for upstream handlers [7]
- Check error types with `isinstance()` [7]
- Provide actionable error messages with specifics (e.g., range values) [8]
- Distinguish slash commands (`on_application_command_error`) from prefix commands (`on_command_error`) [7]

**Sources**: [7] Pycord Guide, [8] Discord API GitHub discussions

---

## 5. PERMISSION CONFIGURATION GUIDANCE

### Permission Types [5]
- **BitFields**: Binary representation
- **Base Permissions**: Role level (guild-wide)
- **Final Permissions**: After all overwrites applied
- **Flags**: Human-readable PascalCase (e.g., `KickMembers`)

### Configuration Patterns [5]

**Default Command Permissions**
```js
SlashCommandBuilder#setDefaultMemberPermissions()
// Set to 0 = prohibit unless overwrite/Administrator
```

**Combining Permissions** (bitwise OR)
```js
PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
```

### Security Best Practices [5]
- **Least privilege principle**: Grant only necessary permissions
- Avoid Administrator flag unless absolutely required
- Check bot permissions before command execution
- Provide informative error messages when permissions missing

### Permission Hierarchy [5]
1. Global rules (owner-set) checked first
2. Server-specific rules
3. Default command restrictions

**Sources**: [5] discord.js Guide

---

## 6. DASHBOARD/WEB PANEL DESIGNS

### No-Code Solutions
- **BotPanel**: Customize bots without coding, configurable dashboard [6]
- **Discord BOT Dashboard V2**: Build applications without writing code [6]

### Open Source Templates [6]

**D-Dash**
- Full-featured template
- Chakra UI design system
- Localization support
- Configurable via `config.js`
- Built-in features/actions system

**discord-panel**
- Intuitive, user-friendly design
- Minimal learning curve for developers

**discord-dashboard** (npm)
- Easy API abstraction
- No API knowledge required
- Simple configuration

### Common Configuration Features [6]
- **Features**: Enable/disable toggles, customizable options
- **Actions**: Multi-task workflows with publish/delete capabilities
- **Server selection**: Guild picker with OAuth integration

### Technical Stack [6]
- Express.js for routing
- discord.js for bot integration
- Native Node.js modules (path, url) for templating
- Template engines (EJS, Pug common choices)

**Sources**: [6] BotPanel, GitHub repos (fuma-nama, MetaTHC, Notavone)

---

## KEY TAKEAWAYS

1. **3-second interaction rule** is non-negotiable—ACK immediately [3]
2. **First 15 minutes** determine user retention [4]
3. **Progressive disclosure** > walls of text [4]
4. **Ephemeral errors** for user-specific feedback [8]
5. **Least privilege** for permissions always [5]
6. **Action rows** have strict 5-unit width constraint [3]
7. **Host images** externally for repeated embed use [1]
8. **Multi-level error handlers** for maintainability [7]

---

## UNRESOLVED QUESTIONS

1. Official Discord guidelines on embed color psychology/accessibility?
2. Recommended select menu option limits for mobile UX?
3. Best practices for modal form validation feedback loops?
4. OAuth flow patterns for dashboard authentication (security recommendations)?
5. Metrics/analytics patterns for measuring onboarding success rates?

---

## SOURCES

[1] discord.js Guide - Embeds (discordjs.guide/popular-topics/embeds.html)
[2] Message.style Embed Generator (message.style)
[3] Discord Developer Docs - Components Overview (discord.com/developers/docs)
[4] Alloverse - Creating Discord Onboarding Bot (alloverse.com/2022/11/08)
[5] discord.js Guide - Permissions (discordjs.guide/popular-topics/permissions)
[6] GitHub - discord-bot-dashboard topics (github.com/topics/discord-bot-dashboard)
[7] Pycord Guide - Error Handling (guide.pycord.dev/popular-topics/error-handling)
[8] Discord API GitHub Discussions - Error Messages (#4615, #4041)
[9] CommunityOne - Discord User Onboarding (blog.communityone.io)
[10] Discord Community - Onboarding New Members (discord.com/community)
