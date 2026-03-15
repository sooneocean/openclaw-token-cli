# Spec Review Task

你是嚴格的 Spec 審查專家。請審查以下 spec，找出所有問題。

## Review Standards

# Spec & Code Review 審查標準

### Spec Review 審查項目

#### 1. 完整性
- 每個任務都有可測試的 DoD
- 驗收標準使用 Given-When-Then，覆蓋 happy + error path
- 任務依賴關係清楚、粒度合理
- 涵蓋所有 S0 成功標準
- 技術決策有理由、有替代方案考量

#### 2. 技術合規
- Data Flow 遵循專案既有的分層架構
- 各層職責清晰，不越界
- 命名與既有 codebase 風格一致

#### 3. Codebase 一致性
- 提到的 class/method/endpoint 名稱存在或明確標為新建
- endpoint 路徑與路由定義一致
- 未違反已知架構約束

#### 4. 風險與影響
- 影響範圍完整列出
- 回歸風險、相依關係、安全性影響、效能影響已評估

#### 5. S0 成功標準對照
- 每條成功標準可追溯到任務/驗收標準
- 無遺漏、無超出 scope_out

### 嚴重度判定

| 等級 | 定義 |
|------|------|
| **P0** | 阻斷：安全漏洞、資料遺失、架構根本錯誤、需求理解偏差 |
| **P1** | 重要：邏輯錯誤、缺驗證、效能瓶頸、不符規範、DoD 不可測試 |
| **P2** | 建議：命名風格、註解品質、可讀性、最佳實踐 |

## Output Format

### Findings 格式

每個 finding 使用以下格式：

### [SR-{severity}-{序號}] {severity} - 問題標題

- id: `SR-{severity}-{序號}`
- severity: `P0 | P1 | P2`
- category: `architecture | logic | security | test | hardcode | duplication | performance | consistency`
- file: `spec section`
- line: `N/A`
- rule: `違反的規則/標準`
- evidence: `具體觀察到的事實，不要抽象形容`
- impact: `風險與影響範圍`
- fix: `可執行修復建議`

### Summary

- totals: `P0=N, P1=N, P2=N`
- decision: `APPROVED | REJECTED`

> **APPROVED** 條件：P0=0 且 P1=0 且 P2=0。有任何 finding 就是 REJECTED。

> **收斂模式補充規則**：
> - 如果前輪修正已解決某問題，不要重複提出。
> - 每個 finding 必須有具體 evidence，不可模糊形容。
> - 本次為收斂模式審查，不提供 codebase 檔案。請基於 spec 內部一致性和技術合規性審查。

## 前輪審查歷史

### Round 1 審查結果（P0=0, P1=5, P2=1）
- SR-P1-001: 任務清單缺少 DoD — **誤報**（review input 截斷導致，實際 spec 包含完整 18 個 Task 的 DoD）
- SR-P1-002: 驗收標準未列出 — **誤報**（review input 截斷導致，實際 spec 包含完整 23 條 Given-When-Then）
- SR-P1-003: FA-D 缺 OpenClaw config contract — **已修正**（補上完整 Config Contract）
- SR-P1-004: Login API 缺 AuthLoginResponse — **已修正**（補上 AuthLoginResponse type）
- SR-P1-005: 風險章節只有摘要 — **誤報**（review input 截斷導致，實際 spec 包含完整風險表格）
- SR-P2-006: --no-color 設計契約不完整 — **已修正**（擴充 Task #5 DoD 的 --no-color 行為規格）

### Round 1 修正摘要
- 補上 AuthLoginResponse interface（management_key, email, last_login）
- 在 Task #15 新增 OpenClaw Config Contract（路徑、格式、注入 schema、backup、rollback、衝突偵測）
- 擴充 Task #5 DoD 的 --no-color 行為（chalk level=0、ora 降級、cli-table3 無框線）

## 待審查 Spec（完整內容）

以下是完整的 S1 Dev Spec，包含所有章節（Section 1~8）、18 個 Task 詳情（含 DoD）、23 條驗收標準、5 項風險表格。請基於完整內容審查。

---

# S1 Dev Spec: OpenClaw Token CLI

> **階段**: S1 技術分析
> **建立時間**: 2026-03-14 22:00
> **工作類型**: new_feature
> **複雜度**: L

## 1. 概述

建立 credit-based API proxy CLI 客戶端（`openclaw-token`），讓 OpenClaw 用戶管理 credits、provisioning API keys，並一鍵整合為 agent fallback provider。

技術方案：Node.js + TypeScript + Commander.js，分層架構（Commands → Services → API Client），內建 mock handler，Config 持久化（atomic write），輸出層支援 human-readable 與 --json。

## 2. 影響範圍

- Greenfield 專案，31 個新檔案
- 依賴：commander ^12, axios ^1, chalk ^5, ora ^8, cli-table3, inquirer ^9, zod ^3, which ^4
- Dev deps: typescript ^5, vitest ^2, tsup ^8, execa ^8

## 3. User Flow

完整 mermaid 流程圖 + 6 步主要流程 + 8 個異常流程（E1~E8）+ S0→S1 例外追溯表（8/8 覆蓋）。

## 4. Data Flow

- Sequence diagram 展示 credits buy 完整流程
- 13 個 API endpoints（FA-A: 3, FA-B: 5, FA-C: 5）
- 資料模型：OpenClawTokenConfig, AuthRegisterResponse, **AuthLoginResponse（新增）**, AuthMeResponse, CreditsResponse, CreditsPurchaseResponse, CreditHistoryEntry, AutoTopupConfig, ProvisionedKey, KeyDetailResponse

## 5. 任務清單（18 Tasks, 6 Waves）

### Wave 1 (8 tasks): 基礎設施
- Task #1: 專案初始化（5 DoD items）
- Task #2: Config 模組（9 DoD items，含 env var 優先序、atomic write）
- Task #3: API Client（8 DoD items，含 idempotency key）
- Task #4: 錯誤處理（8 DoD items，含 redactSecret）
- Task #5: 輸出模組（6 DoD items，含 --no-color chalk/ora/table 降級契約）
- Task #6: 參數驗證（6 DoD items）
- Task #7: Commander 主程式（6 DoD items，含 verbose stderr 輸出）
- Task #8: Mock Store（8 DoD items，含 constructor injection）

### Wave 2 (2 tasks): FA-A 認證
- Task #9: Auth Mock Handlers（5 DoD items）
- Task #10: Auth Service + Commands（7 DoD items）

### Wave 3 (2 tasks): FA-B Credits
- Task #11: Credits Mock Handlers（7 DoD items）
- Task #12: Credits Service + Commands（11 DoD items）

### Wave 4 (2 tasks): FA-C Keys
- Task #13: Keys Mock Handlers（6 DoD items）
- Task #14: Keys Service + Commands（10 DoD items）

### Wave 5 (1 task): FA-D Integration
- Task #15: Integrate Service + Command（10 DoD items + OpenClaw Config Contract：路徑、格式、注入 schema、備份、衝突偵測、rollback、未知欄位保留）

### Wave 6 (3 tasks): 測試 + 文件
- Task #16: 單元測試（5 DoD items，覆蓋率 >= 80%）
- Task #17: 整合測試（7 DoD items，in-process + execa smoke）
- Task #18: README + Help 文案（3 DoD items）

## 6. 技術決策（8 項，含選項/選擇/理由）

Commander.js, axios, chalk+ora+cli-table3, inquirer, zod, vitest, 內建 handler map, tsup。

## 7. 驗收標準

### 7.1 功能驗收（23 條 Given-When-Then）

| # | 場景 | Given | When | Then | 優先級 | FA |
|---|------|-------|------|------|--------|----|
| 1 | 首次註冊 | 無 config | auth register | config.json 已儲存 management_key | P0 | FA-A |
| 2 | 登入 | 已有帳戶 | auth login | Config 更新 | P0 | FA-A |
| 3 | 登入失敗 | 已有帳戶 | 錯誤 password | "Invalid credentials" | P1 | FA-A |
| 4 | 查看身份 | 已登入 | auth whoami | 顯示 email/plan/credits/keys | P0 | FA-A |
| 5 | 登出 | 已登入 | auth logout | Config 刪除 | P1 | FA-A |
| 6 | 環境變數覆蓋 | OPENCLAW_TOKEN_KEY=sk-xxx | auth whoami | 使用 env var key | P1 | FA-A |
| 7 | 查餘額 | 已登入 | credits balance | 顯示 total/used/remaining | P0 | FA-B |
| 8 | 購買 credits | 已登入 | credits buy --amount 25 | receipt + 餘額增加 | P0 | FA-B |
| 9 | 購買跳過確認 | 已登入 | credits buy --yes | 直接購買 | P1 | FA-B |
| 10 | 交易紀錄 | 已有購買 | credits history | 表格交易 | P1 | FA-B |
| 11 | Auto top-up | 已登入 | credits auto-topup --enable | 設定成功 | P1 | FA-B |
| 12 | 建立 key | 已登入 | keys create | key 值 + 警告 | P0 | FA-C |
| 13 | 列出 keys | 已有 key | keys list | 表格 | P0 | FA-C |
| 14 | key 詳情 | 已有 key | keys info | usage 統計 | P1 | FA-C |
| 15 | 更新 key | 已有 key | keys update --limit 20 | 更新成功 | P1 | FA-C |
| 16 | 撤銷 key | 已有 key | keys revoke | 已停用 | P1 | FA-C |
| 17 | 一鍵整合 | key + OpenClaw | integrate | fallback 已注入 | P0 | FA-D |
| 18 | 移除整合 | 已整合 | integrate --remove | 已移除 | P1 | FA-D |
| 19 | 整合狀態 | 已整合 | integrate --status | 狀態 + chain | P1 | FA-D |
| 20 | 未認證操作 | 無 config | credits balance | 提示登入 | P0 | 全域 |
| 21 | API 不可達 | 已登入 | 任何 API 指令 | 友善錯誤 | P1 | 全域 |
| 22 | JSON 輸出 | 已登入 | --json | valid JSON | P0 | 全域 |
| 23 | Mock 模式 | 任何狀態 | --mock | 使用 mock backend | P0 | 全域 |

### 7.2 非功能驗收
- 冷啟動 < 500ms、timeout 10s、key 不 log stdout、Node >= 18、--json + --no-color

### 7.3 測試計畫
- 單元測試覆蓋率 >= 80%、整合測試 in-process + smoke、E2E N/A

## 8. 風險與緩解（5 項）

| 風險 | 影響 | 機率 | 緩解措施 | 負責 |
|------|------|------|---------|------|
| chalk/ora ESM import | 高 | 中 | tsconfig ESNext + tsup 設定 | Task #1 |
| inquirer 無 TTY | 中 | 中 | --yes flag + mock stdin | Task #17 |
| Mock/Real 不一致 | 中 | 高 | 嚴格按 api_spec + 未來 contract test | Task #9,11,13 |
| OpenClaw config 變更 | 中 | 低 | defensive parsing + 保留未知欄位 | Task #15 |
| Windows atomic write | 低 | 低 | fs.rename fallback write+sync | Task #2 |
