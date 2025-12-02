import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { testPrisma } from '../setup.js';
import { createMockMember } from '../mocks/discord.js';
import { polarWebhookPayloads } from '../mocks/webhooks.js';

// Create mock function for guilds.fetch
const mockGuildsFetch: any = jest.fn();

// Mock the Discord client using unstable_mockModule for ESM
jest.unstable_mockModule('../../src/bot/client.js', () => ({
  client: {
    guilds: {
      fetch: mockGuildsFetch,
    },
  },
}));

// Import after mocking
const { client } = await import('../../src/bot/client.js');
const { processPolarEvent } = await import('../../src/webhooks/services/polar-service.js');

describe('E2E: Payment to Role Grant Flow', () => {
  let guild: any;
  let role: any;
  let member: any;

  beforeEach(async () => {
    // Create test data
    guild = await testPrisma.guild.create({
      data: {
        guildId: '1234567890123456789',
        guildName: 'Test Server',
        polarEnabled: true,
      },
    });

    role = await testPrisma.paidRole.create({
      data: {
        guildId: guild.id,
        roleId: '9876543210987654321',
        roleName: 'Premium Member',
        priceUsd: 15.0,
      },
    });

    member = await testPrisma.member.create({
      data: {
        userId: '1111111111111111111',
        guildId: guild.id,
        username: 'TestUser#1234',
      },
    });

    jest.clearAllMocks();
  });

  describe('Subscription Activation Flow', () => {
    // TODO: Fix E2E tests to properly set up subscription -> paidRole -> guild relationships
    it.skip('should grant role when subscription becomes active', async () => {
      // Create pending subscription
      const subscription = await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_polar_test_123',
          status: 'PENDING',
        },
      });

      // Setup Discord mocks
      const mockGuildMember = createMockMember();
      const mockDiscordGuild = {
        id: '1234567890123456789',
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(mockGuildMember),
        },
      };
      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      // Process subscription.active event
      const activeEvent = {
        ...polarWebhookPayloads.subscriptionActive,
        id: 'evt_active_e2e_001',
        data: {
          ...polarWebhookPayloads.subscriptionActive.data,
          id: 'sub_polar_test_123',
        },
      };

      await processPolarEvent(activeEvent);

      // Verify subscription status updated
      const updatedSub = await testPrisma.subscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updatedSub?.status).toBe('ACTIVE');

      // Verify role granted
      expect(mockGuildMember.roles.add).toHaveBeenCalledWith('9876543210987654321');

      // Verify webhook event recorded
      const webhookEvent = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_active_e2e_001' },
      });
      expect(webhookEvent).not.toBeNull();
      expect(webhookEvent?.processed).toBe(true);
    });
  });

  describe('Subscription Revocation Flow', () => {
    it.skip('should revoke role when subscription is revoked', async () => {
      // Create active subscription
      await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_polar_test_456',
          status: 'ACTIVE',
        },
      });

      // Setup Discord mocks
      const mockGuildMember = createMockMember();
      const mockDiscordGuild = {
        id: '1234567890123456789',
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(mockGuildMember),
        },
      };
      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      // Process subscription.revoked event
      const revokedEvent = {
        ...polarWebhookPayloads.subscriptionRevoked,
        id: 'evt_revoked_e2e_001',
        data: {
          ...polarWebhookPayloads.subscriptionRevoked.data,
          id: 'sub_polar_test_456',
        },
      };

      await processPolarEvent(revokedEvent);

      // Verify subscription status updated
      const updatedSub = await testPrisma.subscription.findFirst({
        where: { externalSubscriptionId: 'sub_polar_test_456' },
      });
      expect(updatedSub?.status).toBe('REVOKED');

      // Verify role revoked
      expect(mockGuildMember.roles.remove).toHaveBeenCalledWith('9876543210987654321');

      // Verify webhook event recorded
      const webhookEvent = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_revoked_e2e_001' },
      });
      expect(webhookEvent).not.toBeNull();
      expect(webhookEvent?.processed).toBe(true);
    });
  });

  describe('Subscription Cancellation Flow', () => {
    it('should mark subscription as cancelled but not revoke role immediately', async () => {
      // Create active subscription
      const subscription = await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_polar_test_789',
          status: 'ACTIVE',
        },
      });

      // Process subscription.canceled event
      const canceledEvent = {
        ...polarWebhookPayloads.subscriptionCanceled,
        id: 'evt_canceled_e2e_001',
        data: {
          ...polarWebhookPayloads.subscriptionCanceled.data,
          id: 'sub_polar_test_789',
        },
      };

      await processPolarEvent(canceledEvent);

      // Verify subscription marked as cancelled
      const updatedSub = await testPrisma.subscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updatedSub?.status).toBe('CANCELLED');
      expect(updatedSub?.cancelAtPeriodEnd).toBe(true);

      // Role should NOT be revoked yet (will revoke at period end)
      // This is handled by subscription.revoked event later
    });
  });

  describe('Order Refund Flow', () => {
    it.skip('should revoke role when order is refunded', async () => {
      // Create active subscription
      await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_polar_test_refund',
          status: 'ACTIVE',
        },
      });

      // Setup Discord mocks
      const mockGuildMember = createMockMember();
      const mockDiscordGuild = {
        id: '1234567890123456789',
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(mockGuildMember),
        },
      };
      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      // Process order.refunded event
      const refundEvent = {
        ...polarWebhookPayloads.orderRefunded,
        id: 'evt_refund_e2e_001',
        data: {
          ...polarWebhookPayloads.orderRefunded.data,
          id: 'sub_polar_test_refund',
        },
      };

      await processPolarEvent(refundEvent);

      // Verify subscription status updated
      const updatedSub = await testPrisma.subscription.findFirst({
        where: { externalSubscriptionId: 'sub_polar_test_refund' },
      });
      expect(updatedSub?.status).toBe('REFUNDED');

      // Verify role revoked
      expect(mockGuildMember.roles.remove).toHaveBeenCalledWith('9876543210987654321');
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription not found gracefully', async () => {
      const unknownEvent = {
        ...polarWebhookPayloads.subscriptionActive,
        id: 'evt_unknown_sub_001',
        data: {
          ...polarWebhookPayloads.subscriptionActive.data,
          id: 'sub_does_not_exist',
        },
      };

      // Should not throw
      await expect(processPolarEvent(unknownEvent)).resolves.not.toThrow();

      // Event should still be recorded
      const webhookEvent = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_unknown_sub_001' },
      });
      expect(webhookEvent).not.toBeNull();
    });

    it('should handle Discord API errors gracefully', async () => {
      // Create subscription
      await testPrisma.subscription.create({
        data: {
          memberId: member.id,
          roleId: role.id,
          provider: 'POLAR',
          externalSubscriptionId: 'sub_discord_error',
          status: 'PENDING',
        },
      });

      // Mock Discord error
      mockGuildsFetch.mockRejectedValue(new Error('Discord API Error'));

      const activeEvent = {
        ...polarWebhookPayloads.subscriptionActive,
        id: 'evt_discord_error_001',
        data: {
          ...polarWebhookPayloads.subscriptionActive.data,
          id: 'sub_discord_error',
        },
      };

      // Should handle error gracefully (no throw, just logs)
      await expect(processPolarEvent(activeEvent)).resolves.not.toThrow();

      // Event should be recorded
      const webhookEvent = await testPrisma.webhookEvent.findUnique({
        where: { externalEventId: 'evt_discord_error_001' },
      });
      expect(webhookEvent).not.toBeNull();
    });
  });
});
