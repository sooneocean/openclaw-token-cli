# S1 Dev Spec: Mock Handler 重構

> **階段**: S1 技術分析
> **建立時間**: 2026-03-15 20:15
> **Agent**: codebase-explorer (Phase 1) + architect (Phase 2)
> **工作類型**: refactor
> **複雜度**: M

---

## 1. 概述

### 1.1 需求參照
> 完整需求見 `s0_brief_spec.md`，以下僅摘要。

消除 mock handler 中 `extractToken`/`requireValidToken` 的跨檔重複定義（3 檔各 13 行 + oauth 5 行），並將 `MockStore.getEmailForToken` 從靜態回傳 `DEMO_EMAIL` 重構為基於 `tokenEmailMap` 的真實 token-to-email 映射。

### 1.2 技術方案摘要

1. 新增 `src/mock/utils.ts`，集中 export `extractToken` 與 `requireValidToken`
2. `MockStore` 新增 `tokenEmailMap: Map<string, string>`，`getEmailForToken` 改查此 Map（回傳 `string | null`）
3. `initDefaults()` 與 `reset()` 維護 `DEMO_MANAGEMENT_KEY -> DEMO_EMAIL` 的初始映射
4. 四個 handler 刪除 local 重複定義，改 import `utils.ts`；在 register/login/rotate/OAuth userinfo 等操作中維護映射
5. 更新所有受影響的單元測試與整合測試

---

## 2. 影響範圍（Phase 1：codebase-explorer）

### 2.1 受影響檔案

#### 新增檔案
| 檔案 | 說明 |
|------|------|
| `src/mock/utils.ts` | 共用工具函式：extractToken + requireValidToken |

#### Mock 層
| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `src/mock/store.ts` | 修改 | 新增 tokenEmailMap、改寫 getEmailForToken、更新 initDefaults/reset |
| `src/mock/handlers/auth.mock.ts` | 修改 | 刪除 local extractToken/requireValidToken，import utils，register/login/rotate 維護映射 |
| `src/mock/handlers/credits.mock.ts` | 修改 | 刪除 local extractToken/requireValidToken，import utils |
| `src/mock/handlers/keys.mock.ts` | 修改 | 刪除 local extractToken/requireValidToken，import utils |
| `src/mock/handlers/oauth.mock.ts` | 修改 | extractBearerToken 改為 import extractToken，userinfo 維護映射 |

#### 測試檔案
| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `tests/unit/mock/store.test.ts` | 修改 | getEmailForToken 測試更新（null 回傳 + tokenEmailMap 驗證） |
| `tests/unit/mock/handlers/auth.mock.test.ts` | 修改 | 使用 DEMO_MANAGEMENT_KEY 或 login 取得映射 token |
| `tests/unit/mock/handlers/credits.mock.test.ts` | 修改 | 同上 |
| `tests/unit/mock/handlers/keys.mock.test.ts` | 修改 | 同上 |
| `tests/unit/mock/handlers/oauth.mock.test.ts` | 修改 | 驗證 userinfo 建立映射 |
| `tests/integration/*.test.ts` | 驗證 | 全量回歸，可能需微調 token 使用方式 |

#### 不受影響
| 檔案/目錄 | 原因 |
|-----------|------|
| `src/mock/handler.ts` | MockRouter 不涉及 token 邏輯 |
| `src/mock/index.ts` | 僅 re-export，不涉及 |
| `src/services/*`, `src/commands/*`, `src/api/*` | CLI 業務層，不在 scope 內 |

### 2.2 依賴關係
- **上游依賴**: `src/mock/handler.ts`（MockRequest, MockResponse 型別）、`src/mock/store.ts`（MockStore 型別）
- **下游影響**: 所有 mock handler 測試（需改用已映射的 token）

### 2.3 現有模式與技術考量
- Handler 遵循 factory pattern：`register*Handlers(router: MockRouter)` 接收 router 注入的 store（P-CLI-003）
- `requireValidToken` 回傳 union type `MockResponse | string`，handler 以 `typeof result !== 'string'` 判斷是否 401
- `extractToken` 純粹做 Bearer header 剝離，不做格式驗證
- OAuth access_token 格式為 `gho_xxx`，不符合 `isValidToken` 的 `sk-mgmt-` regex，因此 oauth.mock.ts 只能用 `extractToken`，不能用 `requireValidToken`

---

## 2.5 [refactor 專用] 現狀分析

### 現狀問題

| # | 問題 | 嚴重度 | 影響範圍 | 說明 |
|---|------|--------|---------|------|
| 1 | extractToken/requireValidToken 跨 3 檔完全重複 | 中 | auth/credits/keys mock handlers | 各 13 行完全相同的程式碼，違反 DRY，任一修改需同步 3 處（P-CLI-004） |
| 2 | oauth.mock.ts extractBearerToken 命名不一致 | 低 | oauth mock handler | 功能完全相同但函數名不同，增加認知負擔 |
| 3 | getEmailForToken 靜態回傳 DEMO_EMAIL | 高 | MockStore + 所有 handler | 完全忽略 token 參數，無法支援多用戶場景，阻礙 contract testing |

### 目標狀態（Before -> After）

| 面向 | Before | After |
|------|--------|-------|
| 程式碼重複 | extractToken/requireValidToken 在 auth/credits/keys 各定義一次（39 行重複） | 集中於 `src/mock/utils.ts` 單一定義，handler 只 import |
| 命名一致性 | oauth 用 `extractBearerToken`，其他用 `extractToken` | 統一為 `extractToken` |
| Token 映射 | `getEmailForToken(_token)` 靜態回傳 `DEMO_EMAIL` | `getEmailForToken(token)` 查 `tokenEmailMap`，不存在回傳 `null` |
| 映射生命週期 | 無 | register/login/rotate/OAuth userinfo 維護映射；reset 清除後重建 demo 映射 |
| 回傳型別 | `getEmailForToken(): string` | `getEmailForToken(): string | null` |
| requireValidToken null 處理 | 不存在（永遠拿到 string） | `null` 時回傳 401 MockResponse |

### 遷移路徑

1. **Wave 1A**: 建立 `src/mock/utils.ts`，定義 `extractToken` + `requireValidToken`（含 null 處理）
2. **Wave 1B**: `MockStore` 新增 `tokenEmailMap`，改寫 `getEmailForToken`，更新 `initDefaults`/`reset`
3. **Wave 2**: 各 handler 刪除 local 重複定義，import utils；在 register/login/rotate/userinfo 中加入映射維護
4. **Wave 3**: 更新測試 —— store.test.ts 驗證新行為，handler 測試改用已映射 token

> 每一步完成後 HTTP 回應規格不變，外部行為等價。

### 回歸風險矩陣

| 外部行為 | 驗證方式 | 風險等級 | 說明 |
|---------|---------|---------|------|
| 合法 token 的 GET /auth/me 回傳 200 + 正確 email | 單元測試 + 整合測試 | 高 | 測試原使用任意合法格式 token，重構後需改用 DEMO_MANAGEMENT_KEY |
| 無效/缺少 token 回傳 401 | 單元測試 | 低 | 邏輯不變 |
| POST /auth/register 回傳 201 + management_key | 單元測試 | 中 | 新增映射邏輯，需驗證回傳 key 可用於後續 API |
| POST /auth/login 回傳 200 + management_key | 單元測試 | 中 | 新增映射邏輯 |
| POST /auth/rotate 撤銷舊 key、新 key 可用 | 單元測試 | 高 | rotate 需同時更新 tokenEmailMap（刪舊加新） |
| OAuth userinfo 建立/合併帳號 | 單元測試 | 中 | 新增映射邏輯 |
| store.reset() 後 demo 帳號可正常使用 | 單元測試 | 高 | tokenEmailMap 必須在 reset 後重建 demo 映射 |
| credits/keys API 正常回傳 | 單元測試 + 整合測試 | 中 | 只改 import，無邏輯變更 |

---

## 3. 技術方案（Phase 2：architect）

### 3.1 src/mock/utils.ts 介面定義

```typescript
// src/mock/utils.ts
import type { MockRequest, MockResponse } from './handler.js';
import type { MockStore } from './store.js';

/**
 * 從 HTTP request 的 Authorization header 剝離 Bearer prefix，
 * 回傳原始 token 字串。無 header 或格式不符回傳 null。
 */
export function extractToken(req: MockRequest): string | null;

/**
 * 驗證 request 中的 token 有效性（格式 + 未撤銷 + 存在映射）。
 * 回傳 email（string）表示通過驗證；回傳 MockResponse 表示 401。
 */
export function requireValidToken(req: MockRequest, store: MockStore): MockResponse | string;
```

`requireValidToken` 內部邏輯：
1. 呼叫 `extractToken(req)` 取得 token
2. `!token || !store.isValidToken(token)` → 回傳 401
3. `store.getEmailForToken(token)` → 若 `null` → 回傳 401
4. 否則回傳 email string

### 3.2 MockStore 變更

```typescript
// 新增欄位
private tokenEmailMap = new Map<string, string>();

// 改寫方法
getEmailForToken(token: string): string | null {
  return this.tokenEmailMap.get(token) ?? null;
}

// 新增公開方法（供 handler 調用）
setTokenEmailMapping(token: string, email: string): void {
  this.tokenEmailMap.set(token, email);
}

removeTokenEmailMapping(token: string): void {
  this.tokenEmailMap.delete(token);
}

// 修改 initDefaults()
private initDefaults(): void {
  // ...existing code...
  this.tokenEmailMap.set(DEMO_MANAGEMENT_KEY, DEMO_EMAIL);  // 新增
}

// 修改 reset()
reset(): void {
  // ...existing clears...
  this.tokenEmailMap.clear();  // 新增
  this.initDefaults();  // 已存在，會重建 demo 映射
}
```

> `MockStoreState` interface 可選是否加入 `tokenEmailMap`。由於此 interface 僅用於 constructor 注入初始狀態，且 tokenEmailMap 為內部實作細節，建議不加入 interface，改為 `initDefaults` 自動維護。

### 3.3 各 Handler 變更清單

#### auth.mock.ts
| 位置 | 變更 | 說明 |
|------|------|------|
| L1-3 | 新增 import | `import { extractToken, requireValidToken } from '../utils.js';` |
| L4-16 | 刪除 | 移除 local extractToken + requireValidToken 定義 |
| register handler | 新增一行 | `store.setTokenEmailMapping(managementKey, body.email);`（在 store.users.set 之後） |
| login handler | 新增一行 | `store.setTokenEmailMapping(user.management_key, body.email);`（在 return 之前） |
| rotate handler L56 | 改 import | `extractToken` 改為從 utils import（已在頂部 import） |
| rotate handler | 新增映射維護 | `store.removeTokenEmailMapping(oldKey);` + `if (requestToken && requestToken !== oldKey) store.removeTokenEmailMapping(requestToken);` + `store.setTokenEmailMapping(newKey, email);` |

#### credits.mock.ts
| 位置 | 變更 | 說明 |
|------|------|------|
| L1 | 新增 import | `import { requireValidToken } from '../utils.js';` |
| L4-16 | 刪除 | 移除 local extractToken + requireValidToken 定義 |
| 其餘 | 不變 | credits handler 不產生新 token，無需維護映射 |

#### keys.mock.ts
| 位置 | 變更 | 說明 |
|------|------|------|
| L1 | 新增 import | `import { requireValidToken } from '../utils.js';` |
| L4-16 | 刪除 | 移除 local extractToken + requireValidToken 定義 |
| 其餘 | 不變 | keys handler 的 provisioned key 不使用 management key 映射 |

#### oauth.mock.ts
| 位置 | 變更 | 說明 |
|------|------|------|
| L1 | 新增 import | `import { extractToken } from '../utils.js';` |
| L4-8 | 刪除 | 移除 local extractBearerToken 定義 |
| L84 | 改名 | `extractBearerToken(req)` → `extractToken(req)` |
| userinfo handler | 新增一行 | `store.setTokenEmailMapping(management_key, email);`（在 return 之前，不論 merged 與否） |

> **設計決策**: oauth.mock.ts 的 userinfo 不使用 `requireValidToken`，因為 access_token (`gho_xxx`) 格式不符 `isValidToken` 的 `sk-mgmt-` regex。userinfo 有自己的 oauthSessions 驗證邏輯，此處只替換函數名。

---

## 5. 任務清單

### 5.1 任務總覽

| # | 任務 | 類型 | 複雜度 | Agent | 依賴 | Wave |
|---|------|------|--------|-------|------|------|
| T1 | 建立 src/mock/utils.ts | 後端 | S | backend-expert | - | 1 |
| T2 | MockStore tokenEmailMap 重構 | 後端 | M | backend-expert | - | 1 |
| T3 | auth.mock.ts 更新 | 後端 | M | backend-expert | T1, T2 | 2 |
| T4 | credits.mock.ts + keys.mock.ts 更新 | 後端 | S | backend-expert | T1 | 2 |
| T5 | oauth.mock.ts 更新 | 後端 | S | backend-expert | T1, T2 | 2 |
| T6 | store.test.ts 更新 | 測試 | S | backend-expert | T2 | 3 |
| T7 | handler 單元測試更新 | 測試 | M | backend-expert | T3, T4, T5 | 3 |
| T8 | 全量回歸驗證 | 測試 | S | backend-expert | T6, T7 | 3 |

### 5.2 任務詳情

#### Task #1: 建立 src/mock/utils.ts
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **影響檔案**: `src/mock/utils.ts`（新增）
- **描述**: 建立共用工具模組，export `extractToken` 與 `requireValidToken`。`requireValidToken` 在 `getEmailForToken` 回傳 `null` 時回傳 401 MockResponse。
- **DoD**:
  - [ ] `extractToken(req)` 從 Authorization header 剝離 Bearer prefix，回傳 `string | null`
  - [ ] `requireValidToken(req, store)` 回傳 `MockResponse | string`（email）
  - [ ] `requireValidToken` 在 token 無效或無映射時回傳 `{ status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } } }`
  - [ ] TypeScript 編譯通過
- **驗收方式**: import 後 TypeScript 不報錯；T7 測試涵蓋

#### Task #2: MockStore tokenEmailMap 重構
- **類型**: 後端
- **複雜度**: M
- **Agent**: backend-expert
- **影響檔案**: `src/mock/store.ts`
- **描述**: 新增 `tokenEmailMap` 欄位、`setTokenEmailMapping`/`removeTokenEmailMapping` 方法。改寫 `getEmailForToken` 查 Map，回傳 `string | null`。更新 `initDefaults` 加入 `DEMO_MANAGEMENT_KEY -> DEMO_EMAIL` 映射。`reset` 清除 `tokenEmailMap` 後透過 `initDefaults` 重建。
- **DoD**:
  - [ ] `getEmailForToken(token)` 回傳型別為 `string | null`
  - [ ] `getEmailForToken(DEMO_MANAGEMENT_KEY)` 初始化後回傳 `'demo@openclaw.dev'`
  - [ ] `getEmailForToken('unknown-token')` 回傳 `null`
  - [ ] `setTokenEmailMapping(token, email)` 後 `getEmailForToken(token)` 回傳該 email
  - [ ] `removeTokenEmailMapping(token)` 後 `getEmailForToken(token)` 回傳 `null`
  - [ ] `reset()` 後 `tokenEmailMap` 僅保留 demo 映射
  - [ ] `DEMO_MANAGEMENT_KEY` 和 `DEMO_EMAIL` 改為 export（供 T6/T7 測試引用）
  - [ ] TypeScript 編譯通過
- **驗收方式**: T6 store.test.ts 測試涵蓋

#### Task #3: auth.mock.ts 更新
- **類型**: 後端
- **複雜度**: M
- **Agent**: backend-expert
- **依賴**: T1, T2
- **影響檔案**: `src/mock/handlers/auth.mock.ts`
- **描述**: 刪除 local `extractToken`/`requireValidToken`，改 import from `../utils.js`。register handler 新增 `store.setTokenEmailMapping(managementKey, email)`。login handler 新增 `store.setTokenEmailMapping(user.management_key, email)`。rotate handler 刪除舊映射、新增新映射。
- **DoD**:
  - [ ] 檔案內無 local `extractToken`/`requireValidToken` 定義
  - [ ] import 來自 `../utils.js`
  - [ ] register 成功後 `tokenEmailMap` 有新 key 的映射
  - [ ] login 成功後 `tokenEmailMap` 有 management_key 的映射
  - [ ] rotate 成功後舊 key 映射已刪除、新 key 映射已建立
  - [ ] rotate handler 的 `extractToken(req)` 取 requestToken 邏輯保留且正確
  - [ ] HTTP 回應格式與 status code 不變
- **驗收方式**: T7 auth.mock.test.ts 全部通過

#### Task #4: credits.mock.ts + keys.mock.ts 更新
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **依賴**: T1
- **影響檔案**: `src/mock/handlers/credits.mock.ts`, `src/mock/handlers/keys.mock.ts`
- **描述**: 刪除兩個檔案中的 local `extractToken`/`requireValidToken`，改 import from `../utils.js`。其餘邏輯不變（這兩個 handler 不產生新 management key）。
- **DoD**:
  - [ ] 兩個檔案內無 local `extractToken`/`requireValidToken` 定義
  - [ ] import 來自 `../utils.js`
  - [ ] credits.mock.ts 僅 import `requireValidToken`（不需 `extractToken`）
  - [ ] keys.mock.ts 僅 import `requireValidToken`（不需 `extractToken`）
  - [ ] HTTP 回應格式與 status code 不變
- **驗收方式**: T7 credits/keys mock test 全部通過

#### Task #5: oauth.mock.ts 更新
- **類型**: 後端
- **複雜度**: S
- **Agent**: backend-expert
- **依賴**: T1, T2
- **影響檔案**: `src/mock/handlers/oauth.mock.ts`
- **描述**: 刪除 local `extractBearerToken`，改 import `extractToken` from `../utils.js`。userinfo handler 在回傳前呼叫 `store.setTokenEmailMapping(management_key, email)`。不引入 `requireValidToken`（access_token 格式不相容）。
- **DoD**:
  - [ ] 檔案內無 local `extractBearerToken` 定義
  - [ ] import `extractToken` 來自 `../utils.js`
  - [ ] userinfo 呼叫處改為 `extractToken(req)`
  - [ ] userinfo 成功回傳前呼叫 `store.setTokenEmailMapping(management_key, email)`
  - [ ] 不 import `requireValidToken`
  - [ ] HTTP 回應格式與 status code 不變
- **驗收方式**: T7 oauth.mock.test.ts 全部通過

#### Task #6: store.test.ts 更新
- **類型**: 測試
- **複雜度**: S
- **Agent**: backend-expert
- **依賴**: T2
- **影響檔案**: `tests/unit/mock/store.test.ts`
- **描述**: 更新 `getEmailForToken` 測試案例。原測試（L29-31）預期任意合法 token 映射到 demo email，需改為：(1) 驗證 DEMO_MANAGEMENT_KEY 回傳 demo email，(2) 驗證未映射 token 回傳 null，(3) 驗證 setTokenEmailMapping/removeTokenEmailMapping，(4) 驗證 reset 後映射重建。
- **DoD**:
  - [ ] 測試 `getEmailForToken(DEMO_MANAGEMENT_KEY)` 回傳 `'demo@openclaw.dev'`
  - [ ] 測試 `getEmailForToken('sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890')` 回傳 `null`
  - [ ] 測試 `setTokenEmailMapping` + `getEmailForToken` 正向流程
  - [ ] 測試 `removeTokenEmailMapping` 後回傳 `null`
  - [ ] 測試 `reset()` 清除自訂映射並保留 demo 映射
  - [ ] 所有 store 測試通過
- **驗收方式**: `vitest run tests/unit/mock/store.test.ts` 全部通過

#### Task #7: handler 單元測試更新
- **類型**: 測試
- **複雜度**: M
- **Agent**: backend-expert
- **依賴**: T3, T4, T5
- **影響檔案**: `tests/unit/mock/handlers/*.mock.test.ts`
- **描述**: 所有測試中使用任意合法格式 token（如 `sk-mgmt-a1b2c3d4-...`）的地方，改為使用 `DEMO_MANAGEMENT_KEY`（`sk-mgmt-de000000-0000-0000-0000-000000000000`），或先透過 register/login 取得已映射的 token。確保 register/login 後用回傳的 key 做後續操作。
- **DoD**:
  - [ ] auth.mock.test.ts 所有測試通過（含 rotate 連續撤銷場景）
  - [ ] credits.mock.test.ts 所有測試通過
  - [ ] keys.mock.test.ts 所有測試通過
  - [ ] oauth.mock.test.ts 所有測試通過（含 userinfo 映射驗證）
  - [ ] 無測試使用未映射的任意 token
- **驗收方式**: `vitest run tests/unit/mock/handlers/` 全部通過

#### Task #8: 全量回歸驗證
- **類型**: 測試
- **複雜度**: S
- **Agent**: backend-expert
- **依賴**: T6, T7
- **影響檔案**: 全部測試
- **描述**: 執行完整測試套件，確保所有測試通過。包含整合測試。若有失敗需回溯修復。
- **DoD**:
  - [ ] `vitest run` 全量通過（目標 134 個測試）
  - [ ] 無新增 TypeScript 編譯錯誤
  - [ ] 無 console warning/error
- **驗收方式**: CI-equivalent 全量測試通過

---

## 6. 技術決策

### 6.1 架構決策

| 決策點 | 選項 | 選擇 | 理由 |
|--------|------|------|------|
| utils.ts 放置位置 | A: `src/mock/utils.ts` / B: `src/mock/handlers/utils.ts` | A | utils 被 handler 層使用但也依賴 store 層型別，放在 mock 根目錄最合理 |
| getEmailForToken 回傳型別 | A: `string \| null` / B: `string \| undefined` | A | 顯式 null 語意更明確（「查了但沒有」vs「可能沒查」） |
| tokenEmailMap 可見性 | A: private + 公開方法 / B: public 欄位 | A | 遵循封裝原則，透過 `setTokenEmailMapping`/`removeTokenEmailMapping` 操作 |
| oauth.mock.ts 是否用 requireValidToken | A: 不用（只改名） / B: 引入 requireValidToken | A | access_token 格式 (`gho_xxx`) 不符 `isValidToken` 的 `sk-mgmt-` regex，強行引入會破壞 OAuth 流程 |
| rotate 是否刪除舊 tokenEmailMap | A: 刪除 / B: 不刪除（靠 revokedManagementKeys 攔截） | A | 乾淨起見刪除，避免 Map 無限增長；revokedManagementKeys 仍為安全網 |

### 6.2 設計模式
- **Pattern**: Extract Utility Module（提取共用模組）
- **理由**: 消除重複的最直接做法，不需要複雜的抽象層。utils.ts 是純函式模組，無狀態、無副作用（除了透過 store 參數）。

### 6.3 相容性考量
- **向後相容**: HTTP 回應規格完全不變。所有 endpoint 的 request/response 格式、status code 維持原樣。
- **Migration**: 無資料遷移。`tokenEmailMap` 是記憶體中的 Map，隨 `initDefaults()` 自動建立。
- **型別破壞性變更**: `getEmailForToken` 回傳型別從 `string` 改為 `string | null`。這是 breaking change，但影響範圍僅限 mock 層內部（handler 透過 `requireValidToken` 間接使用，已處理 null）。

---

## 7. 驗收標準

### 7.1 功能驗收

| # | 場景 | Given | When | Then | 優先級 |
|---|------|-------|------|------|--------|
| AC-1 | 重複程式碼消除 | 重構完成 | 檢查 auth/credits/keys mock handler | 無 local extractToken/requireValidToken 定義，皆 import from utils | P0 |
| AC-2 | 命名統一 | 重構完成 | 檢查 oauth.mock.ts | 無 extractBearerToken，使用 extractToken | P0 |
| AC-3 | Demo token 映射 | MockStore 初始化 | 呼叫 `getEmailForToken(DEMO_MANAGEMENT_KEY)` | 回傳 `'demo@openclaw.dev'` | P0 |
| AC-4 | 未映射 token | MockStore 初始化 | 呼叫 `getEmailForToken('sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890')` | 回傳 `null` | P0 |
| AC-5 | Register 映射 | 無 | POST /auth/register 成功 | 回傳的 management_key 可用於後續 API 呼叫（getEmailForToken 回傳註冊 email） | P0 |
| AC-6 | Login 映射 | demo 帳號存在 | POST /auth/login 成功 | management_key 在 tokenEmailMap 中有映射 | P0 |
| AC-7 | Rotate 映射 | 已登入的 token | POST /auth/rotate 成功 | 舊 key 映射刪除 + 新 key 映射建立；舊 key 呼叫 API 回傳 401，新 key 回傳 200 | P0 |
| AC-8 | OAuth userinfo 映射 | OAuth 授權完成 | GET /oauth/userinfo 成功 | management_key 在 tokenEmailMap 中有映射 | P1 |
| AC-9 | Reset 映射重建 | 有自訂映射 | 呼叫 store.reset() | tokenEmailMap 僅保留 DEMO_MANAGEMENT_KEY 映射 | P0 |
| AC-10 | 全量測試通過 | 所有變更完成 | 執行 vitest run | 134 個測試全部通過 | P0 |

### 7.2 非功能驗收

| 項目 | 標準 |
|------|------|
| 程式碼品質 | 零重複的 extractToken/requireValidToken 定義 |
| 型別安全 | TypeScript 嚴格模式編譯通過，getEmailForToken 回傳 `string \| null` |
| 測試隔離 | 每個測試 beforeEach 呼叫 reset()，tokenEmailMap 不跨測試污染 |

### 7.3 測試計畫
- **單元測試**: store.test.ts（tokenEmailMap CRUD + reset）、各 handler mock test（token 映射正向/反向）
- **整合測試**: integration/*.test.ts 全量回歸
- **E2E 測試**: 不適用（mock 層無 E2E）

---

## 8. 風險與緩解

| 風險 | 影響 | 機率 | 緩解措施 | 引用 |
|------|------|------|---------|------|
| getEmailForToken 型別變更導致隱性 null 傳播 | 高 | 低 | requireValidToken 內部攔截 null → 401，handler 不直接呼叫 getEmailForToken | - |
| 測試使用任意 token 預期映射到 demo | 高 | 高 | T7 統一改用 DEMO_MANAGEMENT_KEY 或先 register/login | codebase-explorer risk #2 |
| rotate handler extractToken 邏輯遺漏 | 中 | 低 | rotate handler 保留 extractToken import，L56 邏輯不變 | codebase-explorer risk #3 |
| oauth extractBearerToken → extractToken 改名遺漏 | 低 | 低 | T5 明確要求改名 + T7 測試覆蓋 | codebase-explorer risk #4 |
| tokenEmailMap 在 reset 後未重建 demo 映射 | 高 | 低 | initDefaults 已設置映射，reset 呼叫 initDefaults | P-CLI-003 |
| store.test.ts L29 原測試斷言需更新 | 中 | 確定 | T6 明確列出需更新的測試案例 | codebase-explorer regression #2 |

### Pitfall 引用
- **P-CLI-003**: Mock handlers must use router-injected store, not singleton → utils.ts 的 `requireValidToken` 接受 `store` 參數，不引用 singleton
- **P-CLI-004**: 工具函式跨模組重複定義 → 本次重構正式解決

---

## SDD Context

```json
{
  "stages": {
    "s1": {
      "status": "completed",
      "agents": ["codebase-explorer", "architect"],
      "output": {
        "completed_phases": [1, 2],
        "dev_spec_path": "dev/specs/2026-03-15_3_mock-handler-refactor/s1_dev_spec.md",
        "tasks": ["T1:utils.ts", "T2:store-tokenEmailMap", "T3:auth-handler", "T4:credits+keys-handler", "T5:oauth-handler", "T6:store-test", "T7:handler-tests", "T8:regression"],
        "acceptance_criteria": 10,
        "solution_summary": "抽取 extractToken/requireValidToken 到 utils.ts、MockStore 新增 tokenEmailMap 真實映射、四個 handler 更新 import 與映射維護、測試全量回歸",
        "tech_debt": ["P-CLI-004 消除"],
        "regression_risks": ["測試 token 映射變更", "getEmailForToken 回傳型別變更", "rotate 映射維護"]
      }
    }
  }
}
```
