import { createHmac, timingSafeEqual } from 'crypto';

// Standard Webhooks signature verification (Polar uses this spec)
// Spec: https://github.com/standard-webhooks/standard-webhooks
export function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  // Get required headers (Standard Webhooks spec)
  const webhookId = getHeader(headers, 'webhook-id');
  const webhookTimestamp = getHeader(headers, 'webhook-timestamp');
  const webhookSignature = getHeader(headers, 'webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new WebhookVerificationError('Missing required webhook headers');
  }

  // Check timestamp is within 5 minutes (prevent replay attacks)
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new WebhookVerificationError('Webhook timestamp too old');
  }

  // Build signed content: "{id}.{timestamp}.{payload}"
  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;

  // Decode base64 secret (Standard Webhooks prefixes with "whsec_")
  const secretBytes = decodeSecret(secret);

  // Compute expected signature
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // Parse signature header (may contain multiple sigs: "v1,<sig1> v1,<sig2>")
  const signatures = webhookSignature.split(' ');
  for (const sig of signatures) {
    const [version, signature] = sig.split(',');
    if (version === 'v1' && signature) {
      try {
        if (timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
          return true;
        }
      } catch {
        // Continue to next signature if comparison fails
      }
    }
  }

  throw new WebhookVerificationError('Invalid webhook signature');
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function decodeSecret(secret: string): Buffer {
  // Standard Webhooks secrets start with "whsec_"
  const prefix = 'whsec_';
  if (secret.startsWith(prefix)) {
    return Buffer.from(secret.substring(prefix.length), 'base64');
  }
  return Buffer.from(secret, 'base64');
}

// Custom error class for webhook verification failures
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
