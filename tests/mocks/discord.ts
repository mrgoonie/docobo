import type { Guild, GuildMember, Role, User, Client, Collection } from 'discord.js';
import { jest } from '@jest/globals';

// Mock user
export const mockUser = {
  id: '1111111111111111111',
  tag: 'TestUser#1234',
  username: 'TestUser',
  displayName: 'Test User',
} as unknown as User;

// Mock role
export const mockRole = {
  id: '9876543210987654321',
  name: 'Premium Member',
  position: 5,
  managed: false,
} as unknown as Role;

// Mock member with role management
export const createMockMember = (): GuildMember => {
  const rolesCache = new Map<string, Role>();

  return {
    user: mockUser,
    id: mockUser.id,
    roles: {
      cache: rolesCache as unknown as Collection<string, Role>,
      add: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    },
    manageable: true,
  } as unknown as GuildMember;
};

// Mock guild
export const createMockGuild = (id = '1234567890123456789'): Guild => {
  const rolesCache = new Map<string, Role>();
  rolesCache.set(mockRole.id, mockRole);

  const membersCache = new Map<string, GuildMember>();
  const mockMember = createMockMember();
  membersCache.set(mockMember.id, mockMember);

  return {
    id,
    name: 'Test Server',
    roles: {
      cache: rolesCache as unknown as Collection<string, Role>,
      fetch: jest.fn().mockImplementation((roleId: unknown) => {
        return Promise.resolve(rolesCache.get(roleId as string) || null);
      }),
    },
    members: {
      cache: membersCache as unknown as Collection<string, GuildMember>,
      fetch: jest.fn().mockImplementation((userId: unknown) => {
        return Promise.resolve(membersCache.get(userId as string) || null);
      }),
      me: {
        permissions: {
          has: jest.fn(() => true),
        },
        roles: {
          highest: {
            position: 10,
          },
        },
      },
    },
  } as unknown as Guild;
};

// Mock Discord client
export const createMockClient = (): Client => {
  const guildsCache = new Map<string, Guild>();
  const mockGuild = createMockGuild();
  guildsCache.set(mockGuild.id, mockGuild);

  return {
    user: {
      id: '0000000000000000000',
      tag: 'DocoboBot#0001',
    },
    guilds: {
      cache: guildsCache as unknown as Collection<string, Guild>,
      fetch: jest.fn().mockImplementation((guildId: unknown) => {
        return Promise.resolve(guildsCache.get(guildId as string) || null);
      }),
    },
    isReady: jest.fn(() => true),
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn<() => Promise<string>>().mockResolvedValue('mock_token'),
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as Client;
};

// Pre-create instances lazily to avoid circular initialization issues
let _mockGuild: Guild | null = null;
let _mockMember: GuildMember | null = null;
let _mockClient: Client | null = null;

export const getMockGuild = (): Guild => {
  if (!_mockGuild) _mockGuild = createMockGuild();
  return _mockGuild;
};

export const getMockMember = (): GuildMember => {
  if (!_mockMember) _mockMember = createMockMember();
  return _mockMember;
};

export const getMockClient = (): Client => {
  if (!_mockClient) _mockClient = createMockClient();
  return _mockClient;
};

// Export aliases for backward compatibility
export const mockGuild = createMockGuild();
export const mockMember = createMockMember();
export const mockClient = createMockClient();
