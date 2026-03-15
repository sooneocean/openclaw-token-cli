import { createApiClient } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { ApiResponse, ProvisionedKey, KeyDetailResponse, KeysListResponse, KeyRevokeResponse, KeyRotateResponse, CreateKeyRequest, KeyUpdateRequest } from '../api/types.js';
import { ConfigManager } from '../config/manager.js';

export interface KeysServiceOptions {
  mock: boolean;
  verbose?: boolean;
}

export class KeysService {
  private options: KeysServiceOptions;

  constructor(options: KeysServiceOptions) {
    this.options = options;
  }

  private async getClient(token: string) {
    const resolved = await ConfigManager.resolve();
    return createApiClient({
      mock: this.options.mock,
      baseURL: resolved.api_base,
      token,
      verbose: this.options.verbose,
    });
  }

  async create(token: string, params: CreateKeyRequest): Promise<ProvisionedKey> {
    const client = await this.getClient(token);
    const resp = await client.post<ApiResponse<ProvisionedKey>>(ENDPOINTS.KEYS, params);
    return resp.data.data;
  }

  async list(token: string, includeRevoked = false): Promise<KeysListResponse> {
    const client = await this.getClient(token);
    const qs = includeRevoked ? '?include_revoked=true' : '';
    const resp = await client.get<ApiResponse<KeysListResponse>>(`${ENDPOINTS.KEYS}${qs}`);
    return resp.data.data;
  }

  async info(token: string, hash: string): Promise<KeyDetailResponse> {
    const client = await this.getClient(token);
    const resp = await client.get<ApiResponse<KeyDetailResponse>>(ENDPOINTS.KEY_DETAIL(hash));
    return resp.data.data;
  }

  async update(token: string, hash: string, params: KeyUpdateRequest): Promise<ProvisionedKey> {
    const client = await this.getClient(token);
    const resp = await client.patch<ApiResponse<ProvisionedKey>>(ENDPOINTS.KEY_DETAIL(hash), params);
    return resp.data.data;
  }

  async rotate(token: string, hash: string): Promise<KeyRotateResponse> {
    const client = await this.getClient(token);
    const resp = await client.post<ApiResponse<KeyRotateResponse>>(ENDPOINTS.KEY_ROTATE(hash), {});
    return resp.data.data;
  }

  async revoke(token: string, hash: string): Promise<KeyRevokeResponse> {
    const client = await this.getClient(token);
    const resp = await client.delete<ApiResponse<KeyRevokeResponse>>(ENDPOINTS.KEY_DETAIL(hash));
    return resp.data.data;
  }
}
