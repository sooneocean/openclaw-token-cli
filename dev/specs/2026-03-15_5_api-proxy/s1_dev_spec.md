# S1 Dev Spec: API Proxy Layer

> **階段**: S1 技術分析
> **建立時間**: 2026-03-15 23:10
> **Agent**: codebase-explorer (Phase 1) + architect (Phase 2)
> **工作類型**: new_feature
> **複雜度**: M
> **目標 Repo**: `/Users/asd/demo/openclaw-token-server`

---

## 1. 概述

### 1.1 需求參照
> 完整需求見 `s0_brief_spec.md`，以下僅摘要。

在 openclaw-token-server 新增 `POST /v1/chat/completions` proxy endpoint，讓 agent 使用 provisioned key（`sk-prov-*`）透過 proxy 轉發 OpenAI-compatible LLM API 請求，自動從 response 提取 token usage、計算 cost、扣減 credits 並寫入 usage_logs。

### 1.2 技術方案摘要

新增 provisioned key auth middleware（與現有 management key auth 分離），建立 proxy route 將請求轉發至上游 LLM API（透過環境變數配置），攔截 response 後提取 `usage` 欄位，根據硬編碼 model pricing 計算 cost，在 PostgreSQL transaction 內同步更新 `provisioned_keys.usage`、`credit_balances.total_usage` 並插入 `usage_logs`。新增 `002_usage_logs.sql` migration。

---

## 2. 影響範圍（Phase 1：codebase-explorer）

### 2.1 受影響檔案

#### Server（Hono + Bun）

| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `src/db/migrations/002_usage_logs.sql` | 新增 | usage_logs 表 + 索引 |
| `src/config.ts` | 修改 | 新增 `upstreamApiKey`、`upstreamApiBase` |
| `src/middleware/auth.ts` | 修改 | 新增 `proxyAuthMiddleware` export |
| `src/services/pricing.ts` | 新增 | MODEL_PRICING 常數 + `calculateCost()` |
| `src/services/usage.ts` | 新增 | `recordUsage()` — transaction 內扣減 credits + 寫 usage_logs |
| `src/routes/proxy.ts` | 新增 | `POST /v1/chat/completions` 主路由 |
| `src/app.ts` | 修改 | 掛載 proxy route |
| `tests/proxy.test.ts` | 新增 | proxy 整合測試（mock upstream） |

#### Database

| 資料表 | 變更類型 | 說明 |
|--------|---------|------|
| `usage_logs` | 新增 | 每次 proxy 請求的 token usage 記錄 |
| `provisioned_keys` | 現有 | 更新 `usage` 欄位（累加 cost） |
| `credit_balances` | 現有 | 更新 `total_usage` 欄位（累加 cost） |

### 2.2 依賴關係

- **上游依賴**: `provisioned_keys` 表（已存在）、`credit_balances` 表（已存在）、`users` 表（FK）
- **下游影響**: 無。此為新增 endpoint，不影響現有 `/keys`、`/credits`、`/auth`、`/oauth` 路由
- **外部依賴**: 上游 LLM API（OpenAI-compatible endpoint，透過 `UPSTREAM_API_BASE` + `UPSTREAM_API_KEY` 環境變數配置）

### 2.3 現有模式與技術考量

1. **Route 註冊模式**: `app.ts` 使用 `app.route('/path', xxxRoutes(sql))` 模式，proxy route 遵循相同模式
2. **Auth Middleware 模式**: 現有 `authMiddleware(sql)` 查 `management_keys` 表。proxy 需要新的 middleware 查 `provisioned_keys` 表，但結構相同（解析 Bearer token → 查 DB → set context）
3. **Transaction 模式**: `credits.ts` 已使用 `sql.begin(async (tx) => {...})` 模式，usage 扣減遵循相同模式
4. **Error 模式**: 全域使用 `throw new AppError(code, message, status)` + `errorHandler` middleware
5. **DB 驅動**: `postgres` (v3.4) tagged template literal，型別為 `Sql = ReturnType<typeof createDb>`

---

## 3. User Flow（Phase 2：architect）

```mermaid
flowchart TD
    A[Agent 發送 POST /v1/chat/completions<br/>Bearer sk-prov-xxx] --> B{proxyAuth:<br/>key 存在？}
    B -->|不存在| C[401 UNAUTHORIZED]
    B -->|存在| D{key revoked<br/>或 disabled？}
    D -->|是| E[401 KEY_DISABLED / KEY_REVOKED]
    D -->|否| F{key 有 credit_limit？}
    F -->|有| G{usage >= credit_limit？}
    G -->|超限| H[402 CREDIT_LIMIT_EXCEEDED]
    G -->|未超限| I[通過驗證]
    F -->|無限制| I
    I --> J{帳戶 credits<br/>remaining > 0？}
    J -->|不足| K[402 INSUFFICIENT_CREDITS]
    J -->|足夠| L[轉發到上游 LLM]
    L --> M{上游回應？}
    M -->|成功 200| N[提取 usage tokens]
    M -->|上游錯誤| O[回傳上游 status + body]
    M -->|連線失敗| P[502 UPSTREAM_UNREACHABLE]
    N --> Q[計算 cost]
    Q --> R[Transaction:<br/>更新 usage + credits<br/>插入 usage_logs]
    R --> S[回傳原始 response]
```

### 3.1 主要流程

| 步驟 | 動作 | 系統回應 | 備註 |
|------|------|---------|------|
| 1 | Agent 發送 `POST /v1/chat/completions`，Header: `Authorization: Bearer sk-prov-xxx` | 進入 proxyAuth middleware | Body 為 OpenAI-compatible 格式 |
| 2 | proxyAuth 查 `provisioned_keys` | 驗證 key 有效性（存在、未 revoked、未 disabled） | 同時取得 user_id、key_id |
| 3 | 檢查 credit limit | 若 key 有 `credit_limit`，確認 `usage < credit_limit` | 無 limit 則跳過 |
| 4 | 檢查帳戶 credits | 查 `credit_balances`，確認 `total_credits - total_usage > 0` | 預檢，非精確扣減 |
| 5 | 轉發至上游 | 替換 `Authorization` 為上游 API key，轉發 body | 不修改 request body |
| 6 | 攔截 response | 讀取 response body，提取 `usage.prompt_tokens` / `completion_tokens` / `total_tokens` | 僅在 200 時提取 |
| 7 | 計算 cost | 根據 `model` + pricing 表計算 cost（USD） | 未知 model 用 fallback pricing |
| 8 | 記錄 usage（transaction） | 更新 `provisioned_keys.usage += cost`、`credit_balances.total_usage += cost`、插入 `usage_logs` | 單一 transaction |
| 9 | 回傳 response | 原始上游 response body + status code | 不修改 response body |

### 3.2 異常流程

| 情境 | 觸發條件 | 系統處理 | Agent 看到 |
|------|---------|---------|---------|
| 無效 key | key_value 不存在於 provisioned_keys | 401 | `{ error: { code: "UNAUTHORIZED", message: "Invalid or revoked key" } }` |
| Key 已撤銷 | `is_revoked = true` | 401 | `{ error: { code: "KEY_REVOKED", message: "Key has been revoked" } }` |
| Key 已停用 | `disabled = true` | 401 | `{ error: { code: "KEY_DISABLED", message: "Key is disabled" } }` |
| Key credit 超限 | `usage >= credit_limit` | 402 | `{ error: { code: "CREDIT_LIMIT_EXCEEDED", message: "Key credit limit exceeded" } }` |
| 帳戶餘額不足 | `total_credits - total_usage <= 0` | 402 | `{ error: { code: "INSUFFICIENT_CREDITS", message: "Insufficient credits" } }` |
| 上游不可達 | fetch 拋出網路錯誤 | 502 | `{ error: { code: "UPSTREAM_UNREACHABLE", message: "..." } }` |
| 上游回傳錯誤 | 上游 status != 200 | 原樣轉發 | 上游原始 error response（不記錄 usage，但記錄 usage_logs with cost=0） |
| 缺少 model 欄位 | request body 無 `model` | 400 | `{ error: { code: "INVALID_INPUT", message: "model is required" } }` |

---

## 4. Data Flow

```mermaid
sequenceDiagram
    participant A as Agent
    participant P as Proxy Route
    participant Auth as proxyAuth MW
    participant DB as PostgreSQL
    participant U as Upstream LLM

    A->>P: POST /v1/chat/completions<br/>Bearer sk-prov-xxx
    P->>Auth: 驗證 key
    Auth->>DB: SELECT FROM provisioned_keys<br/>WHERE key_value = ? AND is_revoked = false

    alt Key 無效/revoked/disabled
        DB-->>Auth: 0 rows 或 disabled=true
        Auth-->>A: 401 UNAUTHORIZED
    else Key 有效
        DB-->>Auth: { userId, keyId, creditLimit, usage }
        Auth-->>P: set context (userId, keyId, ...)
    end

    P->>DB: SELECT total_credits, total_usage<br/>FROM credit_balances

    alt Credits 不足
        DB-->>P: remaining <= 0
        P-->>A: 402 INSUFFICIENT_CREDITS
    else Credits 足夠
        DB-->>P: remaining > 0
    end

    P->>U: POST /v1/chat/completions<br/>Bearer UPSTREAM_API_KEY

    alt 上游成功
        U-->>P: 200 { choices, usage: { prompt_tokens, completion_tokens, total_tokens } }
        P->>P: calculateCost(model, usage)
        P->>DB: BEGIN TRANSACTION
        Note over P,DB: UPDATE provisioned_keys SET usage = usage + cost<br/>UPDATE credit_balances SET total_usage = total_usage + cost<br/>INSERT INTO usage_logs (...)
        DB-->>P: COMMIT
        P-->>A: 200 原始 response body
    else 上游錯誤（4xx/5xx）
        U-->>P: {status} error body
        P->>DB: INSERT usage_logs (cost=0, upstream_status={status})
        P-->>A: {status} 原始 error body
    else 連線失敗
        U--xP: network error
        P-->>A: 502 UPSTREAM_UNREACHABLE
    end
```

### 4.1 API 契約

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible proxy endpoint |

**Request**

```
POST /v1/chat/completions
Authorization: Bearer sk-prov-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7
  // ... 其他 OpenAI-compatible 參數，原樣轉發
}
```

**Response（成功）**: 原樣轉發上游 response body + status code，不修改。

**Error Responses**

| Status | Code | 說明 |
|--------|------|------|
| 400 | `INVALID_INPUT` | 缺少 `model` 欄位 |
| 401 | `UNAUTHORIZED` | 無效/revoked/disabled key |
| 402 | `CREDIT_LIMIT_EXCEEDED` | Key credit limit 超限 |
| 402 | `INSUFFICIENT_CREDITS` | 帳戶餘額不足 |
| 502 | `UPSTREAM_UNREACHABLE` | 上游 LLM 連線失敗 |

### 4.2 資料模型

#### usage_logs（新增）

```sql
CREATE TABLE usage_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    key_id            UUID NOT NULL REFERENCES provisioned_keys(id),
    model             TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    cost              NUMERIC NOT NULL DEFAULT 0,
    upstream_status   INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_key_id ON usage_logs(key_id);
```

#### provisioned_keys（現有，寫入 `usage` 欄位）

- `usage NUMERIC NOT NULL DEFAULT 0` — 累加每次請求的 cost

#### credit_balances（現有，寫入 `total_usage` 欄位）

- `total_usage NUMERIC NOT NULL DEFAULT 0` — 累加每次請求的 cost

---

## 5. 任務清單

### 5.1 任務總覽

| # | 任務 | 類型 | 複雜度 | Agent | 依賴 | FA |
|---|------|------|--------|-------|------|-----|
| 1 | DB Migration: usage_logs 表 | 資料層 | S | db-expert | - | FA-D |
| 2 | Config 擴充: 上游 API 設定 | 後端 | S | backend-expert | - | FA-P |
| 3 | Model Pricing 常數 + calculateCost | 後端 | S | backend-expert | - | FA-U |
| 4 | Provisioned Key Auth Middleware | 後端 | M | backend-expert | - | FA-A |
| 5 | Usage Service: recordUsage transaction | 後端 | M | backend-expert | #1, #3 | FA-U |
| 6 | Proxy Route: /v1/chat/completions | 後端 | L | backend-expert | #2, #4, #5 | FA-P |
| 7 | App 掛載 + Error Handling 整合 | 後端 | S | backend-expert | #6 | FA-P |
| 8 | 整合測試（mock upstream） | 測試 | L | test-engineer | #7 | ALL |

### 5.2 任務詳情

#### Task #1: DB Migration — usage_logs 表
- **類型**: 資料層
- **複雜度**: S
- **Agent**: db-expert
- **描述**: 新增 `src/db/migrations/002_usage_logs.sql`，建立 `usage_logs` 表及索引。
- **DoD**:
  - [ ] `002_usage_logs.sql` 存在且語法正確
  - [ ] 包含 `usage_logs` 表定義（UUID PK、user_id FK、key_id FK、model、prompt/completion/total tokens、cost、upstream_status、created_at）
  - [ ] 包含 `idx_usage_logs_user_id` 和 `idx_usage_logs_key_id` 索引
  - [ ] Migration 可重複執行不報錯（使用 IF NOT EXISTS 或由 migrate 機制處理）
- **驗收方式**: `bun run` 啟動後 migration 自動執行，`\d usage_logs` 確認表結構

#### Task #2: Config 擴充 — 上游 API 設定
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **描述**: 在 `src/config.ts` 新增 `upstreamApiKey` 和 `upstreamApiBase` getter。
- **實作規格**:
  ```typescript
  get upstreamApiKey() { return process.env.UPSTREAM_API_KEY || ''; },
  get upstreamApiBase() { return process.env.UPSTREAM_API_BASE || 'https://api.openai.com'; },
  ```
- **DoD**:
  - [ ] `config.upstreamApiKey` 讀取 `UPSTREAM_API_KEY` 環境變數
  - [ ] `config.upstreamApiBase` 讀取 `UPSTREAM_API_BASE` 環境變數，預設 `https://api.openai.com`
- **驗收方式**: import config 後可存取新屬性

#### Task #3: Model Pricing 常數 + calculateCost
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **描述**: 新增 `src/services/pricing.ts`，包含硬編碼 model pricing 表和 `calculateCost()` 函式。
- **實作規格**:
  ```typescript
  // per 1M tokens (USD)
  const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
    'claude-haiku-3-5': { input: 0.80, output: 4.00 },
  };
  const DEFAULT_PRICING = { input: 5.00, output: 15.00 };

  export function calculateCost(model: string, promptTokens: number, completionTokens: number): number
  // 回傳 USD，精度到小數第 6 位
  // cost = (promptTokens / 1_000_000 * pricing.input) + (completionTokens / 1_000_000 * pricing.output)
  ```
- **DoD**:
  - [ ] `calculateCost` 正確計算已知 model 的 cost
  - [ ] 未知 model 使用 `DEFAULT_PRICING`
  - [ ] export `MODEL_PRICING`（方便測試）
- **驗收方式**: 單元測試驗證 `calculateCost('gpt-4o', 1000, 500)` = `(1000/1M * 2.50) + (500/1M * 10.00)` = `0.0025 + 0.005` = `0.0075`

#### Task #4: Provisioned Key Auth Middleware
- **類型**: 後端
- **複雜度**: M
- **Agent**: backend-expert
- **描述**: 在 `src/middleware/auth.ts` 新增 `proxyAuthMiddleware(sql)` export。查 `provisioned_keys` 表，驗證 key 有效性。
- **實作規格**:
  - 解析 `Authorization: Bearer sk-prov-xxx`
  - 查詢: `SELECT id, user_id, credit_limit, usage, disabled, is_revoked FROM provisioned_keys WHERE key_value = $1`
  - 檢查順序: 不存在 → 401 / `is_revoked` → 401 / `disabled` → 401 / `credit_limit != null && usage >= credit_limit` → 402
  - 通過後 `c.set('userId', ...)`, `c.set('keyId', ...)`, `c.set('keyCreditLimit', ...)`, `c.set('keyUsage', ...)`
- **DoD**:
  - [ ] 無效 key 回傳 401 `UNAUTHORIZED`
  - [ ] Revoked key 回傳 401 `KEY_REVOKED`
  - [ ] Disabled key 回傳 401 `KEY_DISABLED`
  - [ ] Credit limit 超限回傳 402 `CREDIT_LIMIT_EXCEEDED`
  - [ ] 通過驗證後 context 包含 `userId`、`keyId`
  - [ ] 不影響現有 `authMiddleware`
- **驗收方式**: 測試各種 key 狀態的 auth 結果

#### Task #5: Usage Service — recordUsage transaction
- **類型**: 後端
- **複雜度**: M
- **Agent**: backend-expert
- **依賴**: Task #1, #3
- **描述**: 新增 `src/services/usage.ts`，在單一 PostgreSQL transaction 內完成三步操作。
- **實作規格**:
  ```typescript
  export async function recordUsage(sql: Sql, params: {
    userId: string;
    keyId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    upstreamStatus: number | null;
  }): Promise<void>
  ```
  Transaction 內容:
  1. `UPDATE provisioned_keys SET usage = usage + $cost WHERE id = $keyId`
  2. `UPDATE credit_balances SET total_usage = total_usage + $cost, updated_at = now() WHERE user_id = $userId`
  3. `INSERT INTO usage_logs (...) VALUES (...)`
- **DoD**:
  - [ ] 三步操作在同一 transaction 內
  - [ ] Transaction 失敗時全部 rollback
  - [ ] `provisioned_keys.usage` 正確累加
  - [ ] `credit_balances.total_usage` 正確累加
  - [ ] `usage_logs` 記錄完整
- **驗收方式**: 呼叫 `recordUsage` 後查 DB 驗證三表狀態一致

#### Task #6: Proxy Route — /v1/chat/completions
- **類型**: 後端
- **複雜度**: L
- **Agent**: backend-expert
- **依賴**: Task #2, #4, #5
- **描述**: 新增 `src/routes/proxy.ts`，實作核心 proxy 邏輯。
- **實作規格**:
  1. 掛載 `proxyAuthMiddleware(sql)`
  2. 解析 request body，提取 `model`（必填，否則 400）
  3. 檢查帳戶 credits（`total_credits - total_usage > 0`，否則 402）
  4. 建構上游 request:
     - URL: `${config.upstreamApiBase}/v1/chat/completions`
     - Headers: `Authorization: Bearer ${config.upstreamApiKey}`, `Content-Type: application/json`
     - Body: 原始 request body（不修改）
  5. `fetch` 上游，catch 網路錯誤 → 502
  6. 讀取上游 response body（JSON）
  7. 若上游 200：提取 `usage.prompt_tokens` / `completion_tokens` / `total_tokens`，呼叫 `calculateCost`，呼叫 `recordUsage`
  8. 若上游非 200：記錄 usage_logs（cost=0，upstream_status）
  9. 回傳上游 response body + status code
- **DoD**:
  - [ ] 成功轉發請求到上游並回傳原始 response
  - [ ] 替換 Authorization header 為上游 API key
  - [ ] 不修改 request body 和 response body
  - [ ] 上游 200 時正確提取 usage 並記錄
  - [ ] 上游非 200 時記錄 usage_logs（cost=0）
  - [ ] 網路錯誤回傳 502
  - [ ] 缺少 model 回傳 400
  - [ ] Credits 不足回傳 402
- **驗收方式**: 配合 mock upstream 的整合測試

#### Task #7: App 掛載 + Error Handling 整合
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **依賴**: Task #6
- **描述**: 在 `src/app.ts` 掛載 proxy route。
- **實作規格**:
  ```typescript
  import { proxyRoutes } from './routes/proxy';
  // ...
  app.route('/v1', proxyRoutes(sql));
  ```
- **DoD**:
  - [ ] `POST /v1/chat/completions` 可達
  - [ ] 現有路由（`/keys`, `/credits`, `/auth`, `/oauth`）不受影響
  - [ ] 全域 errorHandler 正確處理 proxy 拋出的 AppError
- **驗收方式**: `curl POST /v1/chat/completions` 回傳預期結果

#### Task #8: 整合測試（mock upstream）
- **類型**: 測試
- **複雜度**: L
- **Agent**: test-engineer
- **依賴**: Task #7
- **描述**: 建立 `tests/proxy.test.ts`，使用 mock upstream server 測試完整 proxy 流程。
- **測試策略**:
  - 啟動一個 Hono mock server 在隨機 port，模擬上游 LLM response（回傳固定 usage tokens）
  - 設定 `UPSTREAM_API_BASE` 指向 mock server
  - 不需要真實 OpenAI API key
- **測試案例**（至少 10 個）:
  1. 有效 key + 成功轉發 → 200 + usage 記錄
  2. 無 Authorization header → 401
  3. 無效 key → 401
  4. Revoked key → 401
  5. Disabled key → 401
  6. Credit limit 超限 → 402
  7. 帳戶餘額不足 → 402
  8. 缺少 model → 400
  9. 上游回傳 500 → 轉發 500 + usage_logs 記錄（cost=0）
  10. 上游不可達 → 502
  11. Usage tokens 正確寫入 usage_logs
  12. provisioned_keys.usage 正確累加
  13. credit_balances.total_usage 正確累加
- **DoD**:
  - [ ] 至少 10 個測試案例通過
  - [ ] 覆蓋所有異常流程
  - [ ] 使用 mock upstream，不依賴外部 API
  - [ ] 現有測試不受影響
- **驗收方式**: `bun test` 全部通過

---

## 6. 技術決策

### 6.1 架構決策

| 決策點 | 選項 | 選擇 | 理由 |
|--------|------|------|------|
| Proxy auth vs 複用 authMiddleware | A: 複用 authMiddleware 加參數<br/>B: 獨立 proxyAuthMiddleware | B | 查詢的表不同（management_keys vs provisioned_keys），context 需求也不同（需要 keyId、creditLimit），硬塞進去只會增加耦合 |
| Pricing 來源 | A: 硬編碼常數<br/>B: DB 表<br/>C: 外部 API | A | 初期 model 有限，硬編碼最簡單；未來可升級為 DB 表 |
| Usage 記錄時機 | A: 上游回傳後同步<br/>B: 非同步 queue | A | 目前規模不需要 queue 複雜度；同步保證一致性 |
| 上游非 200 時是否記錄 | A: 不記錄<br/>B: 記錄 cost=0 | B | 便於除錯和監控上游錯誤率 |
| Cost 精度 | A: 2 位小數<br/>B: 6 位小數 | B | Token 級別計算需要足夠精度，DB NUMERIC 型別無限精度 |

### 6.2 設計模式
- **Middleware Chain**: proxyAuth → credits check → proxy handler，職責清晰分離
- **Service Layer**: `pricing.ts` 和 `usage.ts` 作為獨立 service，route 只做膠水
- **Transaction Pattern**: 沿用 credits.ts 的 `sql.begin()` 模式

### 6.3 相容性考量
- **向後相容**: 新增 endpoint，不修改任何現有 API 行為
- **Migration**: 新增 `usage_logs` 表，不修改現有表結構
- **環境變數**: 新增 `UPSTREAM_API_KEY`、`UPSTREAM_API_BASE`，不影響現有設定

---

## 7. 驗收標準

### 7.1 功能驗收

| # | 場景 | Given | When | Then | 優先級 |
|---|------|-------|------|------|--------|
| 1 | 成功 proxy 轉發 | 有效 provisioned key + 足夠 credits | POST /v1/chat/completions | 200 + 原始 response body | P0 |
| 2 | 無效 key 拒絕 | 不存在的 key | POST /v1/chat/completions | 401 UNAUTHORIZED | P0 |
| 3 | Revoked key 拒絕 | is_revoked = true 的 key | POST /v1/chat/completions | 401 KEY_REVOKED | P0 |
| 4 | Disabled key 拒絕 | disabled = true 的 key | POST /v1/chat/completions | 401 KEY_DISABLED | P0 |
| 5 | Credit limit 超限 | usage >= credit_limit | POST /v1/chat/completions | 402 CREDIT_LIMIT_EXCEEDED | P0 |
| 6 | 帳戶餘額不足 | total_credits - total_usage <= 0 | POST /v1/chat/completions | 402 INSUFFICIENT_CREDITS | P0 |
| 7 | Usage 正確記錄 | 成功 proxy 後 | 查 DB | usage_logs 有記錄、provisioned_keys.usage 累加、credit_balances.total_usage 累加 | P0 |
| 8 | 上游不可達 | UPSTREAM_API_BASE 指向不存在的 host | POST /v1/chat/completions | 502 UPSTREAM_UNREACHABLE | P1 |
| 9 | 上游錯誤轉發 | 上游回傳 500 | POST /v1/chat/completions | 500 + 原始 error body + usage_logs cost=0 | P1 |
| 10 | 缺少 model | request body 無 model 欄位 | POST /v1/chat/completions | 400 INVALID_INPUT | P1 |
| 11 | 現有路由不受影響 | 正常 management key | GET /keys | 200 正常回應 | P0 |

### 7.2 非功能驗收

| 項目 | 標準 |
|------|------|
| 效能 | Proxy 額外延遲 < 50ms（不含上游 latency） |
| 安全 | 上游 API key 不出現在 response 或 log 中 |
| 一致性 | Transaction 內三步操作全部成功或全部 rollback |

### 7.3 測試計畫
- **單元測試**: `calculateCost()` 計算正確性
- **整合測試**: 完整 proxy 流程（mock upstream），覆蓋所有 AC 場景
- **不需要 E2E**: 此為 server-side feature，整合測試即可覆蓋

---

## 8. 風險與緩解

| 風險 | 影響 | 機率 | 緩解措施 | 負責人 |
|------|------|------|---------|--------|
| 上游 response body 巨大導致記憶體壓力 | 中 | 低 | 初期不處理 streaming，body 通常 < 100KB；未來可加 body size limit | backend-expert |
| 計費精度問題（浮點數） | 中 | 中 | 使用 DB NUMERIC 型別（任意精度）；JS 層用 `Number` 但精度到 6 位小數足夠 | backend-expert |
| 上游 response 無 usage 欄位 | 低 | 低 | 防禦性程式碼：usage 欄位不存在時 tokens 全部設 0、cost 設 0 | backend-expert |
| Transaction 內 DB 操作失敗但已轉發成功 | 高 | 極低 | Response 已回傳給 agent，usage 記錄失敗需要 log 告警（初期 console.error，未來加 alerting） | backend-expert |
| UPSTREAM_API_KEY 未設定 | 中 | 中 | Proxy route 啟動時檢查，未設定則 log warning；請求時回傳 502 | backend-expert |

### 回歸風險
- 現有路由使用獨立的 `authMiddleware`，proxy 使用 `proxyAuthMiddleware`，互不影響
- 新增 `usage_logs` 表不修改現有表結構
- `app.route('/v1', ...)` 掛載路徑與現有路由（`/keys`, `/credits`, `/auth`, `/oauth`）無衝突

---

## SDD Context

```json
{
  "stages": {
    "s1": {
      "status": "completed",
      "agents": ["codebase-explorer", "architect"],
      "completed_at": "2026-03-15T23:15:00+08:00",
      "output": {
        "completed_phases": [1, 2],
        "dev_spec_path": "dev/specs/2026-03-15_5_api-proxy/s1_dev_spec.md",
        "solution_summary": "新增 POST /v1/chat/completions proxy endpoint，含 provisioned key auth middleware、upstream 轉發、usage 計算 + credits 扣減（PostgreSQL transaction）、usage_logs 記錄",
        "tasks": [
          { "id": 1, "name": "DB Migration: usage_logs", "type": "db", "complexity": "S" },
          { "id": 2, "name": "Config: upstream API", "type": "backend", "complexity": "S" },
          { "id": 3, "name": "Pricing: calculateCost", "type": "backend", "complexity": "S" },
          { "id": 4, "name": "Provisioned Key Auth MW", "type": "backend", "complexity": "M" },
          { "id": 5, "name": "Usage Service: recordUsage", "type": "backend", "complexity": "M" },
          { "id": 6, "name": "Proxy Route", "type": "backend", "complexity": "L" },
          { "id": 7, "name": "App 掛載", "type": "backend", "complexity": "S" },
          { "id": 8, "name": "整合測試", "type": "test", "complexity": "L" }
        ],
        "acceptance_criteria": 11,
        "assumptions": [
          "上游 API 為 OpenAI-compatible 格式",
          "不支援 streaming (SSE)",
          "單一上游 provider",
          "Pricing 硬編碼，不需即時更新"
        ],
        "tech_debt": [
          "Pricing 硬編碼，未來應移至 DB 或設定檔",
          "無 streaming 支援",
          "Transaction 失敗時無 alerting 機制",
          "無 rate limiting"
        ],
        "regression_risks": [
          "現有路由不受影響（獨立 middleware + 不同路徑）",
          "不修改現有表結構"
        ]
      }
    }
  }
}
```
