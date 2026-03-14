import crypto from 'node:crypto';
import { createApiClient } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { ApiResponse, CreditsResponse, CreditsPurchaseResponse, CreditsHistoryResponse, AutoTopupConfig, AutoTopupUpdateResponse } from '../api/types.js';
import { ConfigManager } from '../config/manager.js';

export interface CreditsServiceOptions {
  mock: boolean;
  verbose?: boolean;
}

export class CreditsService {
  private options: CreditsServiceOptions;

  constructor(options: CreditsServiceOptions) {
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

  async balance(token: string): Promise<CreditsResponse> {
    const client = await this.getClient(token);
    const resp = await client.get<ApiResponse<CreditsResponse>>(ENDPOINTS.CREDITS);
    return resp.data.data;
  }

  async buy(token: string, amount: number): Promise<CreditsPurchaseResponse> {
    const client = await this.getClient(token);
    const idempotencyKey = crypto.randomUUID();
    const resp = await client.post<ApiResponse<CreditsPurchaseResponse>>(
      ENDPOINTS.CREDITS_PURCHASE,
      { amount },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return resp.data.data;
  }

  async history(token: string, options?: { limit?: number; offset?: number; type?: string }): Promise<CreditsHistoryResponse> {
    const client = await this.getClient(token);
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.type) params.set('type', options.type);
    const qs = params.toString();
    const url = qs ? `${ENDPOINTS.CREDITS_HISTORY}?${qs}` : ENDPOINTS.CREDITS_HISTORY;
    const resp = await client.get<ApiResponse<CreditsHistoryResponse>>(url);
    return resp.data.data;
  }

  async getAutoTopup(token: string): Promise<AutoTopupConfig> {
    const client = await this.getClient(token);
    const resp = await client.get<ApiResponse<AutoTopupConfig>>(ENDPOINTS.CREDITS_AUTO_TOPUP);
    return resp.data.data;
  }

  async setAutoTopup(token: string, config: { enabled?: boolean; threshold?: number; amount?: number }): Promise<AutoTopupUpdateResponse> {
    const client = await this.getClient(token);
    const resp = await client.put<ApiResponse<AutoTopupUpdateResponse>>(ENDPOINTS.CREDITS_AUTO_TOPUP, config);
    return resp.data.data;
  }
}
