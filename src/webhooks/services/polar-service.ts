import { prisma } from '../../services/database.js';
import {
  grantRoleForSubscription,
  revokeRoleForSubscription,
} from '../../services/role-automation.js';
import { recordWebhookEvent, markEventProcessed } from '../utils/deduplication.js';
import { PaymentProvider, SubscriptionStatus, WebhookEventType } from '@prisma/client';

// Polar webhook event structure
interface PolarEvent {
  id: string;
  type: string;
  data: {
    id: string;
    [key: string]: unknown;
  };
}

// Map Polar event types to our enum
function mapEventType(polarType: string): WebhookEventType {
  const mapping: Record<string, WebhookEventType> = {
    'subscription.created': 'SUBSCRIPTION_CREATED',
    'subscription.updated': 'SUBSCRIPTION_UPDATED',
    'subscription.active': 'SUBSCRIPTION_ACTIVE',
    'subscription.canceled': 'SUBSCRIPTION_CANCELED',
    'subscription.uncanceled': 'SUBSCRIPTION_UNCANCELED',
    'subscription.revoked': 'SUBSCRIPTION_REVOKED',
    'order.created': 'ORDER_CREATED',
    'order.updated': 'ORDER_UPDATED',
    'order.paid': 'ORDER_PAID',
    'order.refunded': 'ORDER_REFUNDED',
  };
  return mapping[polarType] ?? 'SUBSCRIPTION_UPDATED';
}

export async function processPolarEvent(event: PolarEvent): Promise<void> {
  console.warn(`Processing Polar event: ${event.type} (${event.id})`);

  const eventType = mapEventType(event.type);

  try {
    // Record webhook event first
    await recordWebhookEvent(event.id, PaymentProvider.POLAR, eventType, event.data);

    // Handle subscription lifecycle events
    switch (event.type) {
      case 'subscription.created':
        handleSubscriptionCreated(event);
        break;

      case 'subscription.active':
        await handleSubscriptionActive(event);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event);
        break;

      case 'subscription.revoked':
        await handleSubscriptionRevoked(event);
        break;

      case 'order.paid':
        handleOrderPaid(event);
        break;

      case 'order.refunded':
        await handleOrderRefunded(event);
        break;

      default:
        console.warn(`Unhandled Polar event type: ${event.type}`);
    }

    // Mark as processed
    await markEventProcessed(event.id);
  } catch (error) {
    console.error(`Error processing Polar event ${event.id}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await markEventProcessed(event.id, errorMsg);
    throw error;
  }
}

function handleSubscriptionCreated(event: PolarEvent): void {
  // Log subscription creation - actual activation via subscription.active event
  console.warn(`Subscription created: ${event.data.id}`);
}

async function handleSubscriptionActive(event: PolarEvent): Promise<void> {
  // Find or update subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      externalSubscriptionId: event.data.id,
      provider: PaymentProvider.POLAR,
    },
    include: {
      member: true,
      paidRole: {
        include: { guild: true },
      },
    },
  });

  if (!subscription) {
    console.warn(`Subscription not found for active event: ${event.data.id}`);
    return;
  }

  // Update status to ACTIVE
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.ACTIVE },
  });

  // Grant role to member
  await grantRoleForSubscription(subscription);
}

async function handleSubscriptionCanceled(event: PolarEvent): Promise<void> {
  // Mark as cancelled (will be revoked at period end)
  const subscription = await prisma.subscription.findFirst({
    where: {
      externalSubscriptionId: event.data.id,
      provider: PaymentProvider.POLAR,
    },
  });

  if (!subscription) {
    console.warn(`Subscription not found for cancel event: ${event.data.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
    },
  });

  console.warn(`Subscription cancelled (will revoke at period end): ${event.data.id}`);
}

async function handleSubscriptionRevoked(event: PolarEvent): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      externalSubscriptionId: event.data.id,
      provider: PaymentProvider.POLAR,
    },
    include: {
      member: true,
      paidRole: {
        include: { guild: true },
      },
    },
  });

  if (!subscription) {
    console.warn(`Subscription not found for revoke event: ${event.data.id}`);
    return;
  }

  // Update status to REVOKED
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.REVOKED },
  });

  // Revoke role from member
  await revokeRoleForSubscription(subscription);
}

function handleOrderPaid(event: PolarEvent): void {
  console.warn(`Order paid: ${event.data.id}`);
  // Subscription activation handled by 'subscription.active' event
}

async function handleOrderRefunded(event: PolarEvent): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      externalSubscriptionId: event.data.id,
      provider: PaymentProvider.POLAR,
    },
    include: {
      member: true,
      paidRole: {
        include: { guild: true },
      },
    },
  });

  if (!subscription) {
    console.warn(`Subscription not found for refund event: ${event.data.id}`);
    return;
  }

  // Update status to REFUNDED
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.REFUNDED },
  });

  // Revoke role (refund = access removed)
  await revokeRoleForSubscription(subscription);
}
