import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { mapApiError, mapNetworkError, redactSecret } from '../errors/api.js';
import { handleMockRequest } from '../mock/index.js';
import type { ApiErrorResponse } from './types.js';

export interface ApiClientOptions {
  mock: boolean;
  baseURL?: string;
  token?: string;
  verbose?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // network error
  const status = error.response.status;
  return status >= 500 || status === 429;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL || 'https://proxy.openclaw-token.dev/v1',
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor: auth header + verbose logging
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (options.token) {
      config.headers.set('Authorization', `Bearer ${options.token}`);
    }
    if (options.verbose) {
      const authHeader = config.headers.get('Authorization');
      const redacted = authHeader ? redactSecret(String(authHeader)) : 'none';
      process.stderr.write(`[verbose] → ${config.method?.toUpperCase()} ${config.url} (auth: ${redacted})\n`);
    }
    return config;
  });

  // Mock adapter
  if (options.mock) {
    instance.interceptors.request.use(async (config) => {
      // Ensure auth header is set before mock handler reads it
      // (request interceptors run LIFO — this one runs before the auth interceptor above)
      if (options.token && !config.headers.get('Authorization')) {
        config.headers.set('Authorization', `Bearer ${options.token}`);
      }

      const startTime = Date.now();
      const method = (config.method || 'GET').toUpperCase();
      const url = config.url || '';
      // Strip baseURL to get path
      const path = url.startsWith('http') ? new URL(url).pathname : url;

      // Parse query params from url
      const queryString = url.includes('?') ? url.split('?')[1] : '';
      const query: Record<string, string> = {};
      if (queryString) {
        for (const param of queryString.split('&')) {
          const [k, v] = param.split('=');
          query[k] = decodeURIComponent(v || '');
        }
      }

      const headers: Record<string, string> = {};
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers.toJSON())) {
          if (typeof value === 'string') headers[key] = value;
        }
      }

      const mockResp = await handleMockRequest({
        method,
        path: path.replace(/\?.*$/, ''),
        body: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : undefined,
        headers,
        query,
      });

      if (options.verbose) {
        process.stderr.write(`[verbose] ← ${mockResp.status} (${Date.now() - startTime}ms)\n`);
      }

      // Return mock response as a resolved adapter response
      return Promise.reject({
        __isMockResponse: true,
        status: mockResp.status,
        data: mockResp.data,
        config,
      });
    });

    // Intercept the mock "rejection" and convert to response
    instance.interceptors.response.use(
      undefined,
      (error: any) => {
        if (error?.__isMockResponse) {
          const status = error.status as number;
          if (status >= 400) {
            const errorData = error.data as ApiErrorResponse;
            throw mapApiError(status, errorData?.error?.code, errorData?.error?.message);
          }
          return { status, data: error.data, headers: {}, config: error.config, statusText: 'OK' };
        }
        // Real network error
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError<ApiErrorResponse>;
          if (axiosError.response) {
            const { status, data } = axiosError.response;
            throw mapApiError(status, data?.error?.code, data?.error?.message);
          }
        }
        throw mapNetworkError(error);
      },
    );
  } else {
    // Real mode: response error interceptor with retry
    instance.interceptors.response.use(
      (response) => {
        if (options.verbose) {
          process.stderr.write(`[verbose] ← ${response.status}\n`);
        }
        return response;
      },
      async (error: AxiosError<ApiErrorResponse>) => {
        const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
        const retryCount = config?._retryCount || 0;

        if (config && isRetryable(error) && retryCount < MAX_RETRIES) {
          config._retryCount = retryCount + 1;
          const delay = RETRY_BASE_MS * Math.pow(2, retryCount);
          if (options.verbose) {
            process.stderr.write(`[verbose] Retry ${config._retryCount}/${MAX_RETRIES} in ${delay}ms...\n`);
          }
          await sleep(delay);
          return instance.request(config);
        }

        if (error.response) {
          const { status, data } = error.response;
          throw mapApiError(status, data?.error?.code, data?.error?.message);
        }
        throw mapNetworkError(error);
      },
    );
  }

  return instance;
}
