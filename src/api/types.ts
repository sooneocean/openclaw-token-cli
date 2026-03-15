// Response envelope
export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// Auth
export interface AuthRegisterRequest {
  email: string;
  password: string;
}

export interface AuthRegisterResponse {
  management_key: string;
  email: string;
  created_at: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  management_key: string;
  email: string;
  last_login: string;
}

export interface AuthMeResponse {
  email: string;
  plan: string;
  credits_remaining: number;
  keys_count: number;
  created_at: string;
}

// Credits
export interface CreditsResponse {
  total_credits: number;
  total_usage: number;
  remaining: number;
}

export interface CreditsPurchaseRequest {
  amount: number;
}

export interface CreditsPurchaseResponse {
  transaction_id: string;
  amount: number;
  platform_fee: number;
  total_charged: number;
  new_balance: number;
  created_at: string;
}

export interface CreditHistoryEntry {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface CreditsHistoryResponse {
  items: CreditHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface AutoTopupConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
}

export interface AutoTopupUpdateRequest {
  enabled?: boolean;
  threshold?: number;
  amount?: number;
}

export interface AutoTopupUpdateResponse extends AutoTopupConfig {
  updated_at: string;
}

// Keys
export interface CreateKeyRequest {
  name: string;
  credit_limit?: number | null;
  limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
  expires_at?: string | null;
}

export interface ProvisionedKey {
  hash: string;
  key?: string;
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;
  disabled: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface KeyDetailResponse extends ProvisionedKey {
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  requests_count: number;
  model_usage: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export interface KeysListResponse {
  items: ProvisionedKey[];
  total: number;
}

export interface KeyRevokeResponse {
  hash: string;
  name: string;
  revoked: boolean;
  revoked_at: string;
}

export interface KeyUpdateRequest {
  credit_limit?: number | null;
  limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
  disabled?: boolean;
}

// Key Rotation
export interface AuthRotateResponse {
  management_key: string;
  email: string;
  rotated_at: string;
}

export interface KeyRotateResponse {
  key: string;
  hash: string;
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;
  disabled: boolean;
  created_at: string;
  expires_at: string | null;
  rotated_at: string;
}

// OAuth Device Flow
export interface OAuthDeviceCodeRequest {
  client_id: string;
}

export interface OAuthDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

export interface OAuthDeviceTokenRequest {
  device_code: string;
  grant_type: string;
}

export interface OAuthDeviceTokenResponse {
  access_token: string;
  token_type: string;
}

export interface OAuthUserInfoResponse {
  management_key: string;
  email: string;
  name: string;
  avatar_url: string;
  merged: boolean;
}

// Legacy aliases for backward compatibility with existing handlers
/** @deprecated Use CreateKeyRequest */
export type KeyCreateRequest = CreateKeyRequest;
/** @deprecated Use KeysListResponse */
export type KeyListResponse = KeysListResponse;
/** @deprecated Use CreditsHistoryResponse */
export type CreditHistoryResponse = CreditsHistoryResponse;
