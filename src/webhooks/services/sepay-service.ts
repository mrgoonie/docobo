import { prisma } from '../../services/database.js';
import { grantRoleForSubscription } from '../../services/role-automation.js';
import { recordWebhookEvent, markEventProcessed } from '../utils/deduplication.js';
import { PaymentProvider, SubscriptionStatus } from '@prisma/client';

// SePay transaction structure
interface SepayTransaction {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  transferType: string;
  transferAmount: number;
  accumulated: number;
  code: string | null;
  transactionContent: string;
  referenceCode: string;
  description: string;
}

export async function processSepayTransaction(transaction: SepayTransaction): Promise<void> {
  const transactionId = String(transaction.id);
  console.warn(`Processing SePay transaction: ${transactionId}`);

  try {
    // Record webhook event first
    await recordWebhookEvent(transactionId, PaymentProvider.SEPAY, 'PAYMENT_IN', transaction);

    // Parse reference code to find subscription info
    // Expected format: DOCOBO-<guildId>-<roleId>-<userId>
    // Or custom format defined by merchant
    const subscriptionInfo = parseReferenceCode(transaction.referenceCode);

    if (!subscriptionInfo) {
      console.warn(`Could not parse reference code: ${transaction.referenceCode}`);
      await markEventProcessed(transactionId);
      return;
    }

    // Find the paid role by guildId and roleId
    const paidRole = await prisma.paidRole.findFirst({
      where: {
        guild: { guildId: subscriptionInfo.guildId },
        roleId: subscriptionInfo.roleId,
        isActive: true,
      },
      include: { guild: true },
    });

    if (!paidRole) {
      console.warn(
        `Paid role not found for guild ${subscriptionInfo.guildId}, role ${subscriptionInfo.roleId}`
      );
      await markEventProcessed(transactionId);
      return;
    }

    // Verify payment amount matches role price
    const expectedAmount = Number(paidRole.priceUsd);
    if (transaction.transferAmount < expectedAmount) {
      console.warn(
        `Insufficient payment: received ${transaction.transferAmount}, expected ${expectedAmount}`
      );
      await markEventProcessed(
        transactionId,
        `Insufficient payment: ${transaction.transferAmount} < ${expectedAmount}`
      );
      return;
    }

    // Find or create member
    let member = await prisma.member.findUnique({
      where: {
        userId_guildId: {
          userId: subscriptionInfo.userId,
          guildId: paidRole.guildId,
        },
      },
    });

    if (!member) {
      member = await prisma.member.create({
        data: {
          userId: subscriptionInfo.userId,
          guildId: paidRole.guildId,
          username: `User-${subscriptionInfo.userId}`, // Will be updated when they interact with bot
        },
      });
    }

    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        memberId: member.id,
        roleId: paidRole.id,
        provider: PaymentProvider.SEPAY,
        externalSubscriptionId: transactionId,
        status: SubscriptionStatus.ACTIVE,
        metadata: {
          gateway: transaction.gateway,
          transactionDate: transaction.transactionDate,
          transferAmount: transaction.transferAmount,
          referenceCode: transaction.referenceCode,
        },
      },
      include: {
        member: true,
        paidRole: {
          include: { guild: true },
        },
      },
    });

    // Grant role to member
    await grantRoleForSubscription(subscription);

    // Mark as processed
    await markEventProcessed(transactionId);

    console.warn(`SePay payment processed successfully: ${transactionId}`);
  } catch (error) {
    console.error(`Error processing SePay transaction ${transactionId}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await markEventProcessed(transactionId, errorMsg);
    throw error;
  }
}

// Parse reference code to extract subscription info
// Expected format: DOCOBO-<guildId>-<roleId>-<userId>
interface SubscriptionInfo {
  guildId: string;
  roleId: string;
  userId: string;
}

function parseReferenceCode(code: string): SubscriptionInfo | null {
  if (!code) return null;

  // Try standard DOCOBO format
  const docoboMatch = code.match(/^DOCOBO-(\d+)-(\d+)-(\d+)$/);
  if (docoboMatch) {
    return {
      guildId: docoboMatch[1],
      roleId: docoboMatch[2],
      userId: docoboMatch[3],
    };
  }

  // Try alternative format: just extract Discord IDs (18-19 digit numbers)
  const discordIds = code.match(/\d{17,19}/g);
  if (discordIds && discordIds.length >= 3) {
    return {
      guildId: discordIds[0],
      roleId: discordIds[1],
      userId: discordIds[2],
    };
  }

  return null;
}
