# S0 Brief Spec: Key Rotation 機制

> **建立時間**: 2026-03-15
> **工作類型**: new_feature
> **Spec Mode**: full_spec

---

## 1. 一句話描述

為 Management Key 和 Provisioned Keys 加入 rotation 機制，讓用戶能主動輪換 key 並立即失效舊 key。

## 2. 痛點

- Management Key 永久有效，洩漏後無法快速失效換新
- Provisioned Keys 只能 revoke 再重建，無法原地換新（保留 name/limit 等設定）
- `auth logout` 只清除本地 config，不失效 server-side key
- 不符合安全最佳實踐（無定期輪換能力）

## 3. 目標

- 用戶可透過 `auth rotate` 輪換 Management Key，舊 key 立即失效
- 用戶可透過 `keys rotate <hash>` 輪換 Provisioned Key，保留原有設定（name, limit, limit_reset），舊 key 立即失效
- rotation 後本地 config 自動更新（Management Key）
- rotation 失敗時狀態明確，可透過 `auth login` 恢復

## 4. 功能區拆解

### 4.0 功能區識別表

| FA ID | 名稱 | 描述 | 獨立性 |
|-------|------|------|--------|
| FA-A+ | Management Key Rotation | `auth rotate` 指令，輪換 management key | high |
| FA-C+ | Provisioned Key Rotation | `keys rotate <hash>` 指令，輪換 provisioned key 保留設定 | high |

**拆解策略**: `single_sop_fa_labeled`（兩個 FA 共享 mock/API 基礎設施）

### 4.1 FA-A+: Management Key Rotation

**指令**: `openclaw-token auth rotate [--yes] [--json]`

**流程**:
1. 檢查已認證（auth-guard）
2. 顯示確認提示（除非 `--yes`）
3. POST /auth/rotate（帶當前 management key）
4. Server 產生新 key，舊 key 立即失效
5. 更新本地 config.json（atomic write）
6. 顯示新 key（僅此一次）+ 警告

**例外流程**:

| ID | 維度 | 情境 | 處理 |
|----|------|------|------|
| E-R1 | 並行 | 兩 terminal 同時 rotate | 後者會因舊 key 已失效收到 401 |
| E-R2 | 狀態 | API 成功但 config 寫入失敗 | 顯示新 key + 錯誤訊息，提示用手動更新或 `auth login` |
| E-R3 | 邊界 | 使用 `OPENCLAW_TOKEN_KEY` 環境變數 | 顯示 warning：「New key generated. Update your OPENCLAW_TOKEN_KEY environment variable.」仍執行 rotation |
| E-R4 | 網路 | rotate 請求超時 | 顯示「Rotation status unknown. Run auth whoami to check.」 |
| E-R6 | 體驗 | rotation 失敗 | 明確顯示「Rotation failed. Your current key is still valid.」 |

### 4.2 FA-C+: Provisioned Key Rotation

**指令**: `openclaw-token keys rotate <hash> [--yes] [--json]`

**流程**:
1. 檢查已認證
2. 顯示確認提示（含 key name）
3. POST /keys/:hash/rotate（帶 management key）
4. Server 產生新 key value，保留原有 name/credit_limit/limit_reset，舊 key value 立即失效
5. 顯示新 key value（僅此一次）+ 警告

**例外流程**:

| ID | 維度 | 情境 | 處理 |
|----|------|------|------|
| E-K1 | 業務 | hash 不存在 | 404 → "Key not found" |
| E-K2 | 業務 | key 已被 revoke | 410 → "Cannot rotate a revoked key" |
| E-K3 | 業務 | key 已被 disabled | 顯示 warning 但允許 rotate（disabled 是暫停，不是永久停用） |
| E-K4 | 並行 | 同一 key 同時 rotate | 後者收到 409 Conflict |

## 5. 成功標準

1. `auth rotate` 成功產生新 Management Key 並更新 config
2. `auth rotate` 後舊 key 立即無法使用（401）
3. `keys rotate <hash>` 成功產生新 key value，保留 name/limit 設定
4. `keys rotate <hash>` 後舊 key value 立即無法使用
5. rotation 失敗時狀態明確，用戶可透過 `auth login` 恢復
6. 環境變數場景顯示 warning
7. `--json` 和 `--mock` 正常運作

## 6. Scope

### In
- `auth rotate` 指令（FA-A+）
- `keys rotate <hash>` 指令（FA-C+）
- 對應 mock handlers
- 對應 API types/endpoints
- 單元測試 + 整合測試

### Out
- Grace period（舊 key 延遲失效）
- 自動定期輪換排程
- `auth show-key` 指令
- 真實後端 API 實作

## 7. 約束

- 遵循現有分層架構（Commands → Services → API Client）
- Mock backend 行為與 API contract 一致
- 新指令風格與現有指令一致（confirmation prompt、--yes、--json、--mock）
- Management Key rotation 後本地 config 使用 atomic write 更新

## 8. 畫面清單

N/A（CLI 工具，無 UI 畫面）
