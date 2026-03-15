# S1 Dev Spec: OAuth Device Flow 社群登入

> **階段**: S1 技術分析
> **建立時間**: 2026-03-15 11:00
> **Agent**: codebase-explorer (Phase 1) + architect (Phase 2)
> **工作類型**: new_feature
> **複雜度**: M

---

## 1. 概述

### 1.1 需求參照
> 完整需求見 `s0_brief_spec.md`，以下僅摘要。

在現有 email/password 登入之外，加入 GitHub OAuth Device Flow (RFC 8628) 作為替代認證方式。用戶執行 `auth login --github` 後，CLI 顯示 user_code 與 verification_uri，輪詢 mock backend 直到授權完成，換發 management_key 儲存至本地 config。同 email 帳號自動合併。

### 1.2 技術方案摘要

新增 `OAuthService` 驅動 Device Flow 三階段（request code → poll token → fetch userinfo）。Mock backend 新增三個端點（`/oauth/device/code`、`/oauth/device/token`、`/oauth/userinfo`），由 `oauth.mock.ts` 實作，遵循 factory pattern 接收 router 注入的 store。MockStore 擴充 `oauthSessions` Map 追蹤 device_code 狀態。帳號合併邏輯在 userinfo 端點完成：同 email 回傳既有 management_key，新 email 建立新帳號。sleep 函式抽至 `src/utils/sleep.ts` 供依賴注入，確保測試可控。

---

## 2. 影響範圍（Phase 1：codebase-explorer）

### 2.1 受影響檔案

#### 修改檔案
| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `src/commands/auth.ts` | 修改 | login subcommand 加 `--github` option，觸發 OAuthService |
| `src/mock/index.ts` | 修改 | import 並呼叫 `registerOAuthHandlers(defaultRouter)` |
| `src/api/endpoints.ts` | 修改 | 新增 `OAUTH_DEVICE_CODE`、`OAUTH_DEVICE_TOKEN`、`OAUTH_USERINFO` 常數 |
| `src/api/types.ts` | 修改 | 新增 OAuth 相關 interfaces |
| `src/mock/store.ts` | 修改 | 新增 `oauthSessions` Map + `MockOAuthSession` interface，`reset()` 中清除，`MockUser.password` 改為可選 |
| `src/errors/base.ts` | 修改 | `CLIError` 新增 `code?: string` 屬性（SR-P0-003） |
| `src/errors/api.ts` | 修改 | `mapApiError()` default case 保留 errorCode 參數（SR-P0-003） |
| `src/mock/handlers/auth.mock.ts` | 修改 | login handler 新增 `password` undefined 檢查（SR-P1-003） |

#### 新增檔案
| 檔案 | 說明 |
|------|------|
| `src/services/oauth.service.ts` | OAuthService — 驅動 device flow 三階段 |
| `src/mock/handlers/oauth.mock.ts` | Mock OAuth 三端點 handler（factory pattern） |
| `src/utils/sleep.ts` | sleep 工具函式（唯一定義點） |
| `tests/unit/services/oauth.service.test.ts` | OAuthService 單元測試 |
| `tests/unit/mock/handlers/oauth.mock.test.ts` | OAuth mock handler 單元測試 |
| `tests/integration/oauth.test.ts` | OAuth 完整流程整合測試 |

### 2.2 依賴關係
- **上游依賴**: `src/mock/store.ts`（MockStore 需擴展）、`src/api/client.ts`（複用，不改）、`src/config/manager.ts`（複用，不改）
- **下游影響**: `src/mock/index.ts`（需 import 新 handler）、`tests/integration/auth.test.ts`（需確認 `--github` option 不影響既有測試）

### 2.3 現有模式與技術考量

1. **Mock handler factory pattern**: 所有 handler 以 `registerXxxHandlers(router: MockRouter)` 匯出，store 由 router 注入（P-CLI-003）
2. **Service pattern**: Service class 接收 `{ mock, verbose }` options，內部建立 ApiClient
3. **Axios LIFO interceptor**: mock adapter 在 request interceptor 中攔截，回傳 `Promise.reject({ __isMockResponse: true, ... })`，response interceptor 再轉為正常回應
4. **Config schema**: Zod schema 驗證，`management_key` + `email` + `api_base` + timestamps
5. **Management key 格式**: `sk-mgmt-{UUID v4}`，必須用 `generateManagementKey()` 產生（P-CLI-001）

---

## 3. User Flow（Phase 2：architect）

```mermaid
flowchart TD
    A[用戶執行 auth login --github]:::cli --> B{--github flag?}
    B -->|否| C[走現有 email/password 流程]:::cli
    B -->|是| D[建立 OAuthService]:::cli
    D --> E[POST /oauth/device/code]:::api
    E --> F[取得 device_code + user_code + verification_uri]:::api
    F --> G[CLI 顯示 user_code 與 verification_uri]:::cli
    G --> H[嘗試自動開啟瀏覽器]:::cli
    H --> I[開始輪詢迴圈]:::cli

    subgraph polling["輪詢迴圈"]
        I --> J[等待 interval 秒]:::cli
        J --> K[POST /oauth/device/token]:::api
        K --> L{回應狀態?}
        L -->|authorization_pending| J
        L -->|slow_down| M[interval += 5]:::cli
        M --> J
        L -->|access_token| N[取得 token]:::cli
    end

    N --> O[GET /oauth/userinfo]:::api
    O --> P{同 email 帳號存在?}:::api
    P -->|是| Q[合併帳號，回傳既有 management_key]:::api
    P -->|否| R[建立新帳號，產生 management_key]:::api
    Q --> S[CLI 儲存 management_key 到 config]:::cli
    R --> S
    S --> T[顯示登入成功]:::cli

    L -->|expired_token| U[E2: 顯示授權超時]:::err
    L -->|access_denied| V[E5: 顯示授權被拒絕]:::err
    L -->|網路錯誤| W{重試 < 3?}:::err
    W -->|是| J
    W -->|否| X[E4: 顯示網路錯誤]:::err

    classDef cli fill:#e3f2fd,color:#1565c0,stroke:#1565c0,stroke-width:2px
    classDef api fill:#e8f5e9,color:#2e7d32,stroke:#2e7d32,stroke-width:2px
    classDef err fill:#ffebee,color:#c62828,stroke:#c62828,stroke-width:2px
```

### 3.1 主要流程

| 步驟 | 用戶動作 | 系統回應 | 備註 |
|------|---------|---------|------|
| 1 | 執行 `auth login --github` | CLI 向 mock backend 請求 device code | |
| 2 | — | CLI 顯示：`Enter code XXXX-XXXX at https://github.com/login/device` | user_code 格式 `XXXX-XXXX` |
| 3 | — | CLI 嘗試 `open` 瀏覽器（失敗靜默忽略） | best effort |
| 4 | （在瀏覽器完成授權） | CLI spinner + 倒數：`Waiting for authorization... (expires in Xm Xs)` | mock 自動 3 秒授權 |
| 5 | — | CLI 輪詢取得 access_token → 呼叫 userinfo | |
| 6 | — | 帳號合併/建立 → management_key 儲存 config | |
| 7 | — | 顯示 `Logged in as {email}` 或 `Logged in as {email} (account merged)` | |

### 3.2 異常流程

| S0 ID | 情境 | 觸發條件 | 系統處理 | 用戶看到 |
|-------|------|---------|---------|---------|
| E1 | 多 terminal 同時觸發 | 同一用戶開多個 terminal 執行 `auth login --github` | 各自獨立 device_code，先完成的寫入 config，後者覆寫 | 兩邊都能正常完成，最後一個生效 |
| E2 | device code 過期 | 超過 `expires_in`（預設 900s）未完成授權 | 輪詢收到 `expired_token`，停止輪詢 | `Authorization timed out. Run 'auth login --github' again.` |
| E3 | OAuth email 為空 | GitHub 帳號未設定公開 email | userinfo 回傳 400 | `GitHub account has no public email. Set one at github.com/settings/emails` |
| E4 | 輪詢期間網路斷線 | 網路不穩 | 重試 3 次，都失敗拋出 NetworkError | `Network error. Check your connection and try again.` |
| E5 | 用戶拒絕授權 | 在 GitHub 頁面點 Deny | 輪詢收到 `access_denied`，停止輪詢 | `Authorization denied by user.` |
| E6 | Ctrl+C 中斷 | 用戶在輪詢等待時按 Ctrl+C | 清理 spinner，process.exit(0) | CLI 正常退出，無殘留 |

### 3.3 S0→S1 例外追溯表

| S0 ID | 維度 | S0 描述 | S1 處理位置 | 覆蓋狀態 |
|-------|------|---------|-----------|---------|
| E1 | 並行/競爭 | 多 terminal 同時觸發 | OAuthService — 各自獨立 device_code | ✅ 覆蓋 |
| E2 | 狀態轉換 | Device code 過期 | OAuthService.pollForToken() — `expired_token` 分支 | ✅ 覆蓋 |
| E3 | 資料邊界 | OAuth email 為空 | oauth.mock.ts userinfo handler — email 驗證 | ✅ 覆蓋 |
| E4 | 網路/外部 | 輪詢期間網路斷線 | OAuthService.pollForToken() — 重試 3 次 | ✅ 覆蓋 |
| E5 | 業務邏輯 | 用戶拒絕授權 | OAuthService.pollForToken() — `access_denied` 分支 | ✅ 覆蓋 |
| E6 | UI/體驗 | Ctrl+C 中斷 | auth.ts loginWithGitHub — AbortController / signal 監聽 | ✅ 覆蓋 |

---

## 4. Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CLI as CLI (auth.ts)
    participant OS as OAuthService
    participant AC as ApiClient (axios)
    participant MH as Mock Handler (oauth.mock)
    participant MS as MockStore
    participant CF as ConfigManager

    U->>CLI: auth login --github
    CLI->>OS: loginWithGitHub()
    OS->>AC: POST /oauth/device/code {client_id}
    AC->>MH: handleMockRequest()
    MH->>MS: oauthSessions.set(device_code, session)
    MH-->>AC: {device_code, user_code, verification_uri, interval, expires_in}
    AC-->>OS: DeviceCodeResponse
    OS-->>CLI: 顯示 user_code + verification_uri
    CLI->>CLI: 嘗試 open 瀏覽器

    loop 輪詢（每 interval 秒）
        OS->>AC: POST /oauth/device/token {device_code, grant_type}
        AC->>MH: handleMockRequest()
        MH->>MS: oauthSessions.get(device_code)

        alt 尚未授權
            MH-->>AC: 400 {error: "authorization_pending"}
            AC-->>OS: AxiosError → 繼續輪詢
        else 已授權
            MH->>MS: 標記 session.authorized = true
            MH-->>AC: 200 {access_token, token_type}
            AC-->>OS: TokenResponse
        else device code 過期（E2）
            MH-->>AC: 400 {error: "expired_token"}
            AC-->>OS: AxiosError → 拋出 DeviceCodeExpiredError
            OS-->>CLI: 顯示超時訊息
        else 用戶拒絕（E5）
            MH-->>AC: 400 {error: "access_denied"}
            AC-->>OS: AxiosError → 拋出 AccessDeniedError
            OS-->>CLI: 顯示拒絕訊息
        end
    end

    OS->>AC: GET /oauth/userinfo (Bearer access_token)
    AC->>MH: handleMockRequest()

    alt 同 email 帳號存在
        MH->>MS: users.get(email) → 既有用戶
        MH->>MS: 更新 oauth_provider
        MH-->>AC: {management_key, email, merged: true}
    else 新 email
        MH->>MS: generateManagementKey()
        MH->>MS: users.set(email, newUser)
        MH->>MS: 初始化 credits/keys/autoTopup
        MH-->>AC: {management_key, email, merged: false}
    else email 為空（E3）
        MH-->>AC: 400 {error: "EMAIL_REQUIRED"}
        AC-->>OS: AxiosError
        OS-->>CLI: 顯示 email 缺失訊息
    end

    AC-->>OS: UserInfoResponse
    OS->>CF: ConfigManager.write({management_key, api_base: DEFAULT_API_BASE, email, created_at: now(), last_login: now()})
    OS-->>CLI: {email, management_key, merged}
    CLI-->>U: 顯示「登入成功」
```

### 4.1 API 契約

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/oauth/device/code` | 請求 device code + user code |
| `POST` | `/oauth/device/token` | 輪詢授權狀態，取得 access_token |
| `GET` | `/oauth/userinfo` | 用 access_token 取 user info + 帳號合併/建立 |

#### 4.1.1 POST /oauth/device/code

**Request**
```json
{
  "client_id": "openclaw-cli"
}
```

**Response 200**
```json
{
  "data": {
    "device_code": "dc_xxxxxxxxxxxxxxxx",
    "user_code": "ABCD-EFGH",
    "verification_uri": "https://github.com/login/device",
    "interval": 5,
    "expires_in": 900
  }
}
```

**Mock 行為**: 產生隨機 device_code（`dc_` + 16 hex）、user_code（`XXXX-XXXX` 隨機大寫字母）。在 MockStore.oauthSessions 中建立 session，auto_authorize_at 設為 now + 3 秒。

#### 4.1.2 POST /oauth/device/token

**Request**
```json
{
  "device_code": "dc_xxxxxxxxxxxxxxxx",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}
```

**Response 200（授權完成）**
```json
{
  "data": {
    "access_token": "gho_xxxxxxxxxxxxxxxxxxxx",
    "token_type": "bearer"
  }
}
```

**Response 400（等待中）**
```json
{
  "error": {
    "code": "authorization_pending",
    "message": "The authorization request is still pending."
  }
}
```

**Response 400（其他錯誤）**
| error.code | 意義 | HTTP status |
|------------|------|-------------|
| `authorization_pending` | 用戶尚未授權 | 400 |
| `slow_down` | 輪詢太頻繁 | 400 |
| `expired_token` | device code 已過期 | 400 |
| `access_denied` | 用戶拒絕授權 | 400 |
| `bad_device_code` | device code 無效 | 400 |

**Mock 行為**: 查 oauthSessions，若 `Date.now() >= auto_authorize_at` 則標記為已授權並回傳 access_token；否則回 `authorization_pending`。access_token 格式 `gho_` + 20 hex。

#### 4.1.3 GET /oauth/userinfo

**Request**
```
Authorization: Bearer gho_xxxxxxxxxxxxxxxxxxxx
```

**Response 200**
```json
{
  "data": {
    "management_key": "sk-mgmt-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345",
    "merged": false
  }
}
```

**Response 400（email 缺失）**
```json
{
  "error": {
    "code": "EMAIL_REQUIRED",
    "message": "GitHub account has no public email"
  }
}
```

**Response 401（token 無效）**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing access token"
  }
}
```

**Mock 行為**: 驗證 Bearer token 在 oauthSessions 中存在且已授權。取 session 中預設的 mock email（`github-user@example.com`）。查 MockStore.users：若同 email 存在 → 更新 `oauth_provider: "github"` → 回傳既有 management_key + `merged: true`；否則建立新用戶（含 credits/keys/autoTopup 初始化） → 回傳新 management_key + `merged: false`。

### 4.2 資料模型

#### MockOAuthSession（新增於 store.ts）
```typescript
export interface MockOAuthSession {
  device_code: string;
  user_code: string;
  client_id: string;
  access_token: string | null;
  authorized: boolean;
  auto_authorize_at: number;  // Date.now() + 3000 (mock 用)
  expires_at: number;         // Date.now() + 900000
  email: string;              // mock 預設 github-user@example.com
  created_at: string;
}
```

#### MockUser 擴充
```typescript
export interface MockUser {
  // ... 既有欄位不變
  password?: string;        // 改為可選 — OAuth 用戶無 password（SR-P1-003）
  oauth_provider?: string;  // 新增，可選。值為 "github" 或 undefined
}
```

> **注意**：`password` 從必填改為可選。既有 auth.mock.ts 的 register/login handler 不受影響（仍正常寫入 password）。OAuth 新帳號建立時不設 password，表示無法透過 email/password 方式登入純 OAuth 帳號。auth.mock.ts 的 login handler 需加判斷：若 user.password 為 undefined 則拒絕 password 登入。

#### 新增 API types（types.ts）
```typescript
export interface OAuthDeviceCodeRequest {
  client_id: string;
}

export interface OAuthDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

export interface OAuthDeviceTokenRequest {
  device_code: string;
  grant_type: string;
}

export interface OAuthDeviceTokenResponse {
  access_token: string;
  token_type: string;
}

export interface OAuthUserInfoResponse {
  management_key: string;
  email: string;
  name: string;
  avatar_url: string;
  merged: boolean;
}
```

---

## 5. 技術決策

### TD-1: OAuth 端點路徑命名

- **背景**: RFC 8628 未規範端點路徑，GitHub 真實路徑為 `/login/device/code` 等，但我們是 mock
- **選項 A**: 模擬 GitHub 真實路徑 `/login/device/code`
- **選項 B**: 使用自訂路徑 `/oauth/device/code`、`/oauth/device/token`、`/oauth/userinfo`
- **決定**: **B** — 自訂路徑
- **理由**: mock 不等於模擬 GitHub API，自訂路徑語義更清楚，未來若支援其他 provider 不會路徑衝突

### TD-2: MockStore 帳號合併策略

- **背景**: MockStore 的 `getEmailForToken()` 是靜態映射到 demo 帳號，OAuth 帳號合併需要根據 email 查詢
- **選項 A**: 改寫 `getEmailForToken()` 支援動態查詢
- **選項 B**: 帳號合併邏輯放在 userinfo handler 中，直接操作 `store.users` Map
- **決定**: **B** — 合併邏輯在 handler 中
- **理由**: 最小變更原則。`getEmailForToken()` 的 stateless demo 策略是刻意設計，改動會影響所有既有功能。userinfo handler 可以直接用 `store.users.get(email)` 查詢

### TD-3: 瀏覽器開啟方式

- **背景**: Device Flow 需要開啟瀏覽器讓用戶輸入 user_code
- **選項 A**: 安裝 `open` npm 套件
- **選項 B**: 用 `child_process.exec` + 平台偵測（macOS: `open`, Linux: `xdg-open`, Windows: `start`）
- **決定**: **B** — child_process + 平台偵測
- **理由**: MVP 不需額外依賴，且失敗時靜默忽略，不是核心功能。三行 switch-case 就夠了

### TD-4: 合併後 password login 有效性

- **背景**: 同 email 帳號合併後，該帳號原本的 password 是否仍可用？
- **決定**: **有效** — mock 不修改 password 欄位
- **理由**: 合併是「加入 oauth_provider」，不是取代原本的認證方式。password 欄位不動

### TD-5: oauthSessions 生命週期

- **背景**: MockStore.reset() 是否需要清除 oauthSessions？
- **決定**: **是** — `reset()` 中呼叫 `this.oauthSessions.clear()`
- **理由**: 測試隔離需求。每個 test case 的 `beforeEach` 都會呼叫 `mockStore.reset()`，oauthSessions 必須跟著清

### TD-6: sleep 函式的位置與注入

- **背景**: 輪詢迴圈需要 sleep/delay，測試中需要 mock 掉以加速（P-CLI-004）
- **選項 A**: OAuthService 內部定義 sleep
- **選項 B**: 定義在 `src/utils/sleep.ts`，OAuthService 建構子接受可注入的 `sleepFn`
- **決定**: **B** — utils/sleep.ts + 依賴注入
- **理由**: 避免工具函式重複定義（P-CLI-004），測試可注入 `() => Promise.resolve()` 即時返回

---

## 6. 任務清單

### 6.1 任務總覽

| # | 任務 | FA | 類型 | 複雜度 | 波次 | Agent | 依賴 |
|---|------|----|------|--------|------|-------|------|
| 1 | 基礎設施：types + endpoints + sleep | — | 基礎 | S | W1 | backend-expert | — |
| 1b | 錯誤處理擴充：CLIError.code + mapApiError 修正 | — | 基礎 | S | W1 | backend-expert | — |
| 2 | MockStore 擴充 oauthSessions + MockUser.password 可選 | FA-B | 資料層 | S | W1 | backend-expert | — |
| 3 | OAuth mock handlers + auth.mock login password 檢查 | FA-B | Mock | M | W2 | backend-expert | #1, #1b, #2 |
| 4 | 註冊 OAuth handlers 到 router | FA-B | Mock | S | W2 | backend-expert | #3 |
| 5 | OAuthService 實作 | FA-A | 服務層 | L | W3 | backend-expert | #1, #1b |
| 6 | auth.ts 命令層整合 | FA-A | CLI | M | W3 | backend-expert | #5 |
| 7 | OAuth mock handler 單元測試 | FA-B | 測試 | M | W4 | backend-expert | #3 |
| 8 | OAuthService 單元測試 | FA-A | 測試 | M | W4 | backend-expert | #5 |
| 9 | OAuth 整合測試 | 全域 | 測試 | M | W4 | backend-expert | #4, #6 |
| 10 | 既有測試回歸驗證 | 全域 | 測試 | S | W4 | backend-expert | #4, #6 |

### 6.2 任務詳情

#### Task #1: 基礎設施 — types + endpoints + sleep
- **類型**: 基礎
- **複雜度**: S
- **Agent**: backend-expert
- **波次**: W1
- **描述**:
  1. 在 `src/api/types.ts` 新增 `OAuthDeviceCodeRequest`、`OAuthDeviceCodeResponse`、`OAuthDeviceTokenRequest`、`OAuthDeviceTokenResponse`、`OAuthUserInfoResponse` interfaces
  2. 在 `src/api/endpoints.ts` 新增 `OAUTH_DEVICE_CODE: '/oauth/device/code'`、`OAUTH_DEVICE_TOKEN: '/oauth/device/token'`、`OAUTH_USERINFO: '/oauth/userinfo'`
  3. 新增 `src/utils/sleep.ts`，匯出 `sleep(ms: number): Promise<void>` 及 `SleepFn` type
- **DoD**:
  - [ ] `types.ts` 新增 5 個 OAuth interfaces，TypeScript 編譯通過
  - [ ] `endpoints.ts` 新增 3 個 OAuth 端點常數
  - [ ] `src/utils/sleep.ts` 存在，匯出 `sleep` 函式與 `SleepFn` type
  - [ ] 既有 types/endpoints 不受影響（型別檢查通過）

#### Task #1b: 錯誤處理擴充 — CLIError.code + mapApiError 修正（SR-P0-003）
- **類型**: 基礎
- **複雜度**: S
- **Agent**: backend-expert
- **波次**: W1
- **描述**:
  1. 在 `src/errors/base.ts` 的 `CLIError` class 新增 `code?: string` 屬性，constructor 接受可選的 `code` 參數
  2. 在 `src/errors/api.ts` 的 `mapApiError()` 函式 default case 中保留 `errorCode` 參數：`return new CLIError(message ?? 'Unknown error', 1, errorCode)`
  3. 確保既有 CLIError 使用處不受影響（code 為可選）
- **DoD**:
  - [ ] `CLIError` 有 `code?: string` 屬性
  - [ ] `mapApiError()` default case 將 errorCode 傳入 CLIError
  - [ ] 既有測試通過（CLIError 的 code 為可選，不影響現有用法）
  - [ ] OAuthService 可透過 `catch (e) { if (e instanceof CLIError && e.code === 'authorization_pending') }` 區分錯誤

#### Task #2: MockStore 擴充 oauthSessions + MockUser.password 可選
- **類型**: 資料層
- **複雜度**: S
- **Agent**: backend-expert
- **波次**: W1
- **描述**:
  1. 在 `src/mock/store.ts` 新增 `MockOAuthSession` interface
  2. 在 `MockStore` class 新增 `oauthSessions = new Map<string, MockOAuthSession>()`
  3. 在 `reset()` 中加入 `this.oauthSessions.clear()`
  4. 在 `MockStoreState` interface 加入 `oauthSessions?: Map<string, MockOAuthSession>`
  5. 在 `MockUser` interface 加入 `oauth_provider?: string`
  6. 新增 helper methods: `generateDeviceCode(): string`（`dc_` + 16 hex）、`generateUserCode(): string`（`XXXX-XXXX` 隨機大寫字母）、`generateAccessToken(): string`（`gho_` + 20 hex）
- **DoD**:
  - [ ] `MockOAuthSession` interface 定義完整
  - [ ] `MockStore.oauthSessions` 初始化為空 Map
  - [ ] `reset()` 清除 `oauthSessions`
  - [ ] `MockUser.oauth_provider` 為可選 string
  - [ ] 三個 generate helper methods 產出正確格式
  - [ ] 既有 `MockStore` 測試通過

#### Task #3: OAuth mock handlers
- **類型**: Mock
- **複雜度**: M
- **Agent**: backend-expert
- **波次**: W2
- **依賴**: #1, #2
- **描述**:
  新增 `src/mock/handlers/oauth.mock.ts`，匯出 `registerOAuthHandlers(router: MockRouter): void`，實作三個端點：
  1. **POST /oauth/device/code**: 驗證 `client_id`，產生 device_code + user_code，建立 `MockOAuthSession`（`auto_authorize_at = Date.now() + 3000`），回傳 RFC 8628 格式
  2. **POST /oauth/device/token**: 查 oauthSessions，檢查 device_code 有效性/過期/授權狀態。若 `Date.now() >= auto_authorize_at` 且尚未授權 → 標記授權 + 產生 access_token → 回傳 token。否則回 `authorization_pending`
  3. **GET /oauth/userinfo**: 驗證 Bearer token 在 oauthSessions 中且已授權。取 session email。查 `store.users`：同 email → 更新 `oauth_provider` + 回傳既有 key（merged: true）；新 email → 建立完整用戶（credits/keys/autoTopup 初始化）+ 回傳新 key（merged: false）。email 為空 → 400 EMAIL_REQUIRED
- **DoD**:
  - [ ] `registerOAuthHandlers` 匯出，接收 MockRouter
  - [ ] POST /oauth/device/code 回傳正確結構
  - [ ] POST /oauth/device/token 支援 authorization_pending → access_token 轉換
  - [ ] POST /oauth/device/token 處理 expired_token、bad_device_code
  - [ ] GET /oauth/userinfo 支援帳號合併（同 email）
  - [ ] GET /oauth/userinfo 支援新帳號建立
  - [ ] GET /oauth/userinfo 處理 email 為空、token 無效
  - [ ] management_key 使用 `store.generateManagementKey()` 產生（P-CLI-001）

#### Task #4: 註冊 OAuth handlers 到 router
- **類型**: Mock
- **複雜度**: S
- **Agent**: backend-expert
- **波次**: W2
- **依賴**: #3
- **描述**: 在 `src/mock/index.ts` 中 import `registerOAuthHandlers` 並呼叫 `registerOAuthHandlers(defaultRouter)`
- **DoD**:
  - [ ] `mock/index.ts` import 並呼叫 `registerOAuthHandlers`
  - [ ] 既有 handler 註冊不受影響
  - [ ] 啟動 mock 模式可正常 dispatch 到 OAuth 端點

#### Task #5: OAuthService 實作
- **類型**: 服務層
- **複雜度**: L
- **Agent**: backend-expert
- **波次**: W3
- **依賴**: #1
- **描述**:
  新增 `src/services/oauth.service.ts`，實作 `OAuthService` class：
  1. **constructor**: 接收 `{ mock, verbose, sleepFn? }` options
  2. **requestDeviceCode()**: POST /oauth/device/code → 回傳 `OAuthDeviceCodeResponse`
  3. **pollForToken(deviceCode, interval, expiresIn)**: 輪詢迴圈，處理 `authorization_pending`（繼續）、`slow_down`（interval += 5）、`expired_token`（拋錯）、`access_denied`（拋錯）、網路錯誤（重試 3 次）。使用注入的 `sleepFn` 或預設 `sleep`
  4. **fetchUserInfo(accessToken)**: GET /oauth/userinfo → 回傳 `OAuthUserInfoResponse`
  5. **loginWithGitHub()**: 整合上述三步 + 儲存 config + 回傳結果。包含：
     - 開啟瀏覽器邏輯（`child_process.exec` + 平台偵測，失敗靜默）
     - spinner + 倒數文字更新
     - Ctrl+C signal 監聽（清理 spinner）

  **關鍵設計**:
  - `pollForToken` 接收 `AbortSignal` 參數，支援 Ctrl+C 中斷
  - OAuth 端點呼叫不帶 `token` option（不走 auth interceptor），避免 P-CLI-002
  - 錯誤處理：`CLIError` 已擴充 `code?: string` 屬性（見 SR-P0-003 修正），pollForToken() catch CLIError 後用 `error.code` 區分 `authorization_pending` / `slow_down` / `expired_token` / `access_denied`
  - Config 寫入：必須帶齊 configSchema 的 5 個必填欄位（見 SR-P0-001 修正）：
    ```typescript
    ConfigManager.write({
      management_key: userInfo.management_key,
      api_base: DEFAULT_API_BASE,  // import from config/paths
      email: userInfo.email,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    })
    ```
- **DoD**:
  - [ ] `OAuthService` class 匯出
  - [ ] `requestDeviceCode()` 正確呼叫 API
  - [ ] `pollForToken()` 處理 5 種回應狀態（透過 `CLIError.code` 區分）
  - [ ] `pollForToken()` 支援 sleepFn 注入
  - [ ] `pollForToken()` 網路錯誤重試 3 次
  - [ ] `fetchUserInfo()` 正確呼叫 API
  - [ ] `loginWithGitHub()` 整合完整流程
  - [ ] Config 寫入帶齊 5 個必填欄位（management_key, api_base, email, created_at, last_login）
  - [ ] Ctrl+C 清理 spinner

#### Task #6: auth.ts 命令層整合
- **類型**: CLI
- **複雜度**: M
- **Agent**: backend-expert
- **波次**: W3
- **依賴**: #5
- **描述**:
  修改 `src/commands/auth.ts`：
  1. login subcommand 加 `.option('--github', 'Login with GitHub (OAuth Device Flow)')`
  2. action 內讀 `opts.github`：
     - 有 `--github` → 建立 `OAuthService`，呼叫 `loginWithGitHub()`
     - 無 `--github` → 走現有 email/password 流程（不改）
  3. `--json` 支援：OAuth 結果也 output JSON
  4. import OAuthService
- **DoD**:
  - [ ] `auth login --github` 觸發 OAuth flow
  - [ ] `auth login`（無 flag）行為不變
  - [ ] `--json` 搭配 `--github` 輸出 valid JSON
  - [ ] TypeScript 編譯通過

#### Task #7: OAuth mock handler 單元測試
- **類型**: 測試
- **複雜度**: M
- **Agent**: backend-expert
- **波次**: W4
- **依賴**: #3
- **描述**:
  新增 `tests/unit/mock/handlers/oauth.mock.test.ts`：
  1. POST /oauth/device/code — 成功回傳 device_code + user_code
  2. POST /oauth/device/code — 無 client_id 回 400
  3. POST /oauth/device/token — authorization_pending（3 秒前）
  4. POST /oauth/device/token — access_token（3 秒後，需 fake timer）
  5. POST /oauth/device/token — expired_token
  6. POST /oauth/device/token — bad_device_code
  7. GET /oauth/userinfo — 新用戶建立
  8. GET /oauth/userinfo — 既有用戶合併
  9. GET /oauth/userinfo — email 為空 → 400
  10. GET /oauth/userinfo — token 無效 → 401
- **DoD**:
  - [ ] 10 個 test case 全部通過
  - [ ] 使用獨立 MockRouter + MockStore（P-CLI-003）
  - [ ] 每個 test case 的 MockStore 隔離

#### Task #8: OAuthService 單元測試
- **類型**: 測試
- **複雜度**: M
- **Agent**: backend-expert
- **波次**: W4
- **依賴**: #5
- **描述**:
  新增 `tests/unit/services/oauth.service.test.ts`：
  1. requestDeviceCode() — 成功
  2. pollForToken() — authorization_pending → access_token（sleepFn mock）
  3. pollForToken() — slow_down 增加 interval
  4. pollForToken() — expired_token 拋錯
  5. pollForToken() — access_denied 拋錯
  6. pollForToken() — 網路錯誤重試 3 次
  7. fetchUserInfo() — 成功
  8. fetchUserInfo() — email 為空
- **DoD**:
  - [ ] 8 個 test case 全部通過
  - [ ] sleepFn 注入為 `() => Promise.resolve()`，測試不需等待
  - [ ] mock 模式測試，不依賴外部服務

#### Task #9: OAuth 整合測試
- **類型**: 測試
- **複雜度**: M
- **Agent**: backend-expert
- **波次**: W4
- **依賴**: #4, #6
- **描述**:
  新增 `tests/integration/oauth.test.ts`：
  1. GitHub 登入完整流程（新用戶）：loginWithGitHub() → config 寫入 → management_key 格式正確
  2. GitHub 登入帳號合併：先 register email/password → loginWithGitHub 同 email → 回傳既有 key + merged: true
  3. GitHub 登入後 whoami 正常
  4. `--json` 輸出 valid JSON
  5. 合併後 password login 仍有效
- **DoD**:
  - [ ] 5 個整合測試通過
  - [ ] 使用 temp config dir 隔離
  - [ ] sleepFn 注入加速測試
  - [ ] mockStore.reset() 每個 test case

#### Task #10: 既有測試回歸驗證
- **類型**: 測試
- **複雜度**: S
- **Agent**: backend-expert
- **波次**: W4
- **依賴**: #4, #6
- **描述**:
  執行全部既有測試，確認無回歸：
  1. `npm test` 全量執行
  2. 特別關注 `tests/integration/auth.test.ts`（login 不帶 --github 行為不變）
  3. 特別關注 `tests/unit/mock/handlers/auth.mock.test.ts`（mock router 不受 OAuth handler 影響）
- **DoD**:
  - [ ] 全量測試通過，零失敗
  - [ ] 無新增 warning

---

## 7. 驗收標準

### 7.1 功能驗收

| AC# | S0# | 場景 | Given | When | Then | 優先級 |
|-----|-----|------|-------|------|------|--------|
| AC-1 | 1 | GitHub 登入觸發 device flow | CLI 已安裝，mock 模式 | 執行 `auth login --github --mock` | 顯示 user_code（格式 `XXXX-XXXX`）和 verification_uri（`https://github.com/login/device`） | P0 |
| AC-2 | 2 | 登入成功儲存 management_key | mock 模式，device flow 完成 | 輪詢取得 access_token 並完成 userinfo | config 檔案包含 `management_key`（格式 `sk-mgmt-{UUID}`）和 `email` | P0 |
| AC-3 | 3 | whoami 顯示 GitHub email | GitHub 登入成功後 | 執行 `auth whoami --mock` | 顯示登入時的 email | P0 |
| AC-4 | 4 | 自動開啟瀏覽器 | mock 模式 | device code 取得後 | 嘗試呼叫平台 open 命令（測試中 mock 掉），失敗不阻塞流程 | P1 |
| AC-5 | 5 | 輪詢期間 spinner + 倒數 | mock 模式，輪詢中 | CLI 等待授權 | stderr 顯示 spinner 和倒數提示文字 | P1 |
| AC-6 | 6 | device code 過期提示 | mock 模式 | device code 過期後輪詢 | 顯示 `Authorization timed out` 友善提示，提示重新執行 | P0 |
| AC-7 | 7 | 用戶拒絕授權提示 | mock 模式 | mock 回傳 `access_denied` | 顯示 `Authorization denied by user` 友善提示 | P0 |
| AC-8 | 8 | Ctrl+C 正常退出 | 輪詢等待中 | 用戶按 Ctrl+C | spinner 清理，process 正常退出（exit code 0），無殘留 | P1 |
| AC-9 | 9 | device/code 端點回傳完整結構 | mock 模式 | POST /oauth/device/code | 回傳 device_code, user_code, verification_uri, interval, expires_in | P0 |
| AC-10 | 10 | device/token 狀態轉換 | mock 模式，device code 已建立 | 輪詢 POST /oauth/device/token | 先回 authorization_pending，3 秒後回 access_token | P0 |
| AC-11 | 11 | userinfo 端點回傳用戶資訊 | mock 模式，有效 access_token | GET /oauth/userinfo | 回傳 email, name, avatar_url, management_key | P0 |
| AC-12 | 12 | 同 email 帳號合併 | MockStore 中已有 `user@test.com` 帳號 | OAuth 登入使用相同 email | 回傳既有 management_key，merged: true，不產生新帳號 | P0 |
| AC-13 | 13 | 新 email 建立新帳號 | MockStore 中無對應 email | OAuth 登入 | 建立新用戶（含 credits/keys/autoTopup 初始化），回傳新 management_key | P0 |
| AC-14 | 14 | 現有 auth login 不受影響 | 既有 email/password 測試 | 執行 `auth login`（無 --github） | 仍走 email/password 流程，所有既有測試通過 | P0 |
| AC-15 | 15 | --json flag 輸出 valid JSON | mock 模式 | `auth login --github --mock --json` | stdout 為 valid JSON，包含 management_key 和 email | P0 |
| AC-16 | 16 | --mock flag 正常運作 | — | `auth login --github --mock` | 使用 mock backend 完成完整 device flow | P0 |

### 7.2 非功能驗收

| 項目 | 標準 |
|------|------|
| 測試穩定性 | OAuth 相關測試不依賴真實計時器，sleepFn 注入確保毫秒級完成 |
| 測試隔離 | 每個 test case 的 MockStore 和 config dir 完全隔離 |
| 型別安全 | 零 `any` type cast（測試中的 `as any` 除外） |
| 向後相容 | 不帶 `--github` 的 `auth login` 行為完全不變 |

### 7.3 測試計畫

- **單元測試**: OAuth mock handlers (10 cases) + OAuthService (8 cases)
- **整合測試**: OAuth 完整流程 (5 cases)
- **回歸測試**: 全量既有測試（約 30+ cases）

---

## 8. 風險與緩解

| # | 風險 | 影響 | 機率 | 緩解措施 | 對應 Pitfall |
|---|------|------|------|---------|-------------|
| R1 | MockStore stateless 策略與帳號合併衝突 | 高 | 中 | 合併邏輯在 userinfo handler 中直接操作 `store.users` Map，不改 `getEmailForToken()`（TD-2） | — |
| R2 | 輪詢測試穩定性 | 高 | 高 | sleep 依賴注入，測試 mock 為即時返回（TD-6） | P-CLI-004 |
| R3 | Axios LIFO interceptor | 中 | 低 | OAuth 呼叫不帶 token，不觸發 auth interceptor | P-CLI-002 |
| R4 | management_key 格式不符 | 高 | 低 | 統一使用 `store.generateManagementKey()` | P-CLI-001 |
| R5 | mock handler 未用 factory pattern | 中 | 低 | 嚴格遵循 `registerXxxHandlers(router)` 模式 | P-CLI-003 |
| R6 | sleep 函式重複定義 | 低 | 中 | 唯一定義在 `src/utils/sleep.ts` | P-CLI-004 |
| R7 | 瀏覽器開啟跨平台 | 低 | 中 | child_process + 平台偵測，失敗靜默忽略（TD-3） | — |

---

## 9. 回歸風險

### 9.1 風險項目

| # | 風險描述 | 受影響測試 | 緩解方式 |
|---|---------|-----------|---------|
| RR-1 | `auth login` 加 `--github` option 後，不帶 flag 的行為改變 | `tests/integration/auth.test.ts` | option 是 boolean flag，Commander.js 不帶時為 `undefined`，action 內 if 判斷分流 |
| RR-2 | `mock/index.ts` 新增 `registerOAuthHandlers` 影響路由匹配順序 | 所有 mock handler 測試 | MockRouter 是順序匹配，新增不影響既有（路徑不重疊） |
| RR-3 | `MockStore.reset()` 改動影響既有測試 | `tests/unit/mock/store.test.ts` | 僅新增 `oauthSessions.clear()`，既有 clear 呼叫不受影響 |
| RR-4 | `types.ts` 新增 interface 造成命名衝突 | 編譯時期 | 所有新 interface 以 `OAuth` 前綴，不會與既有衝突 |

### 9.2 驗證計畫

1. Task #10 執行全量 `npm test`
2. 特別用 `--grep` 跑 `auth.test.ts` 確認不帶 `--github` 的 login 不受影響
3. TypeScript 編譯零錯誤

---

## SDD Context

```json
{
  "stages": {
    "s1": {
      "status": "completed",
      "agents": ["codebase-explorer", "architect"],
      "completed_at": "2026-03-15T11:00:00+08:00",
      "output": {
        "completed_phases": [1, 2],
        "dev_spec_path": "dev/specs/2026-03-15_1_oauth-device-flow/s1_dev_spec.md",
        "solution_summary": "新增 OAuthService + 3 個 mock OAuth 端點，走 Device Flow 換發 management_key，支援帳號合併",
        "tasks": [
          {"id": 1, "name": "基礎設施：types + endpoints + sleep", "complexity": "S", "wave": "W1"},
          {"id": 2, "name": "MockStore 擴充 oauthSessions", "complexity": "S", "wave": "W1"},
          {"id": 3, "name": "OAuth mock handlers", "complexity": "M", "wave": "W2"},
          {"id": 4, "name": "註冊 OAuth handlers 到 router", "complexity": "S", "wave": "W2"},
          {"id": 5, "name": "OAuthService 實作", "complexity": "L", "wave": "W3"},
          {"id": 6, "name": "auth.ts 命令層整合", "complexity": "M", "wave": "W3"},
          {"id": 7, "name": "OAuth mock handler 單元測試", "complexity": "M", "wave": "W4"},
          {"id": 8, "name": "OAuthService 單元測試", "complexity": "M", "wave": "W4"},
          {"id": 9, "name": "OAuth 整合測試", "complexity": "M", "wave": "W4"},
          {"id": 10, "name": "既有測試回歸驗證", "complexity": "S", "wave": "W4"}
        ],
        "acceptance_criteria": [
          "AC-1: auth login --github 顯示 user_code + verification_uri",
          "AC-2: 登入成功儲存 management_key",
          "AC-3: whoami 顯示 GitHub email",
          "AC-4: 自動開啟瀏覽器（best effort）",
          "AC-5: spinner + 倒數",
          "AC-6: device code 過期提示",
          "AC-7: 用戶拒絕授權提示",
          "AC-8: Ctrl+C 正常退出",
          "AC-9: device/code 回傳完整結構",
          "AC-10: device/token 狀態轉換",
          "AC-11: userinfo 回傳用戶資訊",
          "AC-12: 同 email 帳號合併",
          "AC-13: 新 email 建立新帳號",
          "AC-14: 現有 auth login 不受影響",
          "AC-15: --json 輸出 valid JSON",
          "AC-16: --mock 正常運作"
        ],
        "assumptions": [
          "Mock 模式下 device code 建立 3 秒後自動授權",
          "不安裝額外 npm dependency（open 套件）",
          "合併後 password login 仍有效"
        ],
        "tech_debt": [
          "MockStore.getEmailForToken() 的 stateless demo 策略與 OAuth 帳號合併在語義上衝突，mock OAuth flow 使用獨立的 email 查詢邏輯",
          "輪詢 sleep 函式若未來有其他 polling 需求，需統一使用 src/utils/sleep.ts"
        ],
        "regression_risks": [
          "auth login 加 --github option 不影響不帶 flag 的行為",
          "mock/index.ts 新增 handler 不影響路由匹配順序",
          "MockStore.reset() 新增 oauthSessions.clear() 不影響既有測試"
        ]
      }
    }
  }
}
```
