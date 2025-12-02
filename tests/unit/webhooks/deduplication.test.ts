import { testPrisma } from '../../setup.js';
import {
  checkDuplication,
  recordWebhookEvent,
  markEventProcessed,
} from '../../../src/webhooks/utils/deduplication.js';

describe('Webhook Deduplication', () => {
  describe('checkDuplication', () => {
    it('should return false for new event', async () => {
      const isDuplicate = await checkDuplication('evt_new_123', 'POLAR');
      expect(isDuplicate).toBe(false);
    });

    it('should return true for existing event', async () => {
      // Create existing event
      await testPrisma.webhookEvent.create({
        data: {
          externalEventId: 'evt_existing_456',
          provider: 'POLAR',
          eventType: 'SUBSCRIPTION_CREATED',
          rawPayload: { test: 'data' },
        },
      });

      const isDuplicate = await checkDuplication('evt_existing_456', 'POLAR');
      expect(isDuplicate).toBe(true);
    });
  });

  describe('recordWebhookEvent', () => {
    it('should create webhook event record', async () => {
      const eventId = await recordWebhookEvent('evt_record_789', 'POLAR', 'SUBSCRIPTION_ACTIVE', {
        subscription_id: 'sub_123',
      });

      expect(eventId).toBeTruthy();

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_record_789' },
      });

      expect(event).not.toBeNull();
      expect(event?.provider).toBe('POLAR');
      expect(event?.eventType).toBe('SUBSCRIPTION_ACTIVE');
      expect(event?.processed).toBe(false);
      expect(event?.rawPayload).toEqual({ subscription_id: 'sub_123' });
    });

    it('should throw error on duplicate event ID', async () => {
      await recordWebhookEvent('evt_duplicate_001', 'POLAR', 'ORDER_PAID', {});

      await expect(
        recordWebhookEvent('evt_duplicate_001', 'POLAR', 'ORDER_PAID', {})
      ).rejects.toThrow();
    });

    it('should link to subscription if provided', async () => {
      // Create guild and subscription first
      const guild = await testPrisma.guild.create({
        data: {
          guildId: '1234567890123456789',
          guildName: 'Test Server',
        },
      });

      const role = await testPrisma.paidRole.create({
        data: {
          guildId: guild.id,
          roleId: '9876543210987654321',
          roleName: 'Premium',
          priceUsd: 15.0,
        },
      });

      const member = await testPrisma.member.create({
        data: {
          userId: '1111111111111111111',
          guildId: guild.id,
          username: 'TestUser',
        },
      });

      const subscription = await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_test',
          status: 'ACTIVE',
        },
      });

      await recordWebhookEvent(
        'evt_linked_001',
        'POLAR',
        'SUBSCRIPTION_UPDATED',
        {},
        subscription.id
      );

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_linked_001' },
      });

      expect(event?.subscriptionId).toBe(subscription.id);
    });
  });

  describe('markEventProcessed', () => {
    it('should mark event as processed successfully', async () => {
      await testPrisma.webhookEvent.create({
        data: {
          externalEventId: 'evt_mark_001',
          provider: 'SEPAY',
          eventType: 'PAYMENT_IN',
          rawPayload: {},
          processed: false,
        },
      });

      await markEventProcessed('evt_mark_001');

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_mark_001' },
      });

      expect(event?.processed).toBe(true);
      expect(event?.processedAt).not.toBeNull();
      expect(event?.errorMessage).toBeNull();
    });

    it('should mark event with error message', async () => {
      await testPrisma.webhookEvent.create({
        data: {
          externalEventId: 'evt_error_001',
          provider: 'POLAR',
          eventType: 'SUBSCRIPTION_CREATED',
          rawPayload: {},
          processed: false,
        },
      });

      await markEventProcessed('evt_error_001', 'Role not found');

      const event = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_error_001' },
      });

      expect(event?.processed).toBe(false);
      expect(event?.errorMessage).toBe('Role not found');
    });
  });
});
