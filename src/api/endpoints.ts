export const ENDPOINTS = {
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGIN: '/auth/login',
  AUTH_ME: '/auth/me',
  CREDITS: '/credits',
  CREDITS_PURCHASE: '/credits/purchase',
  CREDITS_HISTORY: '/credits/history',
  CREDITS_AUTO_TOPUP: '/credits/auto-topup',
  KEYS: '/keys',
  KEY_DETAIL: (hash: string) => `/keys/${hash}`,
} as const;
