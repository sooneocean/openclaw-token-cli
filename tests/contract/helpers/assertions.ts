/**
 * Contract Test — Response 驗證 Helpers
 *
 * 設計原則：
 * 1. 結構驗證，不驗精確值（不比對 timestamp/UUID 等動態值）
 * 2. Superset 允許：response 多出的欄位不報錯，缺少必要欄位才報錯
 * 3. Known drift 以寬鬆策略處理（見 dev_spec 4.2）
 */

import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// FieldSpec 型別定義
// ---------------------------------------------------------------------------

/** 欄位型別定義 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'nullable-string'
  | 'nullable-number';

/** 欄位規格 */
export interface FieldSpec {
  /** 欄位名稱 */
  name: string;
  /** 預期型別 */
  type: FieldType;
  /** 是否為可選欄位（預設 false）*/
  optional?: boolean;
}

// ---------------------------------------------------------------------------
// 核心 Envelope 驗證
// ---------------------------------------------------------------------------

/**
 * assertSuccessEnvelope：驗證成功回應的 envelope 結構 { data: { ... } }
 * 通過後可安全存取 body.data 作為 Record<string, unknown>
 */
export function assertSuccessEnvelope(
  body: unknown,
): asserts body is { data: Record<string, unknown> } {
  expect(body, '回應 body 應為物件').toBeTypeOf('object');
  expect(body).not.toBeNull();
  const obj = body as Record<string, unknown>;
  expect(obj, '成功回應應有 data 欄位').toHaveProperty('data');
  expect(obj['data'], 'data 欄位應為物件').toBeTypeOf('object');
  expect(obj['data']).not.toBeNull();
}

/**
 * assertErrorEnvelope：驗證錯誤回應的 envelope 結構 { error: { code, message } }
 * 通過後可安全存取 body.error.code 和 body.error.message
 */
export function assertErrorEnvelope(
  body: unknown,
): asserts body is { error: { code: string; message: string } } {
  expect(body, '回應 body 應為物件').toBeTypeOf('object');
  expect(body).not.toBeNull();
  const obj = body as Record<string, unknown>;
  expect(obj, '錯誤回應應有 error 欄位').toHaveProperty('error');
  expect(obj['error'], 'error 欄位應為物件').toBeTypeOf('object');
  expect(obj['error']).not.toBeNull();
  const error = obj['error'] as Record<string, unknown>;
  expect(error, 'error.code 應為字串').toHaveProperty('code');
  expect(error['code'], 'error.code 應為字串').toBeTypeOf('string');
  expect(error, 'error.message 應為字串').toHaveProperty('message');
  expect(error['message'], 'error.message 應為字串').toBeTypeOf('string');
}

// ---------------------------------------------------------------------------
// 通用欄位驗證
// ---------------------------------------------------------------------------

/**
 * assertHasFields：驗證物件包含指定欄位並符合型別規格
 * 多出的欄位不報錯（superset 允許）
 */
export function assertHasFields(obj: Record<string, unknown>, fields: FieldSpec[]): void {
  for (const field of fields) {
    if (field.optional && !(field.name in obj)) {
      // 可選欄位不存在時跳過
      continue;
    }

    expect(obj, `應有欄位 ${field.name}`).toHaveProperty(field.name);
    const value = obj[field.name];

    switch (field.type) {
      case 'string':
        expect(value, `欄位 ${field.name} 應為字串`).toBeTypeOf('string');
        break;
      case 'number':
        expect(value, `欄位 ${field.name} 應為數字`).toBeTypeOf('number');
        break;
      case 'boolean':
        expect(value, `欄位 ${field.name} 應為布林`).toBeTypeOf('boolean');
        break;
      case 'object':
        expect(value, `欄位 ${field.name} 應為物件`).toBeTypeOf('object');
        expect(value, `欄位 ${field.name} 不應為 null`).not.toBeNull();
        break;
      case 'array':
        expect(Array.isArray(value), `欄位 ${field.name} 應為陣列`).toBe(true);
        break;
      case 'nullable-string':
        // null 或 string 皆可
        if (value !== null) {
          expect(value, `欄位 ${field.name} 應為字串或 null`).toBeTypeOf('string');
        }
        break;
      case 'nullable-number':
        // null 或 number 皆可
        if (value !== null) {
          expect(value, `欄位 ${field.name} 應為數字或 null`).toBeTypeOf('number');
        }
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Auth 場景特化驗證
// ---------------------------------------------------------------------------

/**
 * assertAuthRegisterShape：驗證 POST /auth/register 的回應結構
 * 對應 AuthRegisterResponse { management_key, email, created_at }
 */
export function assertAuthRegisterShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'management_key', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'created_at', type: 'string' },
  ]);
  // management_key 格式驗證
  expect(
    (data['management_key'] as string).startsWith('sk-mgmt-'),
    'management_key 應以 sk-mgmt- 開頭',
  ).toBe(true);
}

/**
 * assertAuthLoginShape：驗證 POST /auth/login 的回應結構
 * 對應 AuthLoginResponse { management_key, email, last_login }
 */
export function assertAuthLoginShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'management_key', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'last_login', type: 'string' },
  ]);
}

/**
 * assertAuthMeShape：驗證 GET /auth/me 的回應結構
 * 對應 UserInfoResponse { email, plan, credits_remaining, keys_count, created_at }
 */
export function assertAuthMeShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'email', type: 'string' },
    { name: 'plan', type: 'string' },
    { name: 'credits_remaining', type: 'number' },
    { name: 'keys_count', type: 'number' },
    { name: 'created_at', type: 'string' },
  ]);
}

// ---------------------------------------------------------------------------
// Credits 場景特化驗證
// ---------------------------------------------------------------------------

/**
 * assertCreditsShape：驗證 GET /credits 的回應結構
 * 對應 CreditsResponse { total_credits, total_usage, remaining }
 */
export function assertCreditsShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'total_credits', type: 'number' },
    { name: 'total_usage', type: 'number' },
    { name: 'remaining', type: 'number' },
  ]);
}

/**
 * assertCreditsPurchaseShape：驗證 POST /credits/purchase 的回應結構
 * 對應 CreditsPurchaseResponse { transaction_id, amount, platform_fee, total_charged, new_balance, created_at }
 */
export function assertCreditsPurchaseShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'transaction_id', type: 'string' },
    { name: 'amount', type: 'number' },
    { name: 'platform_fee', type: 'number' },
    { name: 'total_charged', type: 'number' },
    { name: 'new_balance', type: 'number' },
    { name: 'created_at', type: 'string' },
  ]);
}

/**
 * assertCreditsHistoryShape：驗證 GET /credits/history 的回應結構
 * 對應 CreditsHistoryResponse { items, total, limit, offset, has_more }
 */
export function assertCreditsHistoryShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'items', type: 'array' },
    { name: 'total', type: 'number' },
    { name: 'limit', type: 'number' },
    { name: 'offset', type: 'number' },
    { name: 'has_more', type: 'boolean' },
  ]);
}

// ---------------------------------------------------------------------------
// Keys 場景特化驗證
// ---------------------------------------------------------------------------

/**
 * assertKeysListShape：驗證 GET /keys 的回應結構
 * 對應 KeysListResponse { items: ProvisionedKey[], total }
 */
export function assertKeysListShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'items', type: 'array' },
    { name: 'total', type: 'number' },
  ]);
}

/**
 * assertKeyDetailShape：驗證 GET /keys/:hash 的回應結構
 * 已知 drift：usage_weekly 係數差異，只驗型別 number
 */
export function assertKeyDetailShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'hash', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'credit_limit', type: 'nullable-number' },
    { name: 'limit_reset', type: 'nullable-string' },
    { name: 'usage', type: 'number' },
    // 已知 drift：mock 用 0.6 係數，real 用 0.45 係數，只驗型別
    { name: 'usage_weekly', type: 'number' },
    { name: 'disabled', type: 'boolean' },
    { name: 'created_at', type: 'string' },
    { name: 'expires_at', type: 'nullable-string' },
  ]);
}

/**
 * assertKeyCreateShape：驗證 POST /keys 的回應結構
 * 對應 ProvisionedKey（含 key 欄位）
 */
export function assertKeyCreateShape(body: unknown): void {
  assertSuccessEnvelope(body);
  const data = body.data;
  assertHasFields(data, [
    { name: 'key', type: 'string' },
    { name: 'hash', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'credit_limit', type: 'nullable-number' },
    { name: 'limit_reset', type: 'nullable-string' },
    { name: 'usage', type: 'number' },
    { name: 'disabled', type: 'boolean' },
    { name: 'created_at', type: 'string' },
    { name: 'expires_at', type: 'nullable-string' },
  ]);
  // 驗證 key 格式
  expect(
    (data['key'] as string).startsWith('sk-prov-'),
    'provisioned key 應以 sk-prov- 開頭',
  ).toBe(true);
}
