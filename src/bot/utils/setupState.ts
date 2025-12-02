import { prisma } from '../../services/database.js';

interface SetupState {
  step: number;
  selectedRoles?: string[]; // Role IDs
  pricing?: Record<string, number>; // roleId -> price
  paymentMethods?: ('polar' | 'sepay')[];
  completed: boolean;
}

export async function getSetupState(guildId: string): Promise<SetupState | null> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
  });

  if (!guild?.settings) return null;

  const settings = guild.settings as Record<string, unknown>;
  return (settings.setupState as SetupState) || null;
}

export async function updateSetupState(
  guildId: string,
  updates: Partial<SetupState>
): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
  });

  const currentSettings = (guild?.settings as Record<string, unknown>) || {};
  const currentState = (currentSettings.setupState as SetupState) || { step: 1, completed: false };

  await prisma.guild.update({
    where: { guildId },
    data: {
      settings: {
        ...currentSettings,
        setupState: {
          ...currentState,
          ...updates,
        },
      },
    },
  });
}

export async function clearSetupState(guildId: string): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
  });

  const currentSettings = (guild?.settings as Record<string, unknown>) || {};

  await prisma.guild.update({
    where: { guildId },
    data: {
      settings: {
        ...currentSettings,
        setupState: null,
      },
    },
  });
}
