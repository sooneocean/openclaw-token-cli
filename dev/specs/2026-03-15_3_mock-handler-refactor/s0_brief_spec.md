# S0 Brief Spec — Mock Handler 重構

**SOP ID**: SOP-5
**版本**: v0.2.0
**work_type**: refactor
**建立日期**: 2026-03-15

---

## 1. 一句話描述

消除 mock handler 中的重複程式碼，並將 MockStore 的 token→email 靜態映射重構為真實映射。

## 2. 痛點

- `extractToken()` 和 `requireValidToken()` 在 auth.mock.ts、credits.mock.ts、keys.mock.ts 三個檔案中完全重複（各 13 行）
- `oauth.mock.ts` 有功能相同但命名不同的 `extractBearerToken()`
- `MockStore.getEmailForToken()` 靜態映射所有 token 到 `demo@openclaw.dev`，無法模擬多用戶場景
- 已知 Pitfall P-CLI-004：工具函式跨模組重複定義

## 3. 目標

提供乾淨的 mock 基礎設施，消除重複、支援多用戶 token 映射，為後續 contract testing（SOP-6）掃除障礙。

## 4. 功能區拆解

### §4.0 FA 識別表

| FA ID | 名稱 | 描述 | 獨立性 |
|-------|------|------|--------|
| FA-U | Mock Utils 抽取 | 抽取 extractToken + requireValidToken 到共用模組 | high |
| FA-S | MockStore Token 映射 | getEmailForToken 改為真實 tokenEmailMap 查找 | high |
| FA-H | Handler 更新 | 4 個 handler 更新 import + 映射維護 | medium |
| FA-T | 測試修復 | 更新受影響的測試以匹配新行為 | low |

**拆解策略**: `single_sop_fa_labeled`（4 FA / 中~高獨立性，但共用一個 spec）

### §4.1 跨 FA 依賴

```
FA-U ──┐
       ├──→ FA-H ──→ FA-T
FA-S ──┘
```

## 5. 成功標準

1. `src/mock/utils.ts` 存在，export `extractToken` + `requireValidToken`
2. auth.mock.ts、credits.mock.ts、keys.mock.ts 不再有 local 的 extractToken/requireValidToken
3. oauth.mock.ts 的 `extractBearerToken` 統一為共用的 `extractToken`
4. `store.getEmailForToken(token)` 查 `tokenEmailMap`，不存在返回 `null`（型別 `string | null`）
5. register/login/rotate/OAuth userinfo 各自在正確時機維護 token→email 映射
6. `store.reset()` 清除 tokenEmailMap 並重建 demo 帳號初始映射
7. 所有 134 個測試通過，零退步

## 6. 範圍內

- `src/mock/utils.ts`（新增）
- `src/mock/store.ts`（修改 getEmailForToken + tokenEmailMap + reset）
- `src/mock/handlers/auth.mock.ts`（import utils + 映射維護）
- `src/mock/handlers/credits.mock.ts`（import utils）
- `src/mock/handlers/keys.mock.ts`（import utils）
- `src/mock/handlers/oauth.mock.ts`（import utils + 映射維護）
- 對應 `tests/unit/mock/` 和 `tests/integration/` 測試更新

## 7. 範圍外

- CLI 業務邏輯（src/commands/、src/services/）
- API Client（src/api/）
- MockRouter 邏輯（src/mock/handler.ts）
- Mock bootstrap（src/mock/index.ts）
- Handler 對外 HTTP 回應規格（重構前後行為一致）

## 8. 約束

- HTTP 回應規格不變（handler 對外行為與現在一致）
- `extractToken` 只做 Bearer header 剝離，不做格式驗證（management key 和 OAuth token 格式不同但可共用）
- 遵循現有 factory pattern（`registerXxxHandlers(router, store)`）
- 測試隔離：每個 test suite 的 beforeEach 必須呼叫 `store.reset()`

## 9. 例外情境

| 維度 | 編號 | 情境 | 處理 |
|------|------|------|------|
| 狀態轉換 | E1 | token 未 register 就呼叫 getEmailForToken | 返回 null，requireValidToken 返回 401 |
| 狀態轉換 | E2 | rotate 後舊 token 的映射 | 刪除舊映射、建立新映射 |
| 資料邊界 | E3 | getEmailForToken 傳入空字串 | 返回 null |
| 業務邏輯 | E4 | OAuth userinfo merge 既有帳號 | 使用既有帳號的 email 建立映射 |
| 業務邏輯 | E5 | OAuth userinfo 新帳號 | 使用 GitHub email 建立映射 |

## 10. 技術決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| getEmailForToken 返回型別 | `string \| null` | TypeScript 強制處理 null，比空字串更安全 |
| extractToken 命名 | 統一為 `extractToken` | 4 個 handler 功能完全相同，只是 oauth 用了不同名字 |
| utils 位置 | `src/mock/utils.ts` | 與 mock handler 同層，職責明確 |
