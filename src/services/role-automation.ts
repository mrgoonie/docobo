import { client } from '../bot/client.js';
import { grantRole, revokeRole } from '../bot/utils/roles.js';
import { Subscription, PaidRole, Member, Guild } from '@prisma/client';

// Subscription with all required relations for role automation
type SubscriptionWithRelations = Subscription & {
  member: Member;
  paidRole: PaidRole & {
    guild: Guild;
  };
};

// Grant role when subscription becomes active
export async function grantRoleForSubscription(
  subscription: SubscriptionWithRelations
): Promise<boolean> {
  try {
    const discordGuildId = subscription.paidRole.guild.guildId;
    const guild = await client.guilds.fetch(discordGuildId);

    if (!guild) {
      console.error(`Guild not found: ${discordGuildId}`);
      return false;
    }

    const success = await grantRole(
      guild,
      subscription.member.userId,
      subscription.paidRole.roleId
    );

    if (success) {
      console.warn(
        `✅ Granted role ${subscription.paidRole.roleName} to user ${subscription.member.userId}`
      );
    }

    return success;
  } catch (error) {
    console.error('Error granting role for subscription:', error);
    return false;
  }
}

// Revoke role when subscription is cancelled/revoked/refunded
export async function revokeRoleForSubscription(
  subscription: SubscriptionWithRelations
): Promise<boolean> {
  try {
    const discordGuildId = subscription.paidRole.guild.guildId;
    const guild = await client.guilds.fetch(discordGuildId);

    if (!guild) {
      console.error(`Guild not found: ${discordGuildId}`);
      return false;
    }

    const success = await revokeRole(
      guild,
      subscription.member.userId,
      subscription.paidRole.roleId
    );

    if (success) {
      console.warn(
        `✅ Revoked role ${subscription.paidRole.roleName} from user ${subscription.member.userId}`
      );
    }

    return success;
  } catch (error) {
    console.error('Error revoking role for subscription:', error);
    return false;
  }
}
