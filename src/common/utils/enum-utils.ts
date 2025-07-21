// UserRole and OwnerType are now represented as numbers in the database
import { USER_ROLES, OWNER_TYPES, USER_ROLE_STRINGS, OWNER_TYPE_STRINGS } from '../constants/enums';

export class EnumUtils {
  /**
   * Convert numeric UserRole to string representation
   */
  static userRoleToString(role: number): string {
    return USER_ROLE_STRINGS[role as keyof typeof USER_ROLE_STRINGS] || 'UNKNOWN';
  }

  /**
   * Convert string to numeric UserRole
   */
  static stringToUserRole(role: string): number {
    const roleMap: Record<string, number> = {
      ADMIN: USER_ROLES.ADMIN,
      INTERNAL: USER_ROLES.INTERNAL,
      USER: USER_ROLES.USER,
    };
    return roleMap[role.toUpperCase()] || USER_ROLES.USER;
  }

  /**
   * Convert numeric OwnerType to string representation
   */
  static ownerTypeToString(type: number): string {
    return OWNER_TYPE_STRINGS[type as keyof typeof OWNER_TYPE_STRINGS] || 'UNKNOWN';
  }

  /**
   * Convert string to numeric OwnerType
   */
  static stringToOwnerType(type: string): number {
    const typeMap: Record<string, number> = {
      USER: OWNER_TYPES.USER,
      COMPANY: OWNER_TYPES.COMPANY,
    };
    return typeMap[type.toUpperCase()] || OWNER_TYPES.USER;
  }

  /**
   * Check if a value is a valid UserRole
   */
  static isValidUserRole(role: any): role is number {
    return Object.values(USER_ROLES).includes(role);
  }

  /**
   * Check if a value is a valid OwnerType
   */
  static isValidOwnerType(type: any): type is number {
    return Object.values(OWNER_TYPES).includes(type);
  }
}
