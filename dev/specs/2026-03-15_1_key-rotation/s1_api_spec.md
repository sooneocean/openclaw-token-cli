# S1 API Spec: Key Rotation

> **階段**: S1 技術分析
> **建立時間**: 2026-03-15 02:00
> **版本**: v1.0

---

## 1. POST /auth/rotate

Management Key 輪換。產生新 key，舊 key 立即失效。

### Request

```
POST /auth/rotate
Authorization: Bearer <current_management_key>
Content-Type: application/json
```

Body: 無（空 body 或 `{}`）

### Response

**200 OK**

```json
{
  "data": {
    "management_key": "sk-mgmt-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "user@example.com",
    "rotated_at": "2026-03-15T02:00:00.000Z"
  }
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `management_key` | `string` | 新的 management key（僅此一次顯示） |
| `email` | `string` | 帳戶 email |
| `rotated_at` | `string` (ISO 8601) | 輪換時間 |

### Error Responses

| Status | Code | Message | 觸發條件 |
|--------|------|---------|---------|
| 401 | `UNAUTHORIZED` | Invalid or missing token | token 無效、已失效、或未提供 |

### 副作用

- 舊 management key 立即失效（後續請求回傳 401）
- 用戶記錄的 `management_key` 欄位更新為新值

---

## 2. POST /keys/:hash/rotate

Provisioned Key 輪換。產生新 key value，保留原有設定（name, credit_limit, limit_reset, expires_at），舊 key value 立即失效。Hash 不變。

### Request

```
POST /keys/:hash/rotate
Authorization: Bearer <management_key>
Content-Type: application/json
```

Path Parameters:

| 參數 | 型別 | 說明 |
|------|------|------|
| `hash` | `string` | Key 的唯一識別 hash |

Body: 無（空 body 或 `{}`）

### Response

**200 OK**

```json
{
  "data": {
    "key": "sk-prov-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "hash": "hash_xxxxxxxxxxxx",
    "name": "my-key",
    "credit_limit": 50.00,
    "limit_reset": "monthly",
    "usage": 12.50,
    "disabled": false,
    "created_at": "2026-03-01T00:00:00.000Z",
    "expires_at": null,
    "rotated_at": "2026-03-15T02:00:00.000Z"
  }
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `key` | `string` | 新的 provisioned key value（僅此一次顯示） |
| `hash` | `string` | 不變的 hash 識別碼 |
| `name` | `string` | 保留的 key 名稱 |
| `credit_limit` | `number \| null` | 保留的額度上限 |
| `limit_reset` | `string \| null` | 保留的重設頻率 |
| `usage` | `number` | 當前累計用量（不重設） |
| `disabled` | `boolean` | 當前停用狀態 |
| `created_at` | `string` | 原始建立時間（不變） |
| `expires_at` | `string \| null` | 原始到期時間（不變） |
| `rotated_at` | `string` | 輪換時間 |

### Error Responses

| Status | Code | Message | 觸發條件 |
|--------|------|---------|---------|
| 401 | `UNAUTHORIZED` | Invalid or missing token | management key 無效 |
| 404 | `KEY_NOT_FOUND` | Key not found | hash 不存在 |
| 410 | `KEY_REVOKED` | Cannot rotate a revoked key | key 已被 revoke |

### 副作用

- 舊 key value 立即失效
- `MockProvisionedKey.key` 欄位更新為新值
- hash、name、credit_limit、limit_reset、usage、disabled、created_at、expires_at 均不變

---

## 3. TypeScript 型別定義

```typescript
// 新增至 src/api/types.ts

export interface AuthRotateResponse {
  management_key: string;
  email: string;
  rotated_at: string;
}

export interface KeyRotateResponse {
  key: string;
  hash: string;
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;
  disabled: boolean;
  created_at: string;
  expires_at: string | null;
  rotated_at: string;
}
```

## 4. Endpoint 常數

```typescript
// 新增至 src/api/endpoints.ts

AUTH_ROTATE: '/auth/rotate',
KEY_ROTATE: (hash: string) => `/keys/${hash}/rotate`,
```
