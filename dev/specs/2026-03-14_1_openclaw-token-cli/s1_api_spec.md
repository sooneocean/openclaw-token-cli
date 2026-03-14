# API Spec: OpenClaw Token CLI

> **Source**: Extracted from `s1_dev_spec.md` Section 4.2
> **Purpose**: Mock API 契約規格 — CLI 與 mock backend 的 single source of truth
> **Created**: 2026-03-14 22:00

---

## Overview

OpenClaw Token CLI 的 mock backend API 規格，涵蓋帳戶認證（FA-A）、Credits 管理（FA-B）、API Key Provisioning（FA-C）三大功能區共 13 個 endpoint。

**Base URL**: `https://proxy.openclaw-token.dev/v1`（佔位，mock 模式不實際發送）
**Authentication**: Bearer Token（Management Key），格式：`Authorization: Bearer sk-mgmt-<uuid>`

---

## Endpoints

### 1. 註冊帳戶 [FA-A]

```
POST /auth/register
Content-Type: application/json
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `email` | string | Yes | Valid email format, max 255 chars | 帳戶 email |
| `password` | string | Yes | 8-128 chars, at least 1 uppercase + 1 number | 帳戶密碼 |

**Response -- Success (201 Created)**
```json
{
  "data": {
    "management_key": "sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "created_at": "2026-03-14T22:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.management_key` | string | Management API Key，僅在註冊/登入時回傳完整值 |
| `data.email` | string | 帳戶 email |
| `data.created_at` | string (ISO8601) | 帳戶建立時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 輸入驗證失敗 | email 格式錯誤、password 不符合規則 |
| 409 | `EMAIL_EXISTS` | Email 已被註冊 | 該 email 已有帳戶 |

---

### 2. 登入 [FA-A]

```
POST /auth/login
Content-Type: application/json
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `email` | string | Yes | Valid email format | 帳戶 email |
| `password` | string | Yes | Non-empty | 帳戶密碼 |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "management_key": "sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "last_login": "2026-03-14T22:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.management_key` | string | Management API Key |
| `data.email` | string | 帳戶 email |
| `data.last_login` | string (ISO8601) | 本次登入時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 輸入驗證失敗 | 缺少必要欄位 |
| 401 | `INVALID_CREDENTIALS` | 認證失敗 | Email 不存在或密碼錯誤 |

---

### 3. 查看帳戶資訊 [FA-A]

```
GET /auth/me
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**: 無

**Response -- Success (200 OK)**
```json
{
  "data": {
    "email": "user@example.com",
    "plan": "free",
    "credits_remaining": 24.50,
    "keys_count": 3,
    "created_at": "2026-03-14T22:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.email` | string | 帳戶 email |
| `data.plan` | string | 方案：`"free"` 或 `"pro"` |
| `data.credits_remaining` | number | 剩餘 credits（USD） |
| `data.keys_count` | integer | 已建立的 provisioned key 數量 |
| `data.created_at` | string (ISO8601) | 帳戶建立時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證或 token 無效 | 無 Authorization header 或 key 已失效 |

---

### 4. 查詢 Credits 餘額 [FA-B]

```
GET /credits
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**: 無

**Response -- Success (200 OK)**
```json
{
  "data": {
    "total_credits": 100.00,
    "total_usage": 75.50,
    "remaining": 24.50
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.total_credits` | number | 總購買金額（USD） |
| `data.total_usage` | number | 總消耗金額（USD） |
| `data.remaining` | number | 剩餘金額（USD），= total_credits - total_usage |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |

---

### 5. 購買 Credits [FA-B]

```
POST /credits/purchase
Authorization: Bearer sk-mgmt-xxx
Content-Type: application/json
Idempotency-Key: <client-generated-uuid>
```

**Request Body**
```json
{
  "amount": 25.00
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `amount` | number | Yes | >= 5.00, max 10000.00 | 購買金額（USD） |

**Headers**

| Name | Required | Description |
|------|----------|-------------|
| `Idempotency-Key` | No | 冪等性 key（UUID），防止重複購買。相同 key 的重複請求回傳相同結果。 |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "transaction_id": "txn_a1b2c3d4e5f6",
    "amount": 25.00,
    "platform_fee": 1.38,
    "total_charged": 26.38,
    "new_balance": 49.50,
    "created_at": "2026-03-14T22:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.transaction_id` | string | 交易 ID（txn_ 開頭） |
| `data.amount` | number | 購買金額（USD） |
| `data.platform_fee` | number | 平台費（5.5%，最低 $0.80） |
| `data.total_charged` | number | 實際收費 = amount + platform_fee |
| `data.new_balance` | number | 購買後新餘額（USD） |
| `data.created_at` | string (ISO8601) | 交易時間 |

**平台費計算規則**：
- `platform_fee = max(amount * 0.055, 0.80)`
- 精度：四捨五入到小數點後兩位

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 金額無效 | amount < 5 或非數字 |
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |
| 402 | `PAYMENT_FAILED` | 付款失敗 | 付款方式被拒（mock 不觸發） |

---

### 6. 交易紀錄 [FA-B]

```
GET /credits/history
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**

| Name | Location | Type | Required | Default | Description |
|------|----------|------|----------|---------|-------------|
| `limit` | query | integer | No | 20 | 每頁筆數（1-100） |
| `offset` | query | integer | No | 0 | 跳過筆數 |
| `type` | query | string | No | - | 過濾類型：`purchase`, `usage`, `refund` |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "items": [
      {
        "id": "txn_a1b2c3d4e5f6",
        "type": "purchase",
        "amount": 25.00,
        "balance_after": 49.50,
        "description": "Credit purchase",
        "created_at": "2026-03-14T22:00:00Z"
      },
      {
        "id": "txn_f6e5d4c3b2a1",
        "type": "usage",
        "amount": -0.003,
        "balance_after": 49.497,
        "description": "claude-sonnet-4-5 (1.2k tokens)",
        "created_at": "2026-03-14T22:05:00Z"
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.items` | array | 交易紀錄列表 |
| `data.items[].id` | string | 交易 ID |
| `data.items[].type` | string | 類型：`"purchase"`, `"usage"`, `"refund"` |
| `data.items[].amount` | number | 金額（purchase 為正，usage 為負，refund 為正） |
| `data.items[].balance_after` | number | 交易後餘額 |
| `data.items[].description` | string | 描述 |
| `data.items[].created_at` | string (ISO8601) | 交易時間 |
| `data.total` | integer | 總筆數 |
| `data.limit` | integer | 每頁筆數 |
| `data.offset` | integer | 跳過筆數 |
| `data.has_more` | boolean | 是否還有更多 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 參數無效 | limit/offset 為負數或非數字 |
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |

---

### 7. 查詢 Auto Top-up 設定 [FA-B]

```
GET /credits/auto-topup
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**: 無

**Response -- Success (200 OK)**
```json
{
  "data": {
    "enabled": false,
    "threshold": 5.00,
    "amount": 25.00
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.enabled` | boolean | 是否啟用 |
| `data.threshold` | number | 觸發門檻（USD），credits 低於此值時自動購買 |
| `data.amount` | number | 每次自動購買金額（USD） |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |

---

### 8. 更新 Auto Top-up 設定 [FA-B]

```
PUT /credits/auto-topup
Authorization: Bearer sk-mgmt-xxx
Content-Type: application/json
```

**Request Body**
```json
{
  "enabled": true,
  "threshold": 5.00,
  "amount": 25.00
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `enabled` | boolean | No | - | 啟用/停用 |
| `threshold` | number | No | >= 1.00, max 1000.00 | 觸發門檻（USD） |
| `amount` | number | No | >= 5.00, max 10000.00 | 每次購買金額（USD） |

> 可只傳需要更新的欄位（partial update）。

**Response -- Success (200 OK)**
```json
{
  "data": {
    "enabled": true,
    "threshold": 5.00,
    "amount": 25.00,
    "updated_at": "2026-03-14T22:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.enabled` | boolean | 更新後狀態 |
| `data.threshold` | number | 更新後門檻 |
| `data.amount` | number | 更新後金額 |
| `data.updated_at` | string (ISO8601) | 更新時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 參數無效 | threshold < 1 或 amount < 5 |
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |

---

### 9. 建立 Provisioned API Key [FA-C]

```
POST /keys
Authorization: Bearer sk-mgmt-xxx
Content-Type: application/json
```

**Request Body**
```json
{
  "name": "my-agent",
  "credit_limit": 10.00,
  "limit_reset": "monthly",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `name` | string | Yes | 1-100 chars, `[a-zA-Z0-9_-]` | Key 識別名稱 |
| `credit_limit` | number | No | >= 0 if provided, null = unlimited | Credit 上限（USD） |
| `limit_reset` | string | No | `"daily"`, `"weekly"`, `"monthly"`, or null | 上限重置頻率 |
| `expires_at` | string | No | ISO8601, must be future | 過期時間 |

**Response -- Success (201 Created)**
```json
{
  "data": {
    "key": "sk-prov-x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4",
    "hash": "hash_abc123def456",
    "name": "my-agent",
    "credit_limit": 10.00,
    "limit_reset": "monthly",
    "usage": 0,
    "disabled": false,
    "created_at": "2026-03-14T22:00:00Z",
    "expires_at": "2027-01-01T00:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.key` | string | Provisioned API Key 完整值（**僅在建立時回傳，之後不可取得**） |
| `data.hash` | string | Key identifier（hash_ 開頭），用於後續查詢/更新/撤銷 |
| `data.name` | string | Key 名稱 |
| `data.credit_limit` | number/null | Credit 上限（USD），null 表示無限制 |
| `data.limit_reset` | string/null | 上限重置頻率 |
| `data.usage` | number | 已使用金額（USD） |
| `data.disabled` | boolean | 是否停用 |
| `data.created_at` | string (ISO8601) | 建立時間 |
| `data.expires_at` | string/null (ISO8601) | 過期時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 參數無效 | name 為空、limit 為負數、expires_at 在過去 |
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |
| 409 | `KEY_NAME_EXISTS` | 名稱已存在 | 該帳戶下已有同名 key |

---

### 10. 列出所有 Key [FA-C]

```
GET /keys
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**

| Name | Location | Type | Required | Default | Description |
|------|----------|------|----------|---------|-------------|
| `include_revoked` | query | boolean | No | false | 是否包含已撤銷的 key |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "items": [
      {
        "hash": "hash_abc123def456",
        "name": "my-agent",
        "credit_limit": 10.00,
        "limit_reset": "monthly",
        "usage": 3.25,
        "disabled": false,
        "created_at": "2026-03-14T22:00:00Z",
        "expires_at": "2027-01-01T00:00:00Z"
      }
    ],
    "total": 1
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.items` | array | Key 列表（**不包含 key 完整值**） |
| `data.items[].hash` | string | Key identifier |
| `data.items[].name` | string | Key 名稱 |
| `data.items[].credit_limit` | number/null | Credit 上限 |
| `data.items[].limit_reset` | string/null | 重置頻率 |
| `data.items[].usage` | number | 已使用金額 |
| `data.items[].disabled` | boolean | 是否停用 |
| `data.items[].created_at` | string (ISO8601) | 建立時間 |
| `data.items[].expires_at` | string/null (ISO8601) | 過期時間 |
| `data.total` | integer | 總數 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |

---

### 11. 查看 Key 詳情 [FA-C]

```
GET /keys/:hash
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| `hash` | path | string | Yes | Key identifier（hash_ 開頭） |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "hash": "hash_abc123def456",
    "name": "my-agent",
    "credit_limit": 10.00,
    "limit_reset": "monthly",
    "usage": 3.25,
    "usage_daily": 0.50,
    "usage_weekly": 2.10,
    "usage_monthly": 3.25,
    "requests_count": 142,
    "disabled": false,
    "created_at": "2026-03-14T22:00:00Z",
    "expires_at": "2027-01-01T00:00:00Z",
    "model_usage": [
      {
        "model": "claude-sonnet-4-5",
        "requests": 80,
        "tokens": 125000,
        "cost": 1.85
      },
      {
        "model": "gpt-4o",
        "requests": 62,
        "tokens": 98000,
        "cost": 1.40
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.hash` | string | Key identifier |
| `data.name` | string | Key 名稱 |
| `data.credit_limit` | number/null | Credit 上限 |
| `data.limit_reset` | string/null | 重置頻率 |
| `data.usage` | number | 總使用金額 |
| `data.usage_daily` | number | 今日使用金額 |
| `data.usage_weekly` | number | 本週使用金額 |
| `data.usage_monthly` | number | 本月使用金額 |
| `data.requests_count` | integer | 總請求數 |
| `data.disabled` | boolean | 是否停用 |
| `data.created_at` | string (ISO8601) | 建立時間 |
| `data.expires_at` | string/null (ISO8601) | 過期時間 |
| `data.model_usage` | array | 模型用量分佈 |
| `data.model_usage[].model` | string | 模型名稱 |
| `data.model_usage[].requests` | integer | 請求數 |
| `data.model_usage[].tokens` | integer | Token 數 |
| `data.model_usage[].cost` | number | 費用（USD） |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |
| 404 | `KEY_NOT_FOUND` | Key 不存在 | hash 無匹配或已撤銷 |

---

### 12. 更新 Key [FA-C]

```
PATCH /keys/:hash
Authorization: Bearer sk-mgmt-xxx
Content-Type: application/json
```

**Parameters**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| `hash` | path | string | Yes | Key identifier |

**Request Body**
```json
{
  "credit_limit": 20.00,
  "limit_reset": "weekly",
  "disabled": false
}
```

| Field | Type | Required | Validation Rules | Description |
|-------|------|----------|-----------------|-------------|
| `credit_limit` | number/null | No | >= 0 if number, null = unlimited | 新 credit 上限 |
| `limit_reset` | string/null | No | `"daily"`, `"weekly"`, `"monthly"`, null | 新重置頻率 |
| `disabled` | boolean | No | - | 停用/啟用 |

> Partial update：只傳需要更新的欄位。`name` 不可更新。

**Response -- Success (200 OK)**
```json
{
  "data": {
    "hash": "hash_abc123def456",
    "name": "my-agent",
    "credit_limit": 20.00,
    "limit_reset": "weekly",
    "usage": 3.25,
    "disabled": false,
    "created_at": "2026-03-14T22:00:00Z",
    "expires_at": "2027-01-01T00:00:00Z",
    "updated_at": "2026-03-14T23:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.updated_at` | string (ISO8601) | 更新時間 |
| (其餘同 List 回應) | | |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 400 | `INVALID_INPUT` | 參數無效 | credit_limit 為負數 |
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |
| 404 | `KEY_NOT_FOUND` | Key 不存在 | hash 無匹配或已撤銷 |

---

### 13. 撤銷 Key [FA-C]

```
DELETE /keys/:hash
Authorization: Bearer sk-mgmt-xxx
```

**Parameters**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| `hash` | path | string | Yes | Key identifier |

**Response -- Success (200 OK)**
```json
{
  "data": {
    "hash": "hash_abc123def456",
    "name": "my-agent",
    "revoked": true,
    "revoked_at": "2026-03-14T23:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.hash` | string | Key identifier |
| `data.name` | string | Key 名稱 |
| `data.revoked` | boolean | 已撤銷 |
| `data.revoked_at` | string (ISO8601) | 撤銷時間 |

**Error Codes**

| HTTP Status | Error Code | Description | Trigger Condition |
|-------------|-----------|-------------|-------------------|
| 401 | `UNAUTHORIZED` | 未認證 | 無效 token |
| 404 | `KEY_NOT_FOUND` | Key 不存在 | hash 無匹配 |
| 410 | `KEY_ALREADY_REVOKED` | Key 已被撤銷 | 重複撤銷 |

---

## Shared Definitions

### Response Envelope

所有 API response 使用統一信封格式：

**Success**
```json
{
  "data": { ... }
}
```

**Error**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

### Shared Error Codes

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `INVALID_INPUT` | 輸入驗證失敗 |
| 401 | `UNAUTHORIZED` | 未認證或 token 已失效（對應 S0 E3） |
| 402 | `INSUFFICIENT_CREDITS` | Credits 餘額不足（對應 S0 E7） |
| 402 | `PAYMENT_FAILED` | 付款方式被拒 |
| 402 | `KEY_LIMIT_REACHED` | Provisioned key credit limit 已用完（對應 S0 E8） |
| 404 | `NOT_FOUND` | 資源不存在 |
| 409 | `CONFLICT` | 資源衝突（重複 email / 重複 key name，對應 S0 E2） |
| 410 | `GONE` | 資源已被永久移除（已撤銷的 key） |
| 429 | `RATE_LIMITED` | 請求頻率過高 |
| 500 | `INTERNAL_ERROR` | 內部伺服器錯誤 |

### Authentication

- 除 `POST /auth/register` 和 `POST /auth/login` 外，所有 endpoint 皆需 Authorization header
- 格式：`Authorization: Bearer sk-mgmt-<uuid>`
- Token 無效或過期回傳 401 `UNAUTHORIZED`

### Management Key 格式

- Prefix: `sk-mgmt-`
- Body: UUID v4（36 chars with dashes）
- 完整長度：44 chars
- 範例：`sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Provisioned Key 格式

- Prefix: `sk-prov-`
- Body: 32 chars random alphanumeric
- 完整長度：40 chars
- 範例：`sk-prov-x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4`

### Key Hash 格式

- Prefix: `hash_`
- Body: 12 chars random hex
- 範例：`hash_abc123def456`

### Transaction ID 格式

- Prefix: `txn_`
- Body: 12 chars random alphanumeric
- 範例：`txn_a1b2c3d4e5f6`

---

## Notes

- 所有金額以 USD 為單位，精度為小數點後兩位（display）、後三位（計算）
- 所有時間為 ISO8601 UTC 格式
- Mock handler 應嚴格按照本 spec 產生回應，確保 CLI 開發時的行為與未來真實 API 一致
- Idempotency-Key header 僅在 POST /credits/purchase 使用，有效期 24 小時（mock 中以 in-memory Set 實作）
- Rate limiting（429）在 mock 模式不啟用
- 分頁使用 offset-based（limit + offset），不使用 cursor-based
