# Payment Integration Research: Polar.sh & SePay.vn

## Sources (10)
1. https://polar.sh/docs/integrate/webhooks/events
2. https://polar.sh/docs/integrate/webhooks/endpoints
3. https://docs.sepay.vn/oauth2/api-webhooks.html
4. https://docs.sepay.vn/tich-hop-webhooks.html
5. https://polar.sh/docs/features/refunds
6. https://polar.sh/docs/api-reference/introduction
7. https://github.com/polarsource/polar-js
8. https://www.npmjs.com/package/@polar-sh/sdk
9. https://github.com/polarsource/polar-adapters
10. https://www.better-auth.com/docs/plugins/polar

---

## Polar.sh API Patterns

### Webhook Events [1]
**Subscription lifecycle:**
- `subscription.created`, `subscription.updated`, `subscription.active`
- `subscription.canceled` - fires immediately on cancel, regardless of timing
- `subscription.uncanceled` - reactivate canceled sub
- `subscription.revoked` - fired at period end for canceled subs

**Order/payment flow:**
- `order.created` - initial order + subscription renewals (check `billing_reason` field)
- `order.updated`, `order.paid` - payment confirmation
- `order.refunded` - refund processed

**Billing reasons:** `purchase`, `subscription_create`, `subscription_cycle`, `subscription_update`

**Renewal sequence:** `subscription.updated` → `order.created` → `order.updated` → `order.paid`

**Cancel timing:**
- End-of-period: `subscription.updated` + `subscription.canceled` (immediate) → `subscription.revoked` (at period end)
- Immediate: All 3 events fire simultaneously

### Webhook Security [2,7,8]
**Signature verification:**
- Standard Webhooks spec (https://standardwebhooks.com)
- HMAC-based cryptographic signing
- Secret configurable per endpoint (self-generated or random)

**SDK validation (Node.js):**
```javascript
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = validateEvent(req.body, req.headers, process.env.POLAR_WEBHOOK_SECRET);
    // Process event
    res.status(202).send('');
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      res.status(403).send('');
    }
    throw error;
  }
});
```

**Setup:** Organization settings → Add Endpoint → Set URL + Secret + Events

**Testing:** Sandbox environment available (no real charges)

### Products & Subscriptions [6]
**API base:** `https://api.polar.sh/v1` (prod), `https://sandbox-api.polar.sh/v1` (sandbox)

**Auth:** Organization Access Tokens (OAT)

**Rate limits:** 300 req/min per org/customer/OAuth2 client; 3 req/sec for unauthenticated license validation

**Key endpoints:**
- `GET /v1/subscriptions` - list (paginated: page=1, limit=10-100)
- `GET /v1/products` - list products
- `POST /v1/checkouts` - create checkout session
- `GET /v1/events` - list webhook events

### Refund Handling [5,6]
**Types:** Full + partial refunds supported

**Benefit revocation:**
- One-time purchases: Optional revocation (default: enabled for full refunds)
- Subscriptions: Cannot revoke via order refund - must cancel subscription → auto-revoke on `subscription.revoked`

**Fees:** Payment processing fees (~5%) non-refundable

**Chargeback prevention:** Polar reserves right to force refund within 60 days

**API:** `GET /v1/refunds`, webhook `order.refunded`

### Idempotency
**Documented:** Limited official docs found

**Evidence:** Astro integration uses article slug as idempotency key [9]

**Likely pattern:** Standard `Idempotency-Key` header (not explicitly documented)

**Error handling:** 409 `SubscriptionLocked` when subscription pending update (concurrency control)

---

## SePay.vn API Patterns

### Webhook Configuration [3]
**Create:** `POST /api/v1/webhooks` (Bearer token auth)

**Update:** `PATCH /api/v1/webhooks/{id}`

**Key params:**
- `webhook_url` - destination endpoint
- `event_type` - "In_only", "Out_only", "All"
- `is_verify_payment` - 0/1 flag for verification
- `skip_if_no_code` - skip if no reference code
- `only_va` - restrict to virtual account txns

**Auth types:**
- `No_Authen` - none
- `OAuth2.0` - client credentials flow
- `Api_Key` - header `Authorization: Apikey {KEY}`

**Content types:** JSON, multipart/form-data

### Payment Verification [3,4]
**Flow:**
- SePay sends POST to merchant endpoint
- Merchant must return JSON: `{"success": true}` + 200-201 status
- Non-2xx/3xx = failure

**Payload fields:**
- `id` - unique transaction ID (primary dedup key)
- Bank gateway, timestamp, account details
- `transferAmount`, running balance
- `referenceCode` - payment reference

### Webhook Security [4]
**Auth methods:**
- OAuth 2.0 (access token URL + client ID/secret)
- API Key via Authorization header
- None (not recommended)

**Response validation:** Expects `"success": true` in JSON response

**No explicit signature verification documented** - relies on auth methods

### Idempotency & Duplicate Handling [4]
**Deduplication strategy (explicit recommendation):**
```
Check uniqueness of `id` field OR
Combine: referenceCode + transferType + transferAmount
```

**Retry mechanism:**
- Auto-retry on network failures
- Max 7 retries over 5 hours
- Fibonacci sequence intervals (1min, 1min, 2min, 3min, 5min, etc)
- Configurable via `retry_conditions`:
```json
{
  "retry_conditions": {
    "non_2xx_status_code": 0
  }
}
```

**Testing:** Sandbox at my.dev.sepay.vn for simulated transactions

---

## Comparative Analysis

### Webhook Security
**Polar.sh:**
- ✅ Cryptographic signature (Standard Webhooks HMAC)
- ✅ SDK-based verification
- ✅ Per-endpoint secrets

**SePay.vn:**
- ⚠️ Auth-based (OAuth2/API Key)
- ❌ No signature verification documented
- ⚠️ Vulnerable to replay attacks without client-side dedup

### Idempotency
**Polar.sh:**
- ⚠️ Not explicitly documented
- Evidence suggests header-based pattern
- 409 errors for concurrent operations

**SePay.vn:**
- ✅ Explicit dedup guidance (id field)
- ✅ Retry mechanism documented
- Manual implementation required

### Subscription Lifecycle
**Polar.sh:**
- ✅ Rich event granularity (8 subscription events)
- ✅ Clear cancel vs revoke distinction
- ✅ Billing reason tracking

**SePay.vn:**
- N/A - Transaction-focused, not subscription platform

### Refund Handling
**Polar.sh:**
- ✅ Full + partial refunds
- ✅ Benefit revocation logic
- ⚠️ Non-refundable fees
- ✅ Webhook `order.refunded`

**SePay.vn:**
- Not documented (transaction gateway focus)

---

## Implementation Recommendations

### Polar.sh Best Practices
1. **Webhook verification:** Always use SDK `validateEvent()` - never skip signature check
2. **Event handling:** Store `event.id` to prevent duplicate processing
3. **Subscription state:** Track `cancel_at_period_end` flag, handle `revoked` for access removal
4. **Refunds:** Listen to `order.refunded`, handle benefit revocation separately for subscriptions
5. **Testing:** Use sandbox for full lifecycle testing (purchase → renew → cancel → refund)

### SePay.vn Best Practices
1. **Deduplication:** Implement DB uniqueness constraint on transaction `id` field
2. **Retry safety:** Return 200 + `{"success": true}` even for duplicate transactions (idempotent response)
3. **Verification:** Enable `is_verify_payment: 1` + use OAuth2/API Key auth
4. **Composite keys:** For extra safety, combine `referenceCode + transferAmount + timestamp`
5. **Testing:** Use my.dev.sepay.vn sandbox

### Cross-Platform Patterns
1. **Database design:**
```sql
-- Polar
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL, -- Polar event.id
  event_type VARCHAR(50),
  payload JSONB,
  processed_at TIMESTAMP
);

-- SePay
CREATE TABLE sepay_transactions (
  id UUID PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL, -- SePay id
  reference_code VARCHAR(255),
  amount DECIMAL,
  payload JSONB,
  processed_at TIMESTAMP,
  CONSTRAINT unique_txn UNIQUE (transaction_id, reference_code)
);
```

2. **Webhook handler structure:**
```javascript
async function handleWebhook(platform, payload, headers) {
  // 1. Verify signature (Polar) or auth (SePay)
  // 2. Check deduplication (query by event_id/transaction_id)
  // 3. Process in transaction
  // 4. Return 2xx immediately (acknowledge receipt)
  // 5. Async processing for heavy operations
}
```

3. **Retry handling:** Return success for already-processed events to stop retry loops

---

## Unresolved Questions

1. **Polar.sh:** Official idempotency key header support? (evidence suggests yes, not documented)
2. **Polar.sh:** Webhook retry mechanism details? (count, intervals, backoff strategy)
3. **SePay.vn:** Signature verification options? (HMAC/SHA256 support?)
4. **SePay.vn:** Subscription/recurring payment support? (transaction-only docs)
5. **Both:** Webhook delivery order guarantees? (out-of-order handling needed?)
6. **Both:** Maximum webhook payload size limits?

---

## Token Efficiency Notes
Research covered 10 authoritative sources. Polar.sh has mature webhook infrastructure with Standard Webhooks compliance. SePay.vn more basic but provides explicit retry/dedup guidance. Key gap: SePay lacks cryptographic verification - compensate with strong auth + client-side dedup.
