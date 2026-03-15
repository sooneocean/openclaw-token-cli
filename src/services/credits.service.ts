import crypto from 'node:crypto';
import { ENDPOINTS } from '../api/endpoints.js';
import type { ApiResponse, CreditsResponse, CreditsPurchaseResponse, CreditsBuyResult, CreditsHistoryResponse, AutoTopupConfig, AutoTopupUpdateResponse } from '../api/types.js';
import { BaseService } from './base.service.js';

export { type ServiceOptions as CreditsServiceOptions } from './base.service.js';

export class CreditsService extends BaseService {
  async balance(token: string): Promise<CreditsResponse> {
    const client = await this.getClient(token);
    const resp = await client.get<ApiResponse<CreditsResponse>>(ENDPOINTS.CREDITS);
    return resp.data.data;
  }

  async buy(token: string, amount: number): Promise<CreditsBuyResult> {
    const client = await this.getClient(token);
    const idempotencyKey = crypto.randomUUID();
    const resp = await client.post<ApiResponse<CreditsPurchaseResponse>>(
      ENDPOINTS.CREDITS_PURCHASE,
      { amount },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    const data = resp.data.data;

    // Stripe mode: response has checkout_url
    if ('checkout_url' in data) {
      return { mode: 'stripe', checkout_url: data.checkout_url, session_id: data.session_id };
    }

    // Mock / immediate mode
    return { mode: 'immediate', ...data };
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
