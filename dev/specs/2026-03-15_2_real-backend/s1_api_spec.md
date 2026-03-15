# S1 API Spec: Real Backend Server

> **階段**: S1 技術分析
> **建立時間**: 2026-03-15 15:30
> **Agent**: architect
> **合約來源**: `token-cli/src/api/types.ts` + `token-cli/src/api/endpoints.ts`

---

## 通用規則

### Response 封裝

所有成功回應使用 `{ data: T }` 封裝。所有錯誤回應使用 `{ error: { code: string, message: string } }` 格式。

```typescript
// 成功
{ "data": { ... } }

// 錯誤
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

### 認證

需認證的端點必須在 `Authorization` header 帶 `Bearer <management_key>`。無效 token 回傳：

```
401 { "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing token" } }
```

---

## FA-Auth: 帳號認證 API

### POST /auth/register

建立新用戶帳號。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /auth/register |
| Auth | No |
| Content-Type | application/json |

**Request Body**

```typescript
interface AuthRegisterRequest {
  email: string;    // required, valid email format
  password: string; // required
}
```

**Response 201**

```typescript
interface AuthRegisterResponse {
  management_key: string; // sk-mgmt-{UUID}
  email: string;
  created_at: string;     // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | email 或 password 缺失/空白 |
| 409 | EMAIL_EXISTS | email 已被註冊 |

**業務規則**

- 密碼用 bcrypt (work factor 10) hash 後存入 DB
- 自動建立一個 management_key
- 自動初始化 credit_balances (total=0, usage=0)
- 自動初始化 auto_topup 設定 (enabled=false, threshold=5, amount=25)

---

### POST /auth/login

用 email + password 登入。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /auth/login |
| Auth | No |
| Content-Type | application/json |

**Request Body**

```typescript
interface AuthLoginRequest {
  email: string;
  password: string;
}
```

**Response 200**

```typescript
interface AuthLoginResponse {
  management_key: string; // 新產生的 key
  email: string;
  last_login: string;     // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | email 或 password 缺失/空白 |
| 401 | INVALID_CREDENTIALS | email 不存在或密碼錯誤（不區分原因） |

**業務規則**

- bcrypt verify 驗證密碼
- 登入成功：revoke 所有該用戶的 active management_keys，產生新 key
- 錯誤訊息不得洩漏 email 是否存在（統一 INVALID_CREDENTIALS）

---

### GET /auth/me

查詢目前認證用戶的資訊。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /auth/me |
| Auth | Yes (Bearer management_key) |

**Response 200**

```typescript
interface AuthMeResponse {
  email: string;
  plan: string;             // "free"
  credits_remaining: number; // total_credits - total_usage
  keys_count: number;        // non-revoked provisioned keys count
  created_at: string;        // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效或缺失 |

---

### POST /auth/rotate

輪換 management key。舊 key 立即失效。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /auth/rotate |
| Auth | Yes (Bearer management_key) |

**Response 200**

```typescript
interface AuthRotateResponse {
  management_key: string; // 新 key
  email: string;
  rotated_at: string;     // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效或缺失 |

**業務規則**

- 當前 token 立即 revoke
- 產生新 management_key
- 使用 DB transaction 保證原子性

---

## FA-Keys: Key 管理 API

### POST /keys

建立新的 provisioned key。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /keys |
| Auth | Yes |
| Content-Type | application/json |

**Request Body**

```typescript
interface CreateKeyRequest {
  name: string;                                          // required
  credit_limit?: number | null;                          // optional
  limit_reset?: 'daily' | 'weekly' | 'monthly' | null;  // optional
  expires_at?: string | null;                            // optional, ISO8601
}
```

**Response 201**

```typescript
interface ProvisionedKey {
  hash: string;                                          // SHA-256(key_value) 前 16 hex（首次建立時計算，之後不變）
  key: string;                                           // sk-prov-{32 hex}，僅建立和 rotate 時回傳
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;                                         // 初始 0
  disabled: boolean;                                     // 初始 false
  created_at: string;
  expires_at: string | null;
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | name 缺失或空白 |
| 401 | UNAUTHORIZED | token 無效 |
| 409 | KEY_NAME_EXISTS | 同用戶已有同名 active key |

**業務規則**

- key_value 格式：`sk-prov-{32 hex chars}`
- hash = SHA-256(key_value) 取前 16 hex chars
- 同用戶同名的 revoked key 不算衝突

---

### GET /keys

列出該用戶的 provisioned keys。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /keys |
| Auth | Yes |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| include_revoked | string | "false" | "true" 時包含已撤銷的 keys |

**Response 200**

```typescript
interface KeysListResponse {
  items: ProvisionedKey[]; // 不含 key value 欄位
  total: number;
}
```

**業務規則**

- response 的 items 中 ProvisionedKey 不包含 `key` 欄位
- 預設只回傳未 revoked 的 keys

---

### GET /keys/:hash

查詢 provisioned key 詳情。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /keys/:hash |
| Auth | Yes |

**Response 200**

```typescript
interface KeyDetailResponse extends ProvisionedKey {
  usage_daily: number;    // placeholder: usage * 0.15
  usage_weekly: number;   // placeholder: usage * 0.6
  usage_monthly: number;  // placeholder: usage
  requests_count: number; // placeholder: usage * 40
  model_usage: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>; // placeholder 靜態資料
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 404 | KEY_NOT_FOUND | hash 不存在或已 revoked |

**業務規則**

- 已 revoked 的 key 回傳 404（不暴露 revoke 狀態給 detail 查詢）
- usage stats 使用靜態乘數（placeholder），model_usage 固定兩個模型
- response 不含 `key` value

---

### PATCH /keys/:hash

更新 provisioned key 設定。

| 項目 | 值 |
|------|---|
| Method | PATCH |
| Path | /keys/:hash |
| Auth | Yes |
| Content-Type | application/json |

**Request Body**

```typescript
interface KeyUpdateRequest {
  credit_limit?: number | null;
  limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
  disabled?: boolean;
}
```

**Response 200**

回傳完整 `ProvisionedKey`（不含 key value）。

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 404 | KEY_NOT_FOUND | hash 不存在或已 revoked |

---

### DELETE /keys/:hash

撤銷 provisioned key。

| 項目 | 值 |
|------|---|
| Method | DELETE |
| Path | /keys/:hash |
| Auth | Yes |

**Response 200**

```typescript
interface KeyRevokeResponse {
  hash: string;
  name: string;
  revoked: boolean;    // true
  revoked_at: string;  // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 404 | KEY_NOT_FOUND | hash 不存在 |
| 410 | KEY_ALREADY_REVOKED | key 已被撤銷 |

---

### POST /keys/:hash/rotate

輪換 provisioned key 的 key value。hash 不變。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /keys/:hash/rotate |
| Auth | Yes |

**Response 200**

```typescript
interface KeyRotateResponse {
  key: string;         // 新 key value
  hash: string;        // 不變
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;
  disabled: boolean;
  created_at: string;
  expires_at: string | null;
  rotated_at: string;  // ISO8601
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 404 | KEY_NOT_FOUND | hash 不存在 |
| 410 | KEY_REVOKED | key 已被撤銷（不可 rotate） |

**業務規則**

- 產生新 key_value，但 hash 保持不變
- hash 是 key 的穩定識別碼，不隨 key_value 改變

---

## FA-Credits: 額度管理 API

### GET /credits

查詢用戶 credit 餘額。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /credits |
| Auth | Yes |

**Response 200**

```typescript
interface CreditsResponse {
  total_credits: number;
  total_usage: number;
  remaining: number;   // total_credits - total_usage
}
```

---

### POST /credits/purchase

購買 credits。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /credits/purchase |
| Auth | Yes |
| Content-Type | application/json |
| Idempotency-Key | (optional) string |

**Request Body**

```typescript
interface CreditsPurchaseRequest {
  amount: number; // >= 5
}
```

**Response 200**

```typescript
interface CreditsPurchaseResponse {
  transaction_id: string;
  amount: number;
  platform_fee: number;   // max(amount * 0.055, 0.80), 精確到分
  total_charged: number;  // amount + platform_fee
  new_balance: number;    // 購買後的 remaining
  created_at: string;
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | amount 缺失或 < 5 |
| 401 | UNAUTHORIZED | token 無效 |

**業務規則**

- platform_fee = `Math.round(Math.max(amount * 0.055, 0.80) * 100) / 100`
- total_charged = amount + platform_fee
- new_balance = total_credits + amount - total_usage
- 使用 DB transaction: UPDATE credit_balances + INSERT credit_transactions
- Idempotency-Key header: 有值時檢查 credit_transactions.idempotency_key，已存在則回傳原始結果

---

### GET /credits/history

查詢交易歷史。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /credits/history |
| Auth | Yes |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | 每頁筆數 |
| offset | number | 0 | 起始偏移 |
| type | string | (all) | 篩選: purchase, usage, refund |

**Response 200**

```typescript
interface CreditsHistoryResponse {
  items: CreditHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean; // offset + limit < total
}

interface CreditHistoryEntry {
  id: string;        // UUID
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}
```

---

### GET /credits/auto-topup

查詢自動加值設定。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /credits/auto-topup |
| Auth | Yes |

**Response 200**

```typescript
interface AutoTopupConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
}
```

---

### PUT /credits/auto-topup

更新自動加值設定。

| 項目 | 值 |
|------|---|
| Method | PUT |
| Path | /credits/auto-topup |
| Auth | Yes |
| Content-Type | application/json |

**Request Body**

```typescript
interface AutoTopupUpdateRequest {
  enabled?: boolean;
  threshold?: number; // >= 1
  amount?: number;    // >= 5
}
```

**Response 200**

```typescript
interface AutoTopupUpdateResponse extends AutoTopupConfig {
  updated_at: string;
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | threshold < 1 或 amount < 5 |
| 401 | UNAUTHORIZED | token 無效 |

**業務規則**

- Partial update：只更新有提供的欄位
- threshold 和 amount 的驗證在有提供值時才檢查

---

## FA-OAuth: GitHub OAuth Device Flow

### POST /oauth/device/code

啟動 GitHub Device Flow。Server 代理呼叫 GitHub API。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /oauth/device/code |
| Auth | No |
| Content-Type | application/json |

**Request Body**

```typescript
interface OAuthDeviceCodeRequest {
  client_id: string; // 必須匹配 server 環境變數 GITHUB_CLIENT_ID
}
```

**Response 200**

```typescript
interface OAuthDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string; // "https://github.com/login/device"
  interval: number;         // 輪詢間隔秒數
  expires_in: number;       // 有效秒數
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | INVALID_INPUT | client_id 缺失 |
| 400 | INVALID_CLIENT_ID | client_id 不匹配 GITHUB_CLIENT_ID |
| 502 | GITHUB_UNAVAILABLE | GitHub API 不可達 |

**業務規則**

- Server 呼叫 `POST https://github.com/login/device/code` 帶 `client_id` + `scope=user:email`
- 將 GitHub 回傳的 device_code, user_code 等存入 oauth_sessions 表
- 設定 session expires_at = now + expires_in 秒

---

### POST /oauth/device/token

輪詢 Device Flow 授權狀態。Server 代理呼叫 GitHub API。

| 項目 | 值 |
|------|---|
| Method | POST |
| Path | /oauth/device/token |
| Auth | No |
| Content-Type | application/json |

**Request Body**

```typescript
interface OAuthDeviceTokenRequest {
  device_code: string;
  grant_type: string; // "urn:ietf:params:oauth:grant-type:device_code"
}
```

**Response 200 (授權成功)**

```typescript
interface OAuthDeviceTokenResponse {
  access_token: string; // server 產生的 session token（非 GitHub token）
  token_type: string;   // "bearer"
}
```

**Errors (OAuth 標準格式，HTTP 400)**

| Code | Condition |
|------|-----------|
| bad_device_code | device_code 無效或不存在 |
| expired_token | device code 已過期 |
| authorization_pending | 用戶尚未在 GitHub 完成授權 |

**業務規則**

- Server 呼叫 `POST https://github.com/login/oauth/access_token` 帶 `client_id`, `device_code`, `grant_type`
- GitHub 回傳 `authorization_pending` → 透傳給 CLI
- GitHub 回傳 `access_token` → 存入 oauth_sessions.github_access_token，產生 server 自己的 session token 回傳
- Session 過期（DB expires_at < now）→ 回傳 expired_token

---

### GET /oauth/userinfo

取得 OAuth 認證用戶資訊並建立/合併帳號。

| 項目 | 值 |
|------|---|
| Method | GET |
| Path | /oauth/userinfo |
| Auth | Yes (Bearer: oauth session token from device/token response) |

**Response 200**

```typescript
interface OAuthUserInfoResponse {
  management_key: string; // 新產生或既有的 management_key
  email: string;
  name: string;           // GitHub display name
  avatar_url: string;     // GitHub avatar URL
  merged: boolean;        // true = email 已有帳號，合併
}
```

**Errors**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | EMAIL_REQUIRED | GitHub 帳號沒有 public email（且 /user/emails 也查無 primary email） |
| 401 | UNAUTHORIZED | token 無效或 session 不存在 |
| 502 | GITHUB_UNAVAILABLE | GitHub API 不可達 |

**業務規則**

- 用 oauth_sessions.github_access_token 呼叫 GitHub `GET /user` + `GET /user/emails`
- 取 primary verified email
- 若 email 已存在 users 表 → merge：更新 github_id/avatar_url，回傳既有 management_key，`merged: true`
- 若 email 不存在 → 建立新用戶 + management_key + credit_balance + auto_topup，`merged: false`
- 用戶無 password（OAuth 帳號），password_hash 保持 null
