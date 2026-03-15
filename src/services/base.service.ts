import type { AxiosInstance } from 'axios';
import { createApiClient } from '../api/client.js';
import { ConfigManager } from '../config/manager.js';

export interface ServiceOptions {
  mock: boolean;
  verbose?: boolean;
}

export class BaseService {
  protected options: ServiceOptions;
  private cachedClient: { token: string; instance: AxiosInstance } | null = null;

  constructor(options: ServiceOptions) {
    this.options = options;
  }

  protected async getClient(token: string): Promise<AxiosInstance> {
    if (this.cachedClient && this.cachedClient.token === token) {
      return this.cachedClient.instance;
    }
    const resolved = await ConfigManager.resolve();
    const instance = createApiClient({
      mock: this.options.mock,
      baseURL: resolved.api_base,
      token,
      verbose: this.options.verbose,
    });
    this.cachedClient = { token, instance };
    return instance;
  }
}
