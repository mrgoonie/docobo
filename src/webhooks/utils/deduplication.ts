import { prisma } from '../../services/database.js';
import { PaymentProvider, WebhookEventType } from '@prisma/client';

// Check if webhook event already exists (deduplication)
export async function checkDuplication(
  externalEventId: string,
  _provider: PaymentProvider
): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalEventId },
  });
  return existing !== null;
}

// Record webhook event to database
export async function recordWebhookEvent(
  externalEventId: string,
  provider: PaymentProvider,
  eventType: WebhookEventType,
  rawPayload: unknown,
  subscriptionId?: string
): Promise<string> {
  const event = await prisma.webhookEvent.create({
    data: {
      externalEventId,
      provider,
      eventType,
      rawPayload: rawPayload as object,
      subscriptionId,
      processed: false,
    },
  });
  return event.id;
}

// Mark webhook event as processed
export async function markEventProcessed(
  externalEventId: string,
  errorMessage?: string
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { externalEventId },
    data: {
      processed: !errorMessage,
      processedAt: errorMessage ? undefined : new Date(),
      errorMessage,
    },
  });
}
