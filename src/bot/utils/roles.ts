import { Guild, Role } from 'discord.js';

// Grant a role to a user
export async function grantRole(guild: Guild, userId: string, roleId: string): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      console.error(`❌ Role not found: ${roleId}`);
      return false;
    }

    // Check if member already has role
    if (member.roles.cache.has(roleId)) {
      console.warn(`ℹ️ Member already has role: ${role.name}`);
      return true;
    }

    await member.roles.add(role);
    console.warn(`✅ Granted role ${role.name} to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to grant role:`, error);
    return false;
  }
}

// Revoke a role from a user
export async function revokeRole(guild: Guild, userId: string, roleId: string): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      console.error(`❌ Role not found: ${roleId}`);
      return false;
    }

    // Check if member has role
    if (!member.roles.cache.has(roleId)) {
      console.warn(`ℹ️ Member doesn't have role: ${role.name}`);
      return true;
    }

    await member.roles.remove(role);
    console.warn(`✅ Revoked role ${role.name} from ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to revoke role:`, error);
    return false;
  }
}

// Check if bot can manage a target role (position hierarchy)
export function checkBotRolePosition(guild: Guild, targetRole: Role): boolean {
  const botMember = guild.members.me;
  if (!botMember) return false;

  const botHighestRole = botMember.roles.highest;
  return botHighestRole.position > targetRole.position;
}

// Validate bot has permission to manage roles
export function canManageRoles(guild: Guild): boolean {
  const botMember = guild.members.me;
  if (!botMember) return false;

  return botMember.permissions.has('ManageRoles');
}
