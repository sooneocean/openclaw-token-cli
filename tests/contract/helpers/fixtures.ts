/**
 * Contract Test — 共用 Fixtures 與 Setup Helpers
 *
 * 提供測試資料生成工具與已驗證帳號建立功能。
 * Real 模式使用 uuid 確保不同測試間 email 不重複。
 */

import crypto from 'node:crypto';
import type { ContractClient } from '../harness/client.js';

// ---------------------------------------------------------------------------
// 測試常數
// ---------------------------------------------------------------------------

/** 測試用密碼（符合常見密碼規則）*/
export const TEST_PASSWORD = 'ContractTest1234!';

/** 預設測試用 key 名稱 */
export const TEST_KEY_NAME = 'contract-test-key';

// ---------------------------------------------------------------------------
// Unique Email 生成
// ---------------------------------------------------------------------------

/**
 * generateUniqueEmail：生成不重複的測試 email
 * 格式：contract-{uuid}@test.openclaw.dev
 * 確保 Real 模式中不同測試執行不會衝突
 */
export function generateUniqueEmail(): string {
  const uuid = crypto.randomUUID();
  return `contract-${uuid}@test.openclaw.dev`;
}

// ---------------------------------------------------------------------------
// 已驗證帳號建立
// ---------------------------------------------------------------------------

/** createAuthenticatedContext 的回傳型別 */
export interface AuthenticatedContext {
  /** 測試用 email */
  email: string;
  /** 測試用密碼 */
  password: string;
  /** 透過 register 取得的 management key */
  managementKey: string;
}

/**
 * createAuthenticatedContext：註冊新帳號並回傳已驗證的 context
 *
 * 步驟：
 * 1. 生成唯一 email
 * 2. 呼叫 POST /auth/register 建立帳號
 * 3. 回傳 { email, password, managementKey }
 *
 * @param client ContractClient 實例（mock 或 real 皆可）
 */
export async function createAuthenticatedContext(
  client: ContractClient,
): Promise<AuthenticatedContext> {
  const email = generateUniqueEmail();
  const password = TEST_PASSWORD;

  const resp = await client.send('POST', '/auth/register', {
    body: { email, password },
  });

  if (resp.status !== 201) {
    throw new Error(
      `createAuthenticatedContext 失敗：register 回傳 ${resp.status}，body: ${JSON.stringify(resp.body)}`,
    );
  }

  const body = resp.body as { data: { management_key: string } };
  const managementKey = body.data.management_key;

  return { email, password, managementKey };
}

// ---------------------------------------------------------------------------
// Bearer Token Header 輔助
// ---------------------------------------------------------------------------

/**
 * authHeader：從 management key 生成 Authorization header
 * 方便在測試中快速組裝認證 header
 */
export function authHeader(managementKey: string): Record<string, string> {
  return { Authorization: `Bearer ${managementKey}` };
}
