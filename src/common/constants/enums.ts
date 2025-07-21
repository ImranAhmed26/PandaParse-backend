export const USER_ROLES = {
  ADMIN: 0,
  INTERNAL: 1,
  USER: 2,
} as const;

export const OWNER_TYPES = {
  USER: 0,
  COMPANY: 1,
} as const;

export type UserRoleValue = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type OwnerTypeValue = (typeof OWNER_TYPES)[keyof typeof OWNER_TYPES];

// String representations for API responses
export const USER_ROLE_STRINGS = {
  [USER_ROLES.ADMIN]: 'ADMIN',
  [USER_ROLES.INTERNAL]: 'INTERNAL',
  [USER_ROLES.USER]: 'USER',
} as const;

export const OWNER_TYPE_STRINGS = {
  [OWNER_TYPES.USER]: 'USER',
  [OWNER_TYPES.COMPANY]: 'COMPANY',
} as const;
