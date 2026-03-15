# S2 Review Report: OAuth Device Flow

> **審查時間**: 2026-03-15
> **引擎**: Opus fallback（Codex 不可用）
> **Session**: 20260315_094437
> **結論**: conditional_pass → 修正後通過

---

## 審查摘要

| 項目 | 數值 |
|------|------|
| R1 原始 findings | P0=3, P1=5, P2=3 |
| R3 最終 findings | P0=2, P1=2, P2=7 |
| 修正項目 | 4 項（2 P0 + 2 P1） |

## 預審摘要

Phase 0 codebase-explorer 發現 3 P1 + 1 P2，其中 SR-PRE-001/002 與 R1 SR-P0-001 重疊，SR-PRE-003 與 R1 SR-P1-003 重疊。預審結果已合併至 R1 分析中。

## 問題清單與處置

### P0 修正（已完成）

| ID | 問題 | R2 回應 | R3 裁決 | 修正 |
|----|------|---------|---------|------|
| SR-P0-001 | ConfigManager.write() 缺少 last_login/created_at/api_base 完整欄位映射 | 接受 | ❌ 維持 P0 | Data Flow + Task #5 已補齊完整 5 欄位寫入 |
| SR-P0-003 | mapApiError() 吞掉 error code，pollForToken() 無法區分 OAuth errors | 接受 | ❌ 維持 P0 | 新增 Task #1b（CLIError.code + mapApiError 修正），影響範圍加入 errors/ 檔案 |

### P1 修正（已完成）

| ID | 問題 | R2 回應 | R3 裁決 | 修正 |
|----|------|---------|---------|------|
| SR-P1-003 | MockUser.password 必填但 OAuth 新帳號無 password | 接受 | ❌ 維持 P1 | MockUser.password 改為可選，auth.mock login 加 password undefined 檢查 |
| SR-P1-005 | 影響範圍漏列 errors/ 檔案 | 接受 | ❌ 維持 P1 | 修改檔案清單加入 base.ts + api.ts + auth.mock.ts |

### P2（不阻塞，記錄備查）

| ID | 問題 | 最終處置 |
|----|------|---------|
| SR-P0-002 | MockUser 缺 last_login（SR-P0-001 衍生） | 降為 P2，OAuthService 自行產生 timestamp |
| SR-P1-001 | GET /oauth/userinfo 副作用 + 冪等性 | 降為 P2，mock 環境可接受 |
| SR-P1-002 | mock 自動授權時間測試可控性 | 降為 P2，直接操作 MockStore 即可 |
| SR-P1-004 | S0 /oauth/token vs S1 /oauth/device/token 不一致 | 降為 P2，TD-1 已解釋 |
| SR-P2-001 | mock email 固定不夠靈活 | P2，記錄 |
| SR-P2-002 | E3 email 為空觸發路徑不明 | P2，測試直接操作 MockStore |
| SR-P2-003 | access_denied mock 無觸發路徑 | P2，OAuthService 單元測試 mock API response |

## 修正摘要

1. **Data Flow sequenceDiagram**: `ConfigManager.write()` 補齊 5 個必填欄位
2. **Task #1b 新增**: CLIError.code + mapApiError default case 保留 errorCode
3. **Task #2 更新**: MockUser.password 改為可選
4. **Task #3 更新**: auth.mock login handler 新增 password undefined 檢查
5. **Task #5 更新**: DoD 明確列出 5 個 config 欄位，pollForToken 用 CLIError.code 區分
6. **影響範圍**: 新增 src/errors/base.ts、src/errors/api.ts、src/mock/handlers/auth.mock.ts

## 審查軌跡

| Round | 引擎 | 結果 |
|-------|------|------|
| Phase 0 | codebase-explorer (Sonnet) | 0 P0, 3 P1, 1 P2 |
| R1 | Opus fallback | 3 P0, 5 P1, 3 P2 → BLOCKED |
| R2 | architect (Opus) | 接受 2 P0 + 2 P1，降級 1 P0 + 3 P1 |
| R3 | Sonnet | conditional_pass → 2 P0, 2 P1, 7 P2 |
| 修正 | Orchestrator | 4 項修正已套用 |
