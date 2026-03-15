import { createApiClient } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type { ApiResponse, AuthRegisterResponse, AuthLoginResponse, AuthMeResponse, AuthRotateResponse } from '../api/types.js';
import { ConfigManager } from '../config/manager.js';
import { DEFAULT_API_BASE } from '../config/paths.js';

export interface AuthServiceOptions {
  mock: boolean;
  verbose?: boolean;
}

export class AuthService {
  private options: AuthServiceOptions;

  constructor(options: AuthServiceOptions) {
    this.options = options;
  }

  async register(email: string, password: string): Promise<AuthRegisterResponse> {
    const client = createApiClient({ mock: this.options.mock, verbose: this.options.verbose });
    const resp = await client.post<ApiResponse<AuthRegisterResponse>>(ENDPOINTS.AUTH_REGISTER, { email, password });
    const data = resp.data.data;

    await ConfigManager.write({
      management_key: data.management_key,
      api_base: DEFAULT_API_BASE,
      email: data.email,
      created_at: data.created_at,
      last_login: data.created_at,
    });

    return data;
  }

  async login(email: string, password: string): Promise<AuthLoginResponse> {
    const client = createApiClient({ mock: this.options.mock, verbose: this.options.verbose });
    const resp = await client.post<ApiResponse<AuthLoginResponse>>(ENDPOINTS.AUTH_LOGIN, { email, password });
    const data = resp.data.data;

    await ConfigManager.write({
      management_key: data.management_key,
      api_base: DEFAULT_API_BASE,
      email: data.email,
      created_at: new Date().toISOString(),
      last_login: data.last_login,
    });

    return data;
  }

  async logout(): Promise<void> {
    await ConfigManager.delete();
  }

  async rotate(token: string): Promise<AuthRotateResponse> {
    const resolved = await ConfigManager.resolve();
    const client = createApiClient({
      mock: this.options.mock,
      baseURL: resolved.api_base,
      token,
      verbose: this.options.verbose,
    });
    const resp = await client.post<ApiResponse<AuthRotateResponse>>(ENDPOINTS.AUTH_ROTATE, {});
    const data = resp.data.data;

    const existingConfig = await ConfigManager.read();
    await ConfigManager.write({
      management_key: data.management_key,
      api_base: existingConfig?.api_base || resolved.api_base || DEFAULT_API_BASE,
      email: existingConfig?.email || data.email,
      created_at: existingConfig?.created_at || new Date().toISOString(),
      last_login: existingConfig?.last_login || new Date().toISOString(),
    });

    return data;
  }

  async whoami(token: string): Promise<AuthMeResponse> {
    const resolved = await ConfigManager.resolve();
    const client = createApiClient({
      mock: this.options.mock,
      baseURL: resolved.api_base,
      token,
      verbose: this.options.verbose,
    });
    const resp = await client.get<ApiResponse<AuthMeResponse>>(ENDPOINTS.AUTH_ME);
    return resp.data.data;
  }
}
