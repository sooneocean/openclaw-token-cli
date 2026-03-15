import { execFile } from 'node:child_process';
import { createApiClient } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import type {
  ApiResponse,
  OAuthDeviceCodeResponse,
  OAuthDeviceTokenResponse,
  OAuthUserInfoResponse,
} from '../api/types.js';
import { ConfigManager } from '../config/manager.js';
import { DEFAULT_API_BASE } from '../config/paths.js';
import { CLIError } from '../errors/base.js';
import { sleep as defaultSleep, type SleepFn } from '../utils/sleep.js';

export interface OAuthServiceOptions {
  mock: boolean;
  verbose?: boolean;
  sleepFn?: SleepFn;
}

export interface OAuthLoginResult {
  email: string;
  management_key: string;
  merged: boolean;
}

export class OAuthService {
  private options: OAuthServiceOptions;
  private sleepFn: SleepFn;

  constructor(options: OAuthServiceOptions) {
    this.options = options;
    this.sleepFn = options.sleepFn ?? defaultSleep;
  }

  async requestDeviceCode(): Promise<OAuthDeviceCodeResponse> {
    const client = createApiClient({ mock: this.options.mock, verbose: this.options.verbose });
    const resp = await client.post<ApiResponse<OAuthDeviceCodeResponse>>(
      ENDPOINTS.OAUTH_DEVICE_CODE,
      { client_id: 'openclaw-cli' },
    );
    return resp.data.data;
  }

  async pollForToken(
    deviceCode: string,
    interval: number,
    expiresIn: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const deadline = Date.now() + expiresIn * 1000;
    let currentInterval = interval * 1000;
    let networkRetries = 0;
    const MAX_NETWORK_RETRIES = 3;

    while (Date.now() < deadline) {
      if (signal?.aborted) {
        throw new CLIError('Authorization cancelled by user.', 0);
      }

      await this.sleepFn(currentInterval);

      try {
        const client = createApiClient({ mock: this.options.mock, verbose: this.options.verbose });
        const resp = await client.post<ApiResponse<OAuthDeviceTokenResponse>>(
          ENDPOINTS.OAUTH_DEVICE_TOKEN,
          { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
        );
        // Success — got access_token
        networkRetries = 0;
        return resp.data.data.access_token;
      } catch (err) {
        if (err instanceof CLIError && err.code) {
          switch (err.code) {
            case 'authorization_pending':
              networkRetries = 0;
              continue;
            case 'slow_down':
              networkRetries = 0;
              currentInterval += 5000;
              continue;
            case 'expired_token':
              throw new CLIError(
                'Authorization timed out. Run \'auth login --github\' again.',
                1,
              );
            case 'access_denied':
              throw new CLIError('Authorization denied by user.', 1);
            default:
              throw err;
          }
        }
        // Network error — retry up to 3 times
        networkRetries++;
        if (networkRetries >= MAX_NETWORK_RETRIES) {
          throw new CLIError('Network error. Check your connection and try again.', 1);
        }
        continue;
      }
    }

    throw new CLIError(
      'Authorization timed out. Run \'auth login --github\' again.',
      1,
    );
  }

  async fetchUserInfo(accessToken: string): Promise<OAuthUserInfoResponse> {
    const client = createApiClient({
      mock: this.options.mock,
      verbose: this.options.verbose,
      token: accessToken,
    });
    const resp = await client.get<ApiResponse<OAuthUserInfoResponse>>(ENDPOINTS.OAUTH_USERINFO);
    return resp.data.data;
  }

  async loginWithGitHub(): Promise<OAuthLoginResult> {
    // Step 1: Request device code
    const deviceCode = await this.requestDeviceCode();

    // Step 2: Display code and try to open browser
    const codeDisplay = `\nEnter code ${deviceCode.user_code} at ${deviceCode.verification_uri}\n`;
    process.stderr.write(codeDisplay);
    this.tryOpenBrowser(deviceCode.verification_uri);

    // Step 3: Poll for token
    const accessToken = await this.pollForToken(
      deviceCode.device_code,
      deviceCode.interval,
      deviceCode.expires_in,
    );

    // Step 4: Get user info + account merge/create
    const userInfo = await this.fetchUserInfo(accessToken);

    // Step 5: Save config
    const now = new Date().toISOString();
    await ConfigManager.write({
      management_key: userInfo.management_key,
      api_base: DEFAULT_API_BASE,
      email: userInfo.email,
      created_at: now,
      last_login: now,
    });

    return {
      email: userInfo.email,
      management_key: userInfo.management_key,
      merged: userInfo.merged,
    };
  }

  private tryOpenBrowser(url: string): void {
    try {
      const cmd =
        process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'cmd' :
        'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
      execFile(cmd, args, () => {
        // Silently ignore errors — browser opening is best effort
      });
    } catch {
      // Silently ignore
    }
  }
}
