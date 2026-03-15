# S2 Spec Review R1 Findings: Key Rotation 機制

> **審查輪次**: R1
> **Engine**: fallback (claude-sonnet-4-6)
> **審查時間**: 2026-03-15
> **審查目標**: `dev/specs/2026-03-15_1_key-rotation/s1_dev_spec.md` + `s1_api_spec.md`
> **Codebase 驗證**: 已讀取所有引用實體的原始碼

---

## Findings

### [SR-P1-001]

- **ID**: SR-P1-001
- **Severity**: P1
- **Category**: 邏輯錯誤 / Codebase 一致性
- **File**: `s1_dev_spec.md` § 4.4 / Task #5 / § 3.1 Mermaid flowchart
- **Rule**: Codebase 一致性 — 引用的 class/method 名稱與實際簽名一致
- **Evidence**:
  - Spec 的 Data Flow（§ 4.1）與 Task #5 DoD 均顯示 `ConfigManager.write()` 由 `AuthService.rotate()` 呼叫（service 層寫 config）。
  - 但 § 3.1 flowchart 節點 `J[ConfigManager.write 更新 config]` 在 `CMD` 路徑（`I → J → K`），暗示 command 層負責寫入。
  - 實際 codebase（`auth.service.ts`）的 `register()` / `login()` 兩個方法均在 **service 層**呼叫 `ConfigManager.write()`；`whoami()` 則不寫 config。
  - Task #5 DoD：「成功後呼叫 `ConfigManager.write()` 更新 config」→ service 層。
  - Task #6 DoD：「Config 寫入失敗時仍輸出新 key 並提示 `auth login`」→ 暗示 command 層要 catch 寫入失敗。
  - 若 `ConfigManager.write()` 在 service 層，command 層無法單獨 catch config 寫入失敗；若要符合 E-R2 的 fallback 行為，架構上必須二選一：(A) service 層寫 config，失敗時 throw 特定 error，command 層根據 error type 決定顯示邏輯；或 (B) service 層只回傳 response，command 層負責寫 config 並處理失敗。當前 spec 混用兩者，造成職責不清。
- **Impact**: 實作者對「誰負責 config 寫入」判斷不一致，極可能導致 E-R2 fallback 行為（顯示新 key + 錯誤訊息）無法正確實作。
- **Fix**: 明確指定架構選項。建議沿用現有模式（service 層寫 config，如 `register`/`login`），並補充 Task #5 DoD：「`ConfigManager.write()` 失敗時 throw 含 `newKey` 的 custom error（e.g., `ConfigWriteError`）」；Task #6 DoD：「catch `ConfigWriteError` 時仍輸出 `error.newKey` + 提示 `auth login`」。

---

### [SR-P1-002]

- **ID**: SR-P1-002
- **Severity**: P1
- **Category**: 邏輯錯誤 / Codebase 一致性
- **File**: `s1_dev_spec.md` Task #7 DoD
- **Rule**: Codebase 一致性 — 引用的 method 與 codebase 實際 pattern 一致
- **Evidence**:
  - Task #7 DoD：「透過 `req.query?.hash` 取得 hash 參數（沿用現有 `:hash` 路由模式）」
  - 實際 codebase `keys.mock.ts`（第 104 行）：`const hash = req.query?.hash;`，確實使用 `req.query.hash`。
  - 但 Task #7 同時說「沿用現有 `:hash` 路由模式」，路由註冊為 `router.register('POST', '/keys/:hash/rotate', ...)`。
  - **問題在於**：現有路由 `GET /keys/:hash`、`PATCH /keys/:hash`、`DELETE /keys/:hash` 都已透過 `req.query?.hash` 取 hash，這是現有 mock router 的 path-param 解析慣例（router 將 `:hash` capture 到 `req.query.hash`）。
  - 但 spec 完全沒說明這個「路由 parameter 自動放到 `req.query`」的 mock router 慣例。若不了解這個隱性約定，實作者可能會嘗試用 `req.params?.hash` 或其他方式取，導致 `undefined`。
- **Impact**: 實作者對 hash 取得方式有歧義，隱性慣例未被 spec 明確說明。
- **Fix**: 在 Task #7 補充說明：「mock router 將 URL path parameter（`:hash`）解析並注入到 `req.query.hash`，詳見現有 `GET /keys/:hash` handler 的實作模式（keys.mock.ts 第 104 行）」。

---

### [SR-P1-003]

- **ID**: SR-P1-003
- **Severity**: P1
- **Category**: 缺驗證 / 需求偏差
- **File**: `s1_dev_spec.md` Task #5 DoD
- **Rule**: 完整性 — 每個任務的 DoD 覆蓋所有邊界條件
- **Evidence**:
  - Task #5 DoD：「保留現有 `api_base`、`email`、`created_at`」。
  - 實際 `ConfigManager.write()` 簽名（`manager.ts` 第 23 行）接受 `OpenClawTokenConfig`，而非 partial。`config/schema.ts` 未讀取到但可從 `register`/`login` 推斷其欄位包括 `management_key`、`api_base`、`email`、`created_at`、`last_login`。
  - Spec 的保留欄位列表遺漏了 `last_login`。若 `rotate()` 呼叫 `ConfigManager.write()` 時未帶 `last_login`，可能根據 schema 型別定義導致驗證失敗或欄位遺失。
- **Impact**: 若 `last_login` 為 schema required 欄位，`ConfigManager.write()` 會拋出 validation error，導致 config 未更新。
- **Fix**: Task #5 DoD 補充「保留現有 config 的 `last_login` 欄位，或更新為當前時間」；並在 AuthService.rotate() 實作說明中明確：先讀取現有 config（`ConfigManager.read()`），再合併更新 `management_key`，其餘欄位保留。

---

### [SR-P1-004]

- **ID**: SR-P1-004
- **Severity**: P1
- **Category**: 邏輯錯誤 / 需求偏差
- **File**: `s1_dev_spec.md` § 3.1 / `s1_api_spec.md` § 1
- **Rule**: S0 成功標準對照 — 每條可追溯到任務/AC
- **Evidence**:
  - S0 § 4.1 步驟 5：「顯示新 key（僅此一次）+ 警告」。
  - S0 成功標準 4：「`keys rotate <hash>` 後舊 key value 立即無法使用」。
  - `s1_api_spec.md` § 2 副作用：「舊 key value 立即失效」。
  - **問題**：spec 和 api_spec 均聲稱 provisioned key 的舊 key value 在 rotation 後「立即失效」，但 mock 實作方案（§ 4.4）是直接更新 `MockProvisionedKey.key` 欄位。
  - 現有 mock handler 中，没有任何地方驗證 provisioned key 的 bearer token（auth 只驗 management key）。因此「provisioned 舊 key value 立即失效」在 mock 層是隱性成立（舊 value 從 store 消失），但在真實場景下，這代表舊 provisioned key 在使用 API 時會 401。
  - 但 spec 的 KeyRotateResponse 沒有 `revoked_at` 或任何失效時間欄位，且 S0 成功標準 4 在整個 AC 表（§ 7.1）中沒有對應的測試案例直接驗證「舊 provisioned key 呼叫 API 會 401」。
  - AC-4 只驗「新 key value 回傳」，AC-5 驗設定保留，均未驗舊 provisioned key 失效的行為。
- **Impact**: S0 成功標準 4 缺乏對應的 AC，導致這個核心安全需求可能在測試覆蓋上有漏洞。雖然 mock 層行為隱性正確（覆蓋舊值），但缺乏明確測試 = 實作者可能不知道需要驗證。
- **Fix**: 在 § 7.1 新增 AC：「AC-X | provisioned key rotate 後舊 key value 失效 | 已有 provisioned key | rotate 後嘗試用舊 key value 呼叫受保護端點 | 行為與舊 value 消失一致（mock 層：store 中已無舊 value）」。同時在 Task #11 DoD 中補充對應測試。

---

### [SR-P1-005]

- **ID**: SR-P1-005
- **Severity**: P1
- **Category**: 缺驗證 / 不一致
- **File**: `s1_dev_spec.md` Task #4 DoD vs § 4.1 Data Flow
- **Rule**: 完整性 — DoD 與 Data Flow 一致
- **Evidence**:
  - § 4.1 Data Flow 序列圖：`MH->>MS: getEmailForToken(token) -> email`，然後 `MH->>MS: users.get(email) -> 更新 management_key`。
  - Task #4 DoD 中沒有提到「讀取當前 management_key（`users.get(email).management_key`）作為 `oldKey`」這個步驟，直接跳到「舊 key 加入 `store.revokedManagementKeys`」。
  - 實作者需要知道 `oldKey` 從哪裡來——必須先 `store.users.get(email).management_key` 取得當前 management key，再將其加入黑名單。
  - Task #4 DoD 目前的列表順序暗示可以直接取得 oldKey，但未明確說明取得路徑。
- **Impact**: 實作者可能從 request token 直接當 oldKey 加入黑名單（邏輯上等價，但不符合 spec 預設的 data flow），或產生 undefined 存入 Set。
- **Fix**: Task #4 DoD 補充步驟：「使用 `store.getEmailForToken(token)` 取得 email，再透過 `store.users.get(email).management_key` 取得當前的 oldKey，將 oldKey 加入 `store.revokedManagementKeys`」。

---

### [SR-P2-001]

- **ID**: SR-P2-001
- **Severity**: P2
- **Category**: 建議 / 可讀性
- **File**: `s1_dev_spec.md` § 2.3
- **Rule**: Codebase 一致性 — 引用的 pattern 名稱與現有 codebase 一致
- **Evidence**:
  - § 2.3：「指令模式: `getGlobalOptions()` -> `requireAuth()` -> `new Service({mock, verbose})` -> `withSpinner()` -> `output()`」
  - 實際 `auth.ts` 的 `whoami` 指令模式為：`getGlobalOptions()` -> `requireAuth()` -> `new AuthService({ mock, verbose })` -> `withSpinner(...)` -> `output(...)`，確認一致。
  - 但 `register` 和 `login` 指令沒有 `requireAuth()`（登入前不需要 token）。Spec 描述的 pattern 僅適用於有 auth-guard 的指令，未說明此前提。輕微誤導性，但不影響 rotate 功能（rotate 確實需要 requireAuth）。
- **Impact**: 說明不夠精確，但不影響實作正確性。
- **Fix**: § 2.3 補充「（適用於需要認證的指令）」。

---

### [SR-P2-002]

- **ID**: SR-P2-002
- **Severity**: P2
- **Category**: 建議 / 命名一致性
- **File**: `s1_dev_spec.md` Task #6 DoD
- **Rule**: Codebase 一致性 — 輸出訊息與現有 codebase 風格一致
- **Evidence**:
  - Task #6 DoD：「非 JSON 模式：`warn('This key will only be shown ONCE.')` + table 顯示新 key」
  - Task #9 DoD：「非 JSON 模式：`warn('This key will only be shown ONCE.')` + table 顯示新 key value 和 hash」
  - 實際 `keys.ts` 的 `create` 指令（第 37 行）：`warn('This key will only be shown ONCE. Save it now!');`
  - Spec 的訊息文字與現有 codebase 不一致（缺少「Save it now!」後綴）。
- **Impact**: 輕微不一致，不影響功能。
- **Fix**: 統一為 `warn('This key will only be shown ONCE. Save it now!')` 以保持 UX 一致性。

---

### [SR-P2-003]

- **ID**: SR-P2-003
- **Severity**: P2
- **Category**: 建議 / 完整性
- **File**: `s1_dev_spec.md` § 8 / Task #3
- **Rule**: 完整性 — 風險緩解措施具體可執行
- **Evidence**:
  - § 8 回歸風險：「MockStore.isValidToken() 修改後，所有依賴此方法的 mock handler（auth、keys、credits、oauth）的現有測試必須全部通過。」
  - Task #3 DoD 只有「現有測試全部通過（黑名單為空時行為完全不變）」，但沒有指定要跑哪些測試套件，也沒有說「Task #3 完成後立即跑全套測試」的動作點。
  - 雖然 § 8 風險表有說「Task #3 完成後立即跑完整測試確認」，但此動作未出現在 Task #3 的 DoD 或驗收方式中，可能被實作者忽略。
- **Impact**: 輕微流程風險，不影響設計正確性。
- **Fix**: Task #3 驗收方式補充：「`npm test` 完整套件（含 auth/keys/credits/oauth mock handler 測試）全部通過」。

---

## Summary

### Findings 統計

| Severity | 數量 | IDs |
|----------|------|-----|
| P0 | 0 | - |
| P1 | 5 | SR-P1-001, SR-P1-002, SR-P1-003, SR-P1-004, SR-P1-005 |
| P2 | 3 | SR-P2-001, SR-P2-002, SR-P2-003 |
| **總計** | **8** | |

### Codebase 實體驗證結果

| Spec 引用實體 | 驗證狀態 | 備註 |
|-------------|---------|------|
| `src/api/types.ts` | 存在 | `AuthRotateResponse`、`KeyRotateResponse` 尚未定義（預期新增） |
| `src/api/endpoints.ts` | 存在 | `AUTH_ROTATE`、`KEY_ROTATE` 尚未定義（預期新增） |
| `src/mock/store.ts` `MockStore` | 存在 | `revokedManagementKeys` 尚未定義（預期新增） |
| `MockStore.isValidToken()` | 存在（第 118 行）| 僅 regex，無黑名單（符合現狀） |
| `MockStore.reset()` | 存在（第 107 行）| 無 `revokedManagementKeys.clear()`（預期新增） |
| `MockStore.generateManagementKey()` | 存在（第 127 行）| 正確 |
| `MockStore.generateProvisionedKey()` | 存在（第 131 行）| 正確 |
| `MockStore.getEmailForToken()` | 存在（第 122 行）| 靜態回傳 `DEMO_EMAIL`，符合 tech_debt 說明 |
| `src/mock/handlers/auth.mock.ts` `registerAuthHandlers()` | 存在（第 18 行）| 正確 |
| `src/mock/handlers/keys.mock.ts` `registerKeysHandlers()` | 存在（第 22 行）| 正確 |
| `requireValidToken()` in auth.mock.ts | 存在（第 10 行）| 正確 |
| `requireValidToken()` in keys.mock.ts | 存在（第 10 行）| 正確（確認重複，符合 tech_debt 說明） |
| `MockProvisionedKey.key` 欄位 | 存在（store.ts 第 27 行）| 正確 |
| `MockProvisionedKey.revoked` 欄位 | 存在（store.ts 第 34 行）| 正確 |
| `src/services/auth.service.ts` `AuthService` | 存在 | `rotate()` 方法尚未定義（預期新增） |
| `src/services/keys.service.ts` `KeysService` | 存在 | `rotate()` 方法尚未定義；`this.getClient()` 私有方法存在（第 18 行）|
| `ConfigManager.write()` | 存在（manager.ts 第 23 行）| 接受 `OpenClawTokenConfig` 完整物件 |
| `createApiClient()` | 存在（api/client.ts）| 正確 |
| `getGlobalOptions()` | 存在（index.ts）| 正確 |
| `requireAuth()` | 存在（auth-guard.ts）| 正確 |
| `withSpinner()` | 存在（spinner.ts）| 正確 |
| `confirm()` | 存在（@inquirer/prompts，keys.ts 第 2 行已 import）| 正確 |
| `warn()` from formatter | 存在（keys.ts 第 6 行已 import）| 正確 |
| `tests/unit/mock/handlers/auth.mock.test.ts` | 存在 | 正確 |
| `tests/unit/mock/handlers/keys.mock.test.ts` | 存在 | 正確 |
| `tests/unit/services/auth.service.test.ts` | 存在 | 正確 |
| `tests/integration/auth.test.ts` | 存在 | 正確 |
| `tests/integration/keys.test.ts` | 存在 | 正確 |

### 決策

**totals: P0=0, P1=5, P2=3**

**decision: PASS_WITH_FIXES**

核心設計方向正確，分層架構清晰，Codebase 引用實體全部驗證存在。主要問題集中在：
1. ConfigManager.write() 的職責層級（service vs command）說明不一致（SR-P1-001，最高優先修正）
2. S0 成功標準 4 缺乏對應的 AC 覆蓋（SR-P1-004）
3. 若干 DoD 細節缺失（SR-P1-003 的 last_login 欄位、SR-P1-005 的 oldKey 取得路徑）

這些問題均可在 spec 層修正，不影響整體架構決策的正確性。建議修正後直接進入 S3。
