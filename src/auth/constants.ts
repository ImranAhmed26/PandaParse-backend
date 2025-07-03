export const jwtConstants = {
  accessSecret: process.env.JWT_SECRET || 'access-secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
};
