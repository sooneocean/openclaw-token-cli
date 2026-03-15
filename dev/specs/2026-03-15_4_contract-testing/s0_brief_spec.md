# S0 Brief Spec — Contract Testing

**SOP ID**: SOP-6
**版本**: v0.2.0
**work_type**: new_feature
**建立日期**: 2026-03-15

---

## 1. 一句話描述

建立 contract test suite，同一組測試同時驗證 mock handler 和真實 server 的 response schema 與行為一致性。

## 2. 痛點

- CLI 134+ 測試全跑 mock，server 44 測試獨立跑，兩套行為可能逐漸分歧
- types.ts 保證 schema，但行為邏輯（如 login revoke 舊 key、idempotency 處理）沒有自動化交叉驗證
- v0.3.0 的 proxy 層會大幅增加 server 端邏輯，沒有 contract test 分歧會快速擴大

## 3. 目標

一套測試、兩個 target：mock handler 和真實 server。驗證 response 結構和關鍵行為一致。

## 4. 功能區拆解

### §4.0 FA 識別表

| FA ID | 名稱 | 描述 | 獨立性 |
|-------|------|------|--------|
| FA-F | Contract Test 框架 | 雙模式 test harness（mock/real）、共用 fixtures、response 驗證 helpers | high |
| FA-S | 場景定義 | 6 個核心場景的 contract test cases | medium |
| FA-CI | CI 整合 | npm script、環境變數文件 | low |

**拆解策略**: `single_sop_fa_labeled`

### §4.1 跨 FA 依賴

```
FA-F ──→ FA-S ──→ FA-CI
```

## 5. 成功標準

1. `tests/contract/` 目錄存在，包含至少 6 個場景的 contract test
2. `npm run test:contract:mock` 跑 mock 模式全過
3. `CONTRACT_TEST_BASE_URL=http://localhost:3000 npm run test:contract:real` 跑真實 server 全過
4. 同一測試檔案、同一斷言，兩個 target 的結果一致
5. Response 結構驗證基於 types.ts 的型別定義
6. 現有 166 個測試不受影響

## 6. 範圍內

- **FA-F**: 雙模式 test harness
  - Mock 模式：直接呼叫 handleMockRequest（已有）
  - Real 模式：HTTP 請求到真實 server（axios/fetch）
  - 共用 response 結構驗證 helpers
  - 測試 fixture 工廠（建立測試帳號、清理等）
- **FA-S**: 6 個核心場景
  - Auth: register → login → whoami → rotate
  - Credits: balance → purchase → history
  - Keys: create → list → info → update → revoke → rotate
  - OAuth: device/code → device/token → userinfo
  - Error: 401（無 token）、400（invalid input）、409（duplicate）
  - Idempotency: 重複 purchase 回傳相同結果
- **FA-CI**: npm scripts + .env.example

## 7. 範圍外

- 修改 server 端程式碼（openclaw-token-server）
- 修改現有 mock handler 邏輯
- 修改現有 166 個測試
- Server 自動啟動/關閉（手動管理）
- Docker Compose（v0.3.0 SOP-12）
- GitHub Actions CI 配置（後續）

## 8. 約束

- 測試框架：vitest（與現有一致）
- Mock 模式不需外部依賴
- Real 模式需要：PostgreSQL + openclaw-token-server 運行中
- 測試必須是冪等的（每個場景獨立，不依賴前一個場景的狀態）
- Response 驗證不驗證動態值（如 timestamp、UUID），只驗結構和型別

## 9. 例外情境

| 維度 | 編號 | 情境 | 處理 |
|------|------|------|------|
| 網路/外部 | E1 | Real server 未啟動 | 測試 skip 並提示啟動 server |
| 網路/外部 | E2 | PostgreSQL 未連線 | Server 啟動失敗，同 E1 |
| 狀態轉換 | E3 | 測試間殘留狀態 | 每個場景 beforeEach 清理（mock: reset()，real: 註冊新帳號） |
| 資料邊界 | E4 | Server response 多出 mock 沒有的欄位 | 驗證核心欄位存在，允許額外欄位 |
| 業務邏輯 | E5 | Mock 和 real 行為不一致（bug） | 測試失敗即為 contract violation，需修復 |

## 10. 設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 測試切換方式 | 環境變數 `CONTRACT_TEST_BASE_URL` | 無 URL = mock 模式；有 URL = real 模式 |
| HTTP client | axios（複用現有 API client） | 與 CLI 使用同一 client，更真實 |
| Response 驗證 | 型別斷言 + 結構檢查 | 不用 zod schema（避免維護兩套型別），用 TypeScript satisfies + runtime assertion |
| 測試隔離 | 每場景註冊新帳號（unique email） | Real 模式不能 reset DB |
| OAuth 場景 | Real 模式 skip | 需真實 GitHub OAuth App，CI 不可行 |
