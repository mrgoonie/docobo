import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { testPrisma } from '../../setup.js';
import { mockGuild, createMockMember } from '../../mocks/discord.js';

// Create mock function for guilds.fetch - cast to any to avoid TS strict type issues
const mockGuildsFetch: any = jest.fn();

// Mock the Discord client using unstable_mockModule for ESM
jest.unstable_mockModule('../../../src/bot/client.js', () => ({
  client: {
    guilds: {
      fetch: mockGuildsFetch,
    },
  },
}));

// Import after mocking
const { client } = await import('../../../src/bot/client.js');
const { grantRoleForSubscription, revokeRoleForSubscription } = await import(
  '../../../src/services/role-automation.js'
);

describe('Role Automation Service', () => {
  let guild: any;
  let role: any;
  let member: any;
  let subscription: any;

  beforeEach(async () => {
    // Create test data
    guild = await testPrisma.guild.create({
      data: {
        guildId: '1234567890123456789',
        guildName: 'Test Server',
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

    subscription = await testPrisma.subscription.create({
      data: {
        memberId: member.id,
        roleId: role.id,
        provider: 'POLAR',
        externalSubscriptionId: 'sub_test_123',
        status: 'ACTIVE',
      },
      include: {
        member: true,
        paidRole: {
          include: { guild: true },
        },
      },
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('grantRoleForSubscription', () => {
    it('should grant role to member', async () => {
      const mockGuildMember = createMockMember();
      const mockRoleObj = {
        id: '9876543210987654321',
        name: 'Premium Member',
        position: 5,
        managed: false,
      };
      const mockDiscordGuild = {
        ...mockGuild,
        roles: {
          fetch: (jest.fn() as any).mockResolvedValue(mockRoleObj),
        },
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(mockGuildMember),
        },
      };

      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      await grantRoleForSubscription(subscription);

      expect(client.guilds.fetch).toHaveBeenCalledWith('1234567890123456789');
      expect(mockDiscordGuild.members.fetch).toHaveBeenCalledWith('1111111111111111111');
      // Role is added as an object, not a string
      expect(mockGuildMember.roles.add).toHaveBeenCalledWith(mockRoleObj);
    });

    it('should handle guild not found gracefully', async () => {
      mockGuildsFetch.mockResolvedValue(null);

      // Should not throw
      await expect(grantRoleForSubscription(subscription)).resolves.not.toThrow();
    });

    it('should handle member not found gracefully', async () => {
      const mockDiscordGuild = {
        ...mockGuild,
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(null),
        },
      };

      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      // Should not throw
      await expect(grantRoleForSubscription(subscription)).resolves.not.toThrow();
    });
  });

  describe('revokeRoleForSubscription', () => {
    it('should revoke role from member', async () => {
      const mockRoleObj = {
        id: '9876543210987654321',
        name: 'Premium Member',
        position: 5,
        managed: false,
      };

      // Create member with role in cache so it can be removed
      const rolesCache = new Map();
      rolesCache.set('9876543210987654321', mockRoleObj);

      const mockGuildMember = {
        user: { id: '1111111111111111111', tag: 'TestUser#1234' },
        id: '1111111111111111111',
        roles: {
          cache: rolesCache,
          add: (jest.fn() as any).mockResolvedValue(undefined),
          remove: (jest.fn() as any).mockResolvedValue(undefined),
        },
        manageable: true,
      };

      const mockDiscordGuild = {
        ...mockGuild,
        roles: {
          fetch: (jest.fn() as any).mockResolvedValue(mockRoleObj),
        },
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(mockGuildMember),
        },
      };

      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      await revokeRoleForSubscription(subscription);

      expect(client.guilds.fetch).toHaveBeenCalledWith('1234567890123456789');
      expect(mockDiscordGuild.members.fetch).toHaveBeenCalledWith('1111111111111111111');
      // Role is removed as an object, not a string
      expect(mockGuildMember.roles.remove).toHaveBeenCalledWith(mockRoleObj);
    });

    it('should handle guild not found gracefully', async () => {
      mockGuildsFetch.mockResolvedValue(null);

      // Should not throw
      await expect(revokeRoleForSubscription(subscription)).resolves.not.toThrow();
    });

    it('should handle member not found gracefully', async () => {
      const mockDiscordGuild = {
        ...mockGuild,
        members: {
          fetch: (jest.fn() as any).mockResolvedValue(null),
        },
      };

      mockGuildsFetch.mockResolvedValue(mockDiscordGuild);

      // Should not throw
      await expect(revokeRoleForSubscription(subscription)).resolves.not.toThrow();
    });
  });
});
