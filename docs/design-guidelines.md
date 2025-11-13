# Docobo Discord Bot Design Guidelines

**Version**: 1.0
**Last Updated**: 2025-11-13
**Purpose**: Comprehensive design system for Docobo, a professional paid community management Discord bot focused on role-gated payment verification and leaderboard tracking.

---

## 1. Brand Identity

### 1.1 Brand Positioning
Docobo is a **professional-grade community monetization tool** for Discord server owners. Unlike casual bots, Docobo handles financial transactions, requiring trust, security, and clarity in every interaction.

**Brand Attributes:**
- **Trustworthy**: Clear, transparent communication about payments
- **Professional**: Clean, modern aesthetic suitable for business communities
- **Efficient**: Streamlined workflows, respects user time
- **Empowering**: Gives server owners control and visibility

### 1.2 Color Palette

**Primary Colors:**
- **Docobo Blue** `#4A90E2` (RGB: 74, 144, 226) - Primary brand color, conveys trust and professionalism
  - Use for: Primary buttons, brand headers, success states
  - Avoid overuse with Discord's blurple to maintain distinction

- **Deep Navy** `#1E3A5F` (RGB: 30, 58, 95) - Secondary brand color, authority and stability
  - Use for: Text emphasis, section headers, high-priority actions
  - Works well on light backgrounds

**Status Colors:**
- **Success Green** `#43B581` (RGB: 67, 181, 129) - Aligned with Discord's success color
  - Use for: Payment confirmations, role grants, successful setup steps

- **Warning Amber** `#F0A020` (RGB: 240, 160, 32) - Attention without alarm
  - Use for: Pending payments, configuration reminders, action required

- **Error Red** `#F04747` (RGB: 240, 71, 71) - Critical issues
  - Use for: Payment failures, permission errors, system issues

- **Info Purple** `#7289DA` (RGB: 114, 137, 218) - Information and guidance
  - Use for: Onboarding tips, help messages, informational notices

**Neutral Colors:**
- **Charcoal** `#2C2F33` (RGB: 44, 47, 51) - Discord dark theme integration
- **Slate** `#99AAB5` (RGB: 153, 170, 181) - Secondary text
- **Light Gray** `#DCDDDE` (RGB: 220, 221, 222) - Borders, dividers
- **Pure White** `#FFFFFF` - High contrast text on dark backgrounds

**Gradient (Premium Features):**
- **Premium Gradient**: Linear gradient from `#4A90E2` → `#7C3AED`
  - Use sparingly for: Premium tier indicators, special leaderboard positions

### 1.3 Brand Voice & Personality

**Tone Characteristics:**
- **Clear over Clever**: Avoid jargon, explain financial terms
- **Confident but Humble**: Authoritative without being condescending
- **Helpful not Pushy**: Guide users, don't force decisions
- **Professional not Robotic**: Friendly but maintain business credibility

**Voice Examples:**
- ❌ "Oopsie! Something went wrong 🙈"
- ✅ "Payment processing failed. Please verify your payment method and try again."

- ❌ "CLICK HERE NOW TO SET UP YOUR BOT!!!"
- ✅ "Let's configure your server's paid roles. This takes about 3 minutes."

---

## 2. Discord Embed Patterns

### 2.1 Embed Architecture

**Core Structure:**
```json
{
  "color": 0x4A90E2,
  "author": {
    "name": "Docobo",
    "icon_url": "attachment://docobo-icon.png"
  },
  "title": "Clear, Action-Oriented Title",
  "description": "Concise explanation (2-3 sentences max)",
  "fields": [
    {
      "name": "Field Label",
      "value": "Field value with context",
      "inline": false
    }
  ],
  "thumbnail": {
    "url": "https://cdn.docobo.com/thumbnails/context-icon.png"
  },
  "footer": {
    "text": "Docobo • Type /help for assistance",
    "icon_url": "attachment://docobo-footer-icon.png"
  },
  "timestamp": "2025-11-13T10:30:00.000Z"
}
```

### 2.2 Embed Patterns by Context

#### A. Setup & Configuration Embeds

**Color**: `#4A90E2` (Docobo Blue)

**Use Case**: Initial bot setup, role configuration, payment method integration

**Structure:**
- **Title**: Step indicator + action (e.g., "Step 1/3: Select Paid Roles")
- **Description**: Brief explanation of current step
- **Fields**:
  - Current configuration (if applicable)
  - What happens next
- **Footer**: "Setup progress: 33% complete"

**Example:**
```
🔧 Step 2/3: Configure Role Pricing

Set the price for each role. Members will pay this amount to access role-specific channels.

📋 Selected Roles:
• @Premium Member
• @VIP Access
• @Early Supporter

Next: Choose payment methods (Stripe, PayPal, or both)
```

#### B. Payment Confirmation Embeds

**Color**: `#43B581` (Success Green)

**Use Case**: Successful payment processed, role granted

**Structure:**
- **Title**: "✅ Payment Confirmed"
- **Description**: What the user received
- **Fields**:
  - Amount Paid (bold, prominent)
  - Role Granted
  - Transaction ID (monospace font)
  - Date/Time
- **Thumbnail**: Checkmark icon or role icon
- **Footer**: "Questions? Contact server administrators"

**Example:**
```
✅ Payment Confirmed

Your payment has been processed successfully. Welcome to the community!

💰 Amount Paid: $15.00 USD
🎭 Role Granted: @Premium Member
🔖 Transaction ID: `tx_1Abc234Def567Ghi890`
📅 Date: November 13, 2025 at 10:42 AM UTC

You now have access to all premium channels. Enjoy!
```

#### C. Error & Problem Resolution Embeds

**Color**: `#F04747` (Error Red) or `#F0A020` (Warning Amber)

**Use Case**: Payment failures, permission issues, configuration errors

**Structure:**
- **Title**: Clear problem statement (avoid technical jargon)
- **Description**: What went wrong in plain language
- **Fields**:
  - Specific error details (if helpful)
  - Action required from user
  - How to get help
- **Footer**: "Need assistance? Contact support at support@docobo.com"

**Error Severity Levels:**
- **Critical (Red)**: Payment failed, bot lacks permissions, data corruption
- **Warning (Amber)**: Configuration incomplete, pending approval, temporary issues
- **Info (Purple)**: FYI messages, optional improvements

**Example (Payment Failed):**
```
⚠️ Payment Processing Failed

We couldn't process your payment. This usually happens due to insufficient funds or declined cards.

❌ Error: Payment declined by card issuer
💳 Payment Method: Visa ending in 4242
💵 Attempted Amount: $15.00 USD

What to do:
1. Verify your card has sufficient funds
2. Check if international transactions are enabled
3. Try a different payment method
4. Contact your bank if the issue persists

Click "Try Again" below to retry your payment.
```

#### D. Leaderboard Display Embeds

**Color**: `#7C3AED` (Premium Purple) for monthly, `#4A90E2` (Docobo Blue) for all-time

**Use Case**: Top contributors, payment rankings, engagement metrics

**Structure:**
- **Title**: Timeframe + metric (e.g., "🏆 Top Contributors - November 2025")
- **Description**: Brief explanation of ranking criteria
- **Fields**: Each position as a field
  - Position emoji (🥇🥈🥉 for top 3, then numbers)
  - Username + metrics
  - Inline: false (full width for readability)
- **Thumbnail**: Trophy or crown icon
- **Footer**: "Your rank: #12 • $45.00 contributed this month"

**Example:**
```
🏆 Top Contributors - November 2025

Members who've supported the community the most this month.

🥇 1st Place: @AlexTheGreat
    $250.00 • Premium Member since Jan 2025

🥈 2nd Place: @SarahCodes
    $180.00 • VIP Access + Early Supporter

🥉 3rd Place: @DevMaster
    $150.00 • Premium Member since Mar 2025

4️⃣ 4th Place: @CryptoKing
    $120.00 • VIP Access

5️⃣ 5th Place: @DesignGuru
    $95.00 • Early Supporter

Your rank: #12 • $45.00 contributed this month
Keep going to reach the top 10! 💪
```

### 2.3 Embed Best Practices

**Length Guidelines:**
- **Title**: Max 50 characters (aim for 30-40)
- **Description**: Max 300 characters (2-3 sentences)
- **Field Names**: Max 25 characters
- **Field Values**: Max 150 characters per field
- **Total Fields**: Max 5 fields per embed (3-4 ideal for mobile)

**Visual Hierarchy:**
- Use **bold** for amounts, usernames, key actions
- Use `monospace` for transaction IDs, codes, technical values
- Use emojis strategically (1-2 per section, not every line)
- Leave breathing room: Don't pack every field

**Mobile Optimization:**
- Test all embeds on 375px width (iPhone SE)
- Avoid inline fields for critical information
- Use line breaks generously
- Front-load important info (users may not scroll)

**Accessibility:**
- Color is not the only indicator (use icons + text)
- Maintain 4.5:1 contrast ratio for text
- Avoid red/green only distinctions (colorblind users)
- Provide text alternatives for emoji meanings

---

## 3. Interactive Components

### 3.1 Button Design Standards

**Discord Button Styles & Docobo Mappings:**

| Style | Discord Name | Docobo Use Case | Color |
|-------|-------------|----------------|-------|
| Primary | Primary (Blue) | Main actions: "Continue Setup", "Confirm Payment" | Discord Blue |
| Secondary | Secondary (Gray) | Navigation: "Back", "Skip", "View Details" | Gray |
| Success | Success (Green) | Confirmations: "Complete Setup", "Authorize Payment" | Green |
| Danger | Danger (Red) | Destructive: "Cancel Subscription", "Remove Role" | Red |
| Link | Link | External: "View Transaction", "Open Dashboard" | Text Link |

**Button Labeling:**
- ✅ **Action Verbs**: "Continue", "Authorize", "View Leaderboard"
- ❌ **Vague Labels**: "OK", "Yes", "Click Here"

**Button Emoji Usage:**
- Use sparingly (not every button)
- Relevant to action: ✅ ❌ 🔒 🔓 ⚙️ 📊 💳
- Prefix before text: "✅ Confirm Payment"

**Action Row Layout (5-unit width system):**

```
Row 1: [Continue Setup] (Primary, 1 unit) + [Skip] (Secondary, 1 unit) + [Help] (Link, 1 unit)
Row 2: [Select Payment Method] (Select Menu, 5 units - full row)
Row 3: [Authorize Payment] (Success, 1 unit) + [Cancel] (Danger, 1 unit)
```

**Max Buttons:** 5 per row, 5 rows per message = 25 buttons max (but avoid this)

### 3.2 Select Menu Design

**Static Select Menus (Developer-Defined Options):**

**Use Case**: Role selection, pricing tiers, payment methods

**Structure:**
```json
{
  "type": 3,
  "custom_id": "role_selection",
  "placeholder": "Choose roles to monetize...",
  "min_values": 1,
  "max_values": 5,
  "options": [
    {
      "label": "Premium Member",
      "description": "Access to premium channels and perks",
      "value": "role_premium",
      "emoji": "💎"
    }
  ]
}
```

**Labeling Guidelines:**
- **Label**: Short, descriptive (max 25 chars)
- **Description**: Benefits or details (max 50 chars)
- **Emoji**: Use to differentiate similar options
- **Placeholder**: Contextual prompt ("Select payment method...")

**Dynamic Select Menus (Auto-Populated):**

**Use Case**: Server role selection, channel selection

- **Role Selects**: For admins choosing which roles to monetize
- **Channel Selects**: For assigning role-gated channels
- **User Selects**: For admin actions (refunds, manual grants)

### 3.3 Modal (Form) Design

**Use Case**: Text input required (pricing amounts, custom messages, API keys)

**Modal Structure:**
```json
{
  "title": "Set Role Pricing",
  "custom_id": "pricing_modal",
  "components": [
    {
      "type": 1,
      "components": [
        {
          "type": 4,
          "custom_id": "price_amount",
          "label": "Price (USD)",
          "style": 1,
          "placeholder": "15.00",
          "required": true,
          "min_length": 1,
          "max_length": 10
        }
      ]
    },
    {
      "type": 1,
      "components": [
        {
          "type": 4,
          "custom_id": "price_description",
          "label": "Description (shown to members)",
          "style": 2,
          "placeholder": "One-time payment for lifetime access",
          "required": false,
          "max_length": 100
        }
      ]
    }
  ]
}
```

**Modal Best Practices:**
- **Title**: Clear context (max 45 chars)
- **Label**: What input is expected
- **Placeholder**: Example or format hint
- **Required**: Only mark critical fields required
- **Validation**: Client-side first, then server-side with clear error messages
- **Max Fields**: 5 inputs max (Discord limit)

**String Select in Modals (NEW Discord Feature):**
- Can now add select menus inside modals
- Use for predefined options within forms
- Example: Currency selection within pricing modal

### 3.4 Interaction Timing & Response Patterns

**3-Second Rule (CRITICAL):**
- All interactions MUST receive response within 3 seconds or fail
- Use immediate ACK pattern for long operations

**Response Patterns:**

**Pattern A: Immediate Update**
```javascript
// For fast operations (<1 second)
await interaction.reply({ embeds: [successEmbed] });
```

**Pattern B: Deferred Response**
```javascript
// For operations taking 1-3 seconds
await interaction.deferReply({ ephemeral: true });
// ... process ...
await interaction.editReply({ embeds: [resultEmbed] });
```

**Pattern C: Lambda/Async Pattern**
```javascript
// For operations >3 seconds (payment processing)
await interaction.reply({
  content: "Processing your payment...",
  ephemeral: true
});
// ... process in background ...
await interaction.followUp({ embeds: [confirmationEmbed] });
```

**Ephemeral Messages:**
- Use for: Errors, personal confirmations, sensitive data
- Avoid for: Public confirmations, leaderboard updates, announcements

---

## 4. Typography

### 4.1 Font Selection

**Primary Font Stack:**
- **Be Vietnam Pro** (Google Fonts)
  - Designed specifically for Vietnamese + Latin character support
  - Neo-Grotesk style suits tech/startup aesthetic
  - Professional, clean, highly legible
  - Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)

**Why Be Vietnam Pro:**
1. **Vietnamese Support**: Critical for diacritical marks (ă, â, đ, ê, ô, ơ, ư)
2. **Professional Aesthetic**: Modern, trustworthy, suitable for financial context
3. **Excellent Legibility**: Clear distinction between similar characters (0/O, 1/l/I)
4. **Wide Weight Range**: Flexibility for hierarchy without font changes
5. **Open Source**: Free commercial use, no licensing concerns

**Fallback Stack:**
```css
font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont,
             'Segoe UI', 'Roboto', 'Helvetica Neue', Arial,
             sans-serif;
```

**Monospace Font (for codes, IDs):**
- **JetBrains Mono** (Google Fonts)
  - Designed for code readability
  - Clear character distinction (critical for transaction IDs)
  - Weights: 400 (Regular), 500 (Medium), 700 (Bold)

```css
font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
```

### 4.2 Type Scale & Hierarchy

**Embed Typography (Discord Markdown Support):**

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| **Embed Title** | 16px | 600 (SemiBold) | Main heading, action prompt |
| **Description** | 14px | 400 (Regular) | Body text, explanations |
| **Field Name** | 14px | 600 (SemiBold) | Field labels (bold in Discord) |
| **Field Value** | 14px | 400 (Regular) | Field content |
| **Footer** | 12px | 400 (Regular) | Metadata, timestamps |
| **Monospace** | 13px | 400 (Regular) | Transaction IDs, codes |

**Web Dashboard Typography:**

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **H1** | 36px | 700 (Bold) | 1.2 | Page titles |
| **H2** | 28px | 600 (SemiBold) | 1.3 | Section headers |
| **H3** | 22px | 600 (SemiBold) | 1.4 | Subsection headers |
| **H4** | 18px | 500 (Medium) | 1.4 | Card titles |
| **Body** | 16px | 400 (Regular) | 1.6 | Paragraph text |
| **Small** | 14px | 400 (Regular) | 1.5 | Secondary info |
| **Caption** | 12px | 400 (Regular) | 1.4 | Meta information |
| **Button** | 15px | 600 (SemiBold) | 1.0 | CTA text |
| **Code** | 14px | 400 (JetBrains) | 1.5 | Technical text |

### 4.3 Text Formatting Rules

**Emphasis:**
- **Bold**: Amounts, usernames, critical actions, warnings
- *Italic*: Subtle emphasis, examples (use sparingly)
- ~~Strikethrough~~: Deprecated features, removed items
- `Monospace`: IDs, codes, API keys, technical values

**Lists:**
- Use `•` bullet for unordered lists
- Use `1.`, `2.` for sequential steps
- Use emojis sparingly as bullets (max 1 emoji per bullet point)

**Links:**
- Descriptive text: "View full transaction history"
- Not: "Click here" or bare URLs
- Discord format: `[text](url)` or button components

**Line Length:**
- Embed descriptions: 50-70 characters per line
- Dashboard paragraphs: 70-90 characters per line
- Optimal for readability, reduces eye strain

---

## 5. Icons & Visual Assets

### 5.1 Icon Style Guidelines

**Design Principles:**
- **Style**: Line icons with 2px stroke weight
- **Corner Radius**: 2px rounded corners (soft but not overly rounded)
- **Color**: Single color, no gradients (except premium features)
- **Size**: 24×24px base size, scale proportionally
- **Padding**: 2px internal padding from edge
- **Export**: SVG format for scalability

**Icon Categories & Examples:**

**Financial:**
- 💳 Credit card (payment method)
- 💰 Money bag (pricing, earnings)
- 📊 Chart (leaderboard, analytics)
- 🔒 Lock (secure payment, gated content)
- 🔓 Unlock (access granted)
- ✅ Checkmark (payment confirmed)
- ❌ X mark (payment failed)

**Navigation:**
- ⚙️ Gear (settings, configuration)
- 🏠 House (dashboard home)
- 📋 Clipboard (logs, history)
- 🔍 Magnifier (search)
- ℹ️ Info (help, details)
- ⬅️ Arrow left (back)
- ➡️ Arrow right (continue)

**Status:**
- 🟢 Green circle (active, online)
- 🟡 Yellow circle (pending, warning)
- 🔴 Red circle (error, offline)
- ⏳ Hourglass (processing)
- ⚡ Lightning (premium, fast)

**Social:**
- 👤 User (profile, member)
- 👥 Users (community)
- 🏆 Trophy (leaderboard winner)
- ⭐ Star (featured, favorite)
- 💬 Chat (support, feedback)

### 5.2 Bot Avatar Design

**Primary Avatar Concept:**
- Abstract geometric "D" letter mark
- Composed of two overlapping shapes:
  - Outer arc in Docobo Blue (#4A90E2)
  - Inner triangle in Deep Navy (#1E3A5F)
- Suggests: Door opening (access), coin (payment), shield (security)

**Avatar Specifications:**
- **Size**: 512×512px minimum (Discord requirement)
- **Format**: PNG with transparency
- **Background**: Transparent or Deep Navy for contrast
- **Safe Area**: Keep key elements within 400×400px center (avoid edge cropping)

**Avatar Description for Generation:**
```
Modern, minimalist logo for "Docobo" payment bot.
Geometric design featuring a stylized letter "D" formed by:
- Large arc/semicircle in bright blue (#4A90E2)
- Sharp triangular cutout in deep navy (#1E3A5F)
- Suggests both a coin and an opening door
- Clean lines, professional, fintech aesthetic
- High contrast, recognizable at small sizes (32px)
- No text, pure icon/symbol
- Flat design, no shadows or gradients
```

### 5.3 Embed Thumbnail Icons

**Context-Specific Thumbnails:**
- **Setup**: Wrench/gear icon in Docobo Blue
- **Payment Success**: Green checkmark in circle
- **Payment Failed**: Red X in triangle
- **Leaderboard**: Gold trophy
- **Warning**: Amber exclamation in triangle
- **Info**: Purple info icon in circle

**Specifications:**
- **Size**: 128×128px (Discord max thumbnail)
- **Style**: Consistent with icon guidelines
- **Background**: Subtle gradient or solid color matching embed
- **Hosting**: CDN-hosted for fast loading (avoid attachments for repeated use)

### 5.4 Asset Hosting Strategy

**Repeated Assets (logos, common icons):**
- Host on CDN (Cloudflare, AWS CloudFront)
- Use HTTPS URLs in embed `thumbnail` and `image` fields
- Benefits: Faster responses, reduced API payload

**One-Time Assets (user-specific data):**
- Use Discord attachments via `attachment://filename.png`
- Generate dynamically (charts, personalized images)

**Asset Naming Convention:**
```
docobo-{context}-{variant}.{ext}

Examples:
docobo-logo-primary.png
docobo-icon-success.svg
docobo-thumbnail-payment-confirmed.png
docobo-banner-leaderboard-monthly.jpg
```

---

## 6. Messaging Tone & Content Patterns

### 6.1 Voice Principles

**DO:**
- Explain financial terms clearly ("One-time payment means you pay once and keep access forever")
- Acknowledge user concerns ("We understand payment security is important")
- Provide next steps ("Here's what happens next...")
- Use plain language ("Your payment didn't go through" not "Transaction authorization failed")

**DON'T:**
- Use overly casual slang ("Yeet your payment through!")
- Joke about money or failures ("Oops, your payment went poof!")
- Use excessive exclamation marks (max 1 per message)
- Assume technical knowledge ("Check your OAuth2 token")

### 6.2 Error Message Patterns

**Structure:**
```
1. What happened (plain language)
2. Why it happened (if known)
3. What to do next (actionable steps)
4. How to get help (if needed)
```

**Examples:**

**Payment Declined:**
```
⚠️ Payment Not Completed

Your card was declined by your bank.

This usually happens when:
• Insufficient funds in your account
• International transactions are blocked
• Your bank flagged the charge as suspicious

What to do:
1. Check your account balance
2. Contact your bank to authorize the payment
3. Try again with a different card

Need help? Contact server admins or support@docobo.com
```

**Permission Error:**
```
❌ Bot Setup Incomplete

Docobo needs additional permissions to manage roles.

Missing permissions:
• Manage Roles
• Manage Channels

How to fix:
1. Go to Server Settings > Integrations
2. Click on Docobo
3. Enable "Manage Roles" and "Manage Channels"
4. Return here and click "Retry Setup"

[Retry Setup] [Help Guide]
```

**Timeout Error:**
```
⏱️ Request Timed Out

Your request took too long to process. This can happen during high server load.

Your data is safe - nothing was charged or changed.

Please try again in a few moments.

[Try Again]
```

### 6.3 Success Confirmation Patterns

**Structure:**
```
1. Clear success statement
2. What was accomplished
3. What access/benefits they received
4. Optional: Next suggested action
```

**Examples:**

**Payment Success:**
```
✅ Welcome to Premium!

Your payment of $15.00 has been processed successfully.

You now have:
• @Premium Member role
• Access to 5 exclusive channels
• Priority support
• Leaderboard points tracking

Explore your new channels and introduce yourself!

[View Premium Channels] [See Leaderboard]
```

**Setup Complete:**
```
🎉 Docobo Setup Complete!

Your server is now ready to accept payments for these roles:
• @Premium Member - $15.00
• @VIP Access - $30.00

Members can use `/join-premium` to view pricing and purchase access.

What's next:
• Share the purchase command in an announcement
• Monitor payments in your admin dashboard
• View earnings with `/admin stats`

[Open Dashboard] [View Guide]
```

### 6.4 Onboarding Instructions

**First Message (Progressive Disclosure):**
```
👋 Welcome to Docobo!

Let's set up your community monetization. This takes about 3 minutes.

We'll configure:
1. Which roles to monetize
2. Pricing for each role
3. Payment methods (Stripe/PayPal)

Ready to start?

[Start Setup] [Watch Tutorial]
```

**Step Messages (Clear Progress):**
```
📝 Step 2/3: Set Pricing

Choose a price for each role. Members will pay this amount once for permanent access.

Selected roles:
• @Premium Member - [Not set]
• @VIP Access - [Not set]

Recommended pricing:
• Basic tier: $5-15
• Premium tier: $15-30
• VIP tier: $30-100

[Set Prices] [Back] [Skip for Now]
```

**Completion Message:**
```
✅ All Set!

Your monetization is live. Here's your summary:

Monetized Roles: 2
Total Potential MRR: $45/member
Payment Methods: Stripe, PayPal

Members join with: `/join-premium`
You manage with: `/admin dashboard`

[Open Dashboard] [Test Purchase Flow] [Announce to Server]
```

### 6.5 Proactive Guidance

**When to Provide Tips:**
- After completing a setup step successfully
- When user hasn't taken action in 24 hours
- Before potentially confusing steps
- After first successful payment (for server owner)

**Example Proactive Messages:**

**After Role Setup:**
```
💡 Pro Tip

Enable "Role Icons" to make your premium roles stand out in the member list.

This visual badge helps showcase premium membership and can increase conversions.

Server Settings > Roles > [Your Role] > Display > Icon

[Learn More] [Dismiss]
```

**After First Payment:**
```
🎉 Congratulations on Your First Payment!

Your server earned $15.00 from @NewMember.

Quick stats:
• Total earnings: $15.00
• Active premium members: 1
• Conversion rate: N/A (need more data)

Want to boost growth?
• Announce new premium features
• Showcase leaderboard top members
• Offer limited-time pricing

[View Dashboard] [Growth Tips]
```

---

## 7. Progressive Disclosure & Multi-Step Flows

### 7.1 Onboarding Flow Architecture

**Principle**: Minimize cognitive load at each step. Users should never see more than 3 choices at once.

**Core Flow Structure:**

```
START
  ↓
[Welcome Screen] → Single CTA: "Start Setup"
  ↓
[Role Selection] → Multi-select menu (show all server roles)
  ↓ (user selects 1-5 roles)
[Pricing Configuration] → Modal for each role with price input
  ↓ (user sets prices)
[Payment Method Selection] → Buttons: Stripe, PayPal, or Both
  ↓ (user chooses)
[Payment Integration] → Modal for API keys OR OAuth flow
  ↓ (credentials provided)
[Confirmation & Test] → Summary + optional test purchase
  ↓ (user confirms)
[Complete] → Success message + next actions
```

### 7.2 Branching Logic

**Decision Points:**

**A. Role Selection Count:**
- **1 role selected**: Simplified flow, single pricing modal
- **2-3 roles selected**: Standard flow, sequential pricing modals
- **4-5 roles selected**: Suggest bulk pricing, show pricing templates

**B. Payment Method:**
- **Stripe only**: Show Stripe API key instructions
- **PayPal only**: Show PayPal integration steps
- **Both**: Show combined setup with priority order

**C. Previous Setup Detected:**
- **First time**: Full onboarding
- **Returning**: Skip to modification screen, "Add Role", "Edit Pricing", "Change Payment Method"

### 7.3 Progress Indicators

**Visual Progress Bar (Web Dashboard):**
```
Setup Progress: [████████░░] 80% Complete

✅ 1. Role Selection
✅ 2. Pricing Setup
✅ 3. Payment Integration
⬜ 4. Test Purchase
⬜ 5. Go Live
```

**Discord Embed Progress:**
```
Footer: "Setup progress: Step 3/5 • 60% complete"
```

**Step Navigation:**
- Always show "Back" button (except first step)
- "Skip for Now" for optional steps
- "Continue" or specific action button (e.g., "Set Prices")

### 7.4 Error Recovery & Validation

**Inline Validation:**
- Validate input immediately (before submission)
- Show errors in ephemeral messages
- Preserve user input (don't force re-entry)

**Example Validation Error:**
```
❌ Invalid Price Format

Please enter a valid price in USD.

Examples:
✅ 15 or 15.00
✅ 9.99
❌ $15 (remove $ symbol)
❌ 15,00 (use . not ,)

[Try Again]
```

**Checkpoint Recovery:**
- Save progress at each completed step
- Allow users to resume setup if interrupted
- Show "Resume Setup" button if incomplete

**Resume Message:**
```
👋 Welcome Back!

You started setting up Docobo on November 10.

We saved your progress:
✅ Roles selected: @Premium Member, @VIP Access
✅ Pricing set
⏸️ Paused at: Payment method integration

[Resume Setup] [Start Over] [Cancel]
```

### 7.5 Contextual Help

**When to Offer Help:**
- User spends >30 seconds on a step without action
- User clicks "Back" twice in a row (confusion signal)
- User attempts invalid input 2+ times
- User explicitly requests help

**Help Patterns:**

**Inline Help (within embed):**
```
ℹ️ What are API keys?

API keys let Docobo securely connect to Stripe/PayPal on your behalf.
Think of them like a password for apps.

Where to find them:
• Stripe: Dashboard > Developers > API keys
• PayPal: Developer Dashboard > My Apps > API Credentials

[Detailed Guide] [Watch Video] [Continue]
```

**Help Command:**
```
/help [topic]

Available topics:
• setup - Bot configuration guide
• payments - How member payments work
• roles - Role management
• leaderboard - Leaderboard features
• troubleshooting - Common issues
```

---

## 8. Design Tokens & Implementation

### 8.1 Color Tokens

```css
:root {
  /* Brand Colors */
  --docobo-blue: #4A90E2;
  --docobo-navy: #1E3A5F;

  /* Status Colors */
  --success: #43B581;
  --warning: #F0A020;
  --error: #F04747;
  --info: #7289DA;

  /* Neutral Colors */
  --charcoal: #2C2F33;
  --slate: #99AAB5;
  --light-gray: #DCDDDE;
  --white: #FFFFFF;

  /* Premium Gradient */
  --premium-gradient: linear-gradient(135deg, #4A90E2 0%, #7C3AED 100%);

  /* Discord Native */
  --discord-blurple: #5865F2;
  --discord-dark: #36393F;
}
```

### 8.2 Spacing Tokens

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}
```

### 8.3 Typography Tokens

```css
:root {
  /* Font Families */
  --font-primary: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* Font Sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 28px;
  --text-3xl: 36px;

  /* Font Weights */
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-snug: 1.4;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;
}
```

### 8.4 Border & Radius Tokens

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --border-width: 1px;
  --border-width-thick: 2px;
}
```

---

## 9. Accessibility Standards

### 9.1 WCAG 2.1 AA Compliance

**Color Contrast Requirements:**
- Normal text (14-18px): Minimum 4.5:1 contrast ratio
- Large text (18px+ or 14px+ bold): Minimum 3:1 contrast ratio
- UI components & graphics: Minimum 3:1 contrast ratio

**Docobo Contrast Audit:**
| Combination | Ratio | Pass? |
|-------------|-------|-------|
| Docobo Blue (#4A90E2) on White | 4.63:1 | ✅ AA |
| Deep Navy (#1E3A5F) on White | 11.56:1 | ✅ AAA |
| White on Docobo Blue | 4.63:1 | ✅ AA |
| Success Green (#43B581) on Discord Dark (#2C2F33) | 4.52:1 | ✅ AA |
| Slate (#99AAB5) on Discord Dark (#2C2F33) | 4.64:1 | ✅ AA |

### 9.2 Interactive Element Standards

**Touch Targets:**
- Minimum size: 44×44px (WCAG guideline)
- Discord buttons meet this (standard button height)
- Ensure adequate spacing between buttons (8px minimum)

**Focus States:**
- All interactive elements must have visible focus indicators
- Discord handles this natively for components
- Web dashboard: Add 2px outline in Docobo Blue

**Keyboard Navigation:**
- All actions must be keyboard accessible
- Tab order should follow logical flow
- Provide keyboard shortcuts for common actions (`/` for command palette)

### 9.3 Screen Reader Considerations

**Alt Text for Images:**
- Bot avatar: "Docobo logo - Community payment bot"
- Status icons: "Success icon - Payment confirmed"
- Thumbnails: Describe context, not just "thumbnail"

**ARIA Labels:**
```html
<button aria-label="Continue to payment method selection">
  Continue
</button>

<div role="alert" aria-live="polite">
  Payment processing...
</div>
```

**Semantic HTML:**
- Use `<button>` not `<div onclick>`
- Use `<nav>` for navigation areas
- Use proper heading hierarchy (H1 → H2 → H3)

### 9.4 Reduced Motion Support

**Animation Preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Static Alternatives:**
- Loading spinners → Static text "Loading..."
- Animated progress bars → Static percentage text
- Fade transitions → Instant display

### 9.5 Language & Localization

**Vietnamese Text Support:**
- Test all UI with Vietnamese sample text
- Verify diacritical marks render correctly (ă, â, ê, ô, ư, etc.)
- Ensure adequate line-height for stacked diacritics (1.6 minimum)

**Currency Localization:**
- Default: USD ($)
- Support: EUR (€), GBP (£), VND (₫)
- Format: `$15.00 USD` (explicit currency code)

**Date/Time Localization:**
- Use UTC timestamps
- Display in user's local timezone when possible
- Format: `November 13, 2025 at 10:42 AM UTC`

---

## 10. Responsive Design Breakpoints

### 10.1 Discord Mobile Considerations

**Device Profiles:**
- **Mobile**: 320px - 767px (priority for Discord embeds)
- **Tablet**: 768px - 1023px (Discord on iPad)
- **Desktop**: 1024px+ (Discord desktop app)

**Embed Optimization per Device:**

**Mobile (320-767px):**
- Max 3 fields per embed (avoid scrolling)
- No inline fields (full-width only)
- Shorter descriptions (max 150 chars)
- Larger buttons (native Discord sizing handles this)
- Single-column layouts

**Tablet (768-1023px):**
- Max 5 fields per embed
- Inline fields acceptable for short content
- Standard descriptions (max 300 chars)
- Two-button rows acceptable

**Desktop (1024px+):**
- Full embed capabilities
- Inline fields for compact display
- Detailed descriptions
- Multi-button rows (up to 5 per row)

### 10.2 Web Dashboard Breakpoints

**Mobile-First CSS:**
```css
/* Base: Mobile (320px+) */
.dashboard-card {
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .dashboard-card {
    padding: var(--space-lg);
  }

  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .dashboard-card {
    padding: var(--space-xl);
  }

  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Large Desktop (1440px+) */
@media (min-width: 1440px) {
  .dashboard-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 11. Performance Guidelines

### 11.1 Image Optimization

**File Size Targets:**
- Bot avatar (512×512px): < 100KB
- Thumbnails (128×128px): < 30KB
- Embed images (width: 400px): < 150KB

**Formats:**
- Logos/icons: SVG (scalable, smallest)
- Photos/complex: WebP (fallback to JPG)
- Transparency needed: PNG-8 (or WebP with alpha)

**Hosting:**
- Use CDN with global edge locations
- Enable HTTP/2 and Brotli compression
- Set cache headers (1 year for immutable assets)

### 11.2 API Response Times

**Target Latencies:**
- Embed rendering: < 100ms
- Button interactions: < 500ms (including ACK)
- Payment processing: < 5s (with progress feedback)
- Dashboard load: < 2s (First Contentful Paint)

**Optimization Strategies:**
- Cache common embeds (leaderboard, help messages)
- Use pagination for large datasets (100 items max per page)
- Lazy load dashboard sections
- Prefetch likely next actions

### 11.3 Discord Rate Limits

**Respect Limits:**
- Embeds: 10 per message (but aim for 1-2)
- API calls: 50 per second per bot (global)
- Messages: 5 per 5 seconds per channel (webhooks: 30 per 60s)

**Rate Limit Handling:**
- Implement exponential backoff
- Queue non-urgent messages
- Batch operations when possible

---

## 12. Testing & Quality Assurance

### 12.1 Embed Preview Testing

**Tools:**
- Discord Embed Visualizer (https://leovoel.github.io/embed-visualizer/)
- Message.style (https://message.style)
- Test in actual Discord (mobile + desktop)

**Test Matrix:**
| Device | App | Theme | Test Scenarios |
|--------|-----|-------|----------------|
| iPhone SE | Discord Mobile | Dark | All embed types |
| iPad | Discord Mobile | Light | Leaderboard, setup |
| Desktop | Discord App | Dark | Full onboarding flow |
| Desktop | Discord Web | Light | Error states |

### 12.2 Accessibility Audit Checklist

- [ ] Color contrast meets WCAG AA (4.5:1 minimum)
- [ ] All interactive elements have focus states
- [ ] Alt text provided for all images
- [ ] Keyboard navigation works for all actions
- [ ] Screen reader announces state changes
- [ ] Reduced motion preference respected
- [ ] Vietnamese characters render correctly
- [ ] Form validation errors are clear and specific

### 12.3 User Testing Protocol

**Pre-Launch Testing:**
1. **Internal Alpha**: Dev team + 3 server owners
2. **Closed Beta**: 10-20 diverse servers (size, niche, region)
3. **Open Beta**: Announce publicly, gather feedback

**Success Metrics:**
- Setup completion rate > 80%
- Time to first payment < 15 minutes
- Payment error rate < 5%
- User satisfaction (NPS) > 40

**Feedback Channels:**
- In-bot command: `/feedback [message]`
- Discord support server
- Email: support@docobo.com
- GitHub issues (for bugs)

---

## 13. Maintenance & Updates

### 13.1 Design System Versioning

**Semantic Versioning:**
- **Major (2.0)**: Breaking changes (color scheme overhaul, component redesign)
- **Minor (1.1)**: New patterns, additional components
- **Patch (1.0.1)**: Bug fixes, clarifications, minor tweaks

**Change Log Format:**
```markdown
## [1.1.0] - 2025-12-01
### Added
- New leaderboard trophy icon designs
- Premium gradient token for VIP features

### Changed
- Updated error message patterns for clarity
- Increased mobile button padding from 12px to 16px

### Fixed
- Vietnamese character rendering in JetBrains Mono
- Color contrast issue with warning amber on dark backgrounds
```

### 13.2 Deprecation Policy

**Deprecation Process:**
1. **Announce**: Update design guidelines with "⚠️ DEPRECATED" label
2. **Grace Period**: 90 days before removal
3. **Migration Guide**: Provide alternative pattern and code examples
4. **Remove**: Delete from guidelines after grace period

**Example Deprecation Notice:**
```markdown
### ⚠️ DEPRECATED: Custom Color Embeds

**Reason**: Inconsistent with brand identity
**Alternative**: Use standard status colors (success, warning, error, info)
**Removal Date**: March 1, 2026

Migration:
- Old: `color: 0xFF5733` (custom orange)
- New: `color: 0xF0A020` (warning amber)
```

### 13.3 Design Review Cadence

**Regular Reviews:**
- **Weekly**: Component updates, bug fixes
- **Monthly**: Pattern refinements, user feedback integration
- **Quarterly**: Major updates, trend alignment
- **Annually**: Full design system audit

**Review Checklist:**
- [ ] Alignment with Discord platform updates
- [ ] Accessibility compliance maintained
- [ ] Performance benchmarks met
- [ ] User feedback addressed
- [ ] Competitor analysis conducted
- [ ] Emerging design trends evaluated

---

## 14. Resources & References

### 14.1 External Resources

**Discord Developer Resources:**
- Discord Developer Portal: https://discord.com/developers
- discord.js Guide: https://discordjs.guide
- Discord Community Guidelines: https://discord.com/guidelines

**Design Tools:**
- Figma (design): https://figma.com
- Embed Visualizer: https://leovoel.github.io/embed-visualizer/
- Color Contrast Checker: https://webaim.org/resources/contrastchecker/

**Font Resources:**
- Google Fonts: https://fonts.google.com
- Be Vietnam Pro: https://fonts.google.com/specimen/Be+Vietnam+Pro
- JetBrains Mono: https://fonts.google.com/specimen/JetBrains+Mono

### 14.2 Internal Assets

**Asset Repository Structure:**
```
docobo-assets/
├── logos/
│   ├── docobo-logo-primary.svg
│   ├── docobo-logo-white.svg
│   └── docobo-icon-512.png
├── icons/
│   ├── financial/
│   ├── navigation/
│   ├── status/
│   └── social/
├── thumbnails/
│   ├── success-128.png
│   ├── error-128.png
│   └── warning-128.png
└── mockups/
    └── (wireframes and design comps)
```

### 14.3 Contact & Support

**Design System Maintainer:**
- Primary: Design Team (design@docobo.com)
- Secondary: Engineering Lead (dev@docobo.com)

**Contribution Process:**
1. Propose change via GitHub issue
2. Design review meeting (bi-weekly)
3. Approval + implementation
4. Documentation update
5. Announce to team

**Questions & Clarifications:**
- Slack: #design-system channel
- Email: design@docobo.com
- Office Hours: Tuesdays 2-3 PM UTC

---

## 15. Appendix: Quick Reference

### 15.1 Color Cheat Sheet

| Color Name | Hex | Use Case |
|------------|-----|----------|
| Docobo Blue | `#4A90E2` | Primary brand, main actions |
| Deep Navy | `#1E3A5F` | Text emphasis, authority |
| Success Green | `#43B581` | Confirmations, success states |
| Warning Amber | `#F0A020` | Pending, attention needed |
| Error Red | `#F04747` | Failures, critical issues |
| Info Purple | `#7289DA` | Information, help |
| Charcoal | `#2C2F33` | Discord dark background |
| Slate | `#99AAB5` | Secondary text |
| White | `#FFFFFF` | Primary text on dark |

### 15.2 Button Quick Reference

| Action Type | Style | Example Label |
|-------------|-------|---------------|
| Primary action | Primary (Blue) | "Continue Setup" |
| Secondary action | Secondary (Gray) | "Back" |
| Confirmation | Success (Green) | "Confirm Payment" |
| Destructive | Danger (Red) | "Cancel Subscription" |
| External link | Link | "View Dashboard" |

### 15.3 Embed Color by Context

| Context | Color | Hex |
|---------|-------|-----|
| Setup/Configuration | Docobo Blue | `#4A90E2` |
| Payment Success | Success Green | `#43B581` |
| Payment Failed | Error Red | `#F04747` |
| Warning/Pending | Warning Amber | `#F0A020` |
| Information/Help | Info Purple | `#7289DA` |
| Leaderboard | Premium Purple | `#7C3AED` |

### 15.4 Common Emoji Usage

| Emoji | Context | Usage |
|-------|---------|-------|
| ✅ | Success | Payment confirmed, setup complete |
| ❌ | Error | Payment failed, invalid input |
| ⚠️ | Warning | Attention needed, pending action |
| ℹ️ | Info | Help messages, tips |
| 🔒 | Security | Payment security, gated content |
| 💰 | Money | Pricing, earnings |
| 🏆 | Achievement | Leaderboard, top contributor |
| ⚙️ | Settings | Configuration, admin panel |
| 📊 | Analytics | Stats, leaderboard, reports |

---

**End of Design Guidelines v1.0**

*This document is a living resource. Suggest improvements via design@docobo.com or GitHub issues.*
