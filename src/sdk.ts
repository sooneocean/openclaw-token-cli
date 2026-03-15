// openclaw-token SDK — programmatic API for agents and applications
//
// Usage:
//   import { KeysService, CreditsService } from 'openclaw-token/sdk';
//   const keys = new KeysService({ mock: false });
//   const list = await keys.list('sk-mgmt-...');

// Services
export { AuthService } from './services/auth.service.js';
export { CreditsService } from './services/credits.service.js';
export { KeysService } from './services/keys.service.js';
export { OAuthService } from './services/oauth.service.js';
export { BaseService } from './services/base.service.js';
export type { ServiceOptions } from './services/base.service.js';

// Config
export { ConfigManager } from './config/manager.js';
export {
  getConfigDir,
  getProfileDir,
  getActiveProfile,
  setActiveProfile,
  DEFAULT_API_BASE,
  DEFAULT_PROFILE,
} from './config/paths.js';

// API Client
export { createApiClient } from './api/client.js';
export type { ApiClientOptions } from './api/client.js';
export { ENDPOINTS } from './api/endpoints.js';

// Types (all request/response interfaces)
export type {
  ApiResponse,
  ApiErrorResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthMeResponse,
  AuthRotateResponse,
  CreditsResponse,
  CreditsPurchaseRequest,
  CreditsPurchaseResponse,
  CreditHistoryEntry,
  CreditsHistoryResponse,
  AutoTopupConfig,
  AutoTopupUpdateRequest,
  AutoTopupUpdateResponse,
  CreateKeyRequest,
  ProvisionedKey,
  KeyDetailResponse,
  KeysListResponse,
  KeyRevokeResponse,
  KeyUpdateRequest,
  KeyRotateResponse,
  OAuthDeviceCodeRequest,
  OAuthDeviceCodeResponse,
  OAuthDeviceTokenRequest,
  OAuthDeviceTokenResponse,
  OAuthUserInfoResponse,
} from './api/types.js';

// Audit
export { AuditLogger } from './audit/logger.js';
