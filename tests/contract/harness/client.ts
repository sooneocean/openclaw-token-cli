/**
 * Contract Test Harness — ContractClient 介面
 *
 * 提供統一介面對 MockClient（直接呼叫 MockRouter.handle）
 * 和 RealClient（HTTP fetch）進行相同的 contract 驗證。
 */

import { MockRouter } from '../../../src/mock/handler.js';
import { MockStore } from '../../../src/mock/store.js';
import { registerAuthHandlers } from '../../../src/mock/handlers/auth.mock.js';
import { registerCreditsHandlers } from '../../../src/mock/handlers/credits.mock.js';
import { registerKeysHandlers } from '../../../src/mock/handlers/keys.mock.js';
import { registerOAuthHandlers } from '../../../src/mock/handlers/oauth.mock.js';

// ---------------------------------------------------------------------------
// 型別定義
// ---------------------------------------------------------------------------

/** ContractClient 回應結構 */
export interface ContractResponse {
  status: number;
  body: unknown;
}

/** send() 選項 */
export interface SendOptions {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

/** ContractClient 統一介面 */
export interface ContractClient {
  /** 發送請求並回傳 response */
  send(method: string, path: string, opts?: SendOptions): Promise<ContractResponse>;
  /** 取得目前執行模式 */
  getMode(): 'mock' | 'real';
}

// ---------------------------------------------------------------------------
// MockClient
// ---------------------------------------------------------------------------

/**
 * MockClient：直接呼叫 MockRouter.handle()，不走 HTTP stack。
 * 每次建構都使用獨立 MockStore，確保測試場景互相隔離。
 */
export class MockClient implements ContractClient {
  private router: MockRouter;
  readonly store: MockStore;

  constructor() {
    // 每次建構獨立 store + router，確保場景隔離
    this.store = new MockStore({});
    this.router = new MockRouter(this.store);

    // 註冊所有 handler
    registerAuthHandlers(this.router);
    registerCreditsHandlers(this.router);
    registerKeysHandlers(this.router);
    registerOAuthHandlers(this.router);
  }

  getMode(): 'mock' {
    return 'mock';
  }

  async send(method: string, path: string, opts?: SendOptions): Promise<ContractResponse> {
    // 組裝 MockRequest
    const resp = await this.router.handle({
      method,
      path,
      body: opts?.body,
      headers: opts?.headers,
      query: opts?.query,
    });

    // MockResponse.data 就是完整 response body（含 envelope）
    return { status: resp.status, body: resp.data };
  }
}

// ---------------------------------------------------------------------------
// RealClient
// ---------------------------------------------------------------------------

/**
 * RealClient：使用原生 fetch 對 CONTRACT_TEST_BASE_URL 發 HTTP 請求。
 * 不使用 axios，避免與 src/ 的 axios mock adapter 產生干擾。
 */
export class RealClient implements ContractClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除尾部斜線
  }

  getMode(): 'real' {
    return 'real';
  }

  async send(method: string, path: string, opts?: SendOptions): Promise<ContractResponse> {
    // 組裝完整 URL（含 query string）
    let url = `${this.baseUrl}${path}`;
    if (opts?.query && Object.keys(opts.query).length > 0) {
      const qs = new URLSearchParams(opts.query).toString();
      url = `${url}?${qs}`;
    }

    const resp = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(opts?.headers ?? {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const body = await resp.json();
    return { status: resp.status, body };
  }
}

// ---------------------------------------------------------------------------
// 工廠函式
// ---------------------------------------------------------------------------

/**
 * createContractClient：根據環境變數決定使用 MockClient 或 RealClient。
 *
 * - 若 CONTRACT_TEST_BASE_URL 已設定 → 回傳 RealClient
 * - 否則 → 回傳 MockClient
 */
export function createContractClient(): ContractClient {
  const baseUrl = process.env['CONTRACT_TEST_BASE_URL'];
  if (baseUrl) {
    return new RealClient(baseUrl);
  }
  return new MockClient();
}
