# OpenClaw Token CLI — 版本迭代規劃

**建立日期**：2026-03-15
**當前版本**：v0.1.0
**文件版本**：1.0

---

## 1. 現狀總結

### 1.1 能力盤點

| 領域 | 已完成能力 | SOP | 測試數 |
|------|-----------|-----|--------|
| 帳戶認證 | register, login (email+password), whoami, logout | SOP-1 | 91 (含全域) |
| GitHub OAuth | auth login --github (Device Flow), 帳號合併 | SOP-2 | 114 (累計) |
| Credits 管理 | balance, buy, history, auto-topup config | SOP-1 | (含上) |
| Key 管理 | create, list, info, update, revoke | SOP-1 | (含上) |
| Key 輪換 | auth rotate, keys rotate (保留設定) | SOP-3 | 134 (累計) |
| OpenClaw 整合 | integrate, --remove, --status | SOP-1 | (含上) |
| 真實後端 | Hono + Bun + PostgreSQL 18 端點，獨立 repo | SOP-4 | 44 server + 134 CLI |
| 全域能力 | --mock, --json, --verbose, env var override | SOP-1 | (含上) |

### 1.2 架構現狀

```
CLI (Commander.js)
├── Commands (auth, credits, keys, integrate)
├── Services (auth, credits, keys, integrate, oauth)
├── API Client (axios, endpoints, types)
├── Mock Backend (handlers x4, store, router)
├── Config (manager, paths, schema)
├── Output (formatter, spinner, table)
├── Errors (base, api, messages)
└── Utils (auth-guard, fs, redact, validation, sleep)

Server (獨立 repo: openclaw-token-server)
├── Hono + Bun
├── PostgreSQL (6 tables)
├── 18 HTTP endpoints
└── GitHub OAuth integration
```

- **原始碼檔案**：33 個 `.ts`
- **測試檔案**：18 個
- **累計測試**：134 個（CLI），44 個（Server）
- **所有 SOP 的 AC 覆蓋率**：100%（除 SOP-2 的 AC-5 spinner 簡化為 stderr）

### 1.3 關鍵設計決策紀錄

| ID | 決策 | 來源 |
|----|------|------|
| D1 | Login 產新 key + revoke 舊 key | SOP-4 |
| D2 | Usage stats 使用靜態乘數 placeholder | SOP-4 |
| D3 | Auto-topup 僅存設定，不實作觸發 | SOP-4 |
| D4 | Key hash = SHA-256 前 16 hex，rotate 後不變 | SOP-4 |
| D5 | MockStore 使用 stateless demo 策略 | SOP-1 |
| D6 | sleep 依賴注入以加速測試 | SOP-2 |

---

## 2. Tech Debt 優先排序

### 2.1 高優先（v0.2 必還）

| ID | 債務 | 來源 | 風險 | 理由 |
|----|------|------|------|------|
| TD-1 | `extractToken()`/`requireValidToken()` 在 3 個 mock handler 中完全重複 | SOP-3 P-CLI-004 | 中 | auth.mock.ts、credits.mock.ts、keys.mock.ts 各自定義完全相同的兩個函式。任何 token 驗證邏輯變更需同步三處，極易遺漏。修復成本低（抽到 `mock/utils.ts`），收益高。 |
| TD-2 | `MockStore.getEmailForToken()` 靜態映射所有 token 到 `demo@openclaw.dev` | SOP-3 | 高 | 讓 mock backend 無法正確模擬多用戶場景。OAuth 帳號合併測試已經繞過了這個限制，但後續功能（多用戶、權限）會被完全卡住。 |
| TD-3 | `mapApiError` default case 已修（P-CLI-005） | SOP-2 | - | **已還清**，SOP-2 Task #1b 已修正。 |

### 2.2 中優先（v0.2~v0.3）

| ID | 債務 | 來源 | 風險 | 理由 |
|----|------|------|------|------|
| TD-4 | Mock backend 與真實 API 之間缺乏 contract test | SOP-1 | 中 | Server 已存在，兩套行為可能逐漸分歧。但目前 types.ts 是共享的 single source of truth，短期風險可控。 |
| TD-5 | Server: idempotency key 無 TTL 清理 | SOP-4 | 低 | 開發環境不會累積大量 idempotency key。生產化前必須處理。 |
| TD-6 | Server: auto-topup 僅存設定無觸發機制 | SOP-4 | 低 | 功能不完整但不影響其他功能。需要在真實付款整合時一起做。 |
| TD-7 | Server: usage stats 使用靜態乘數 placeholder | SOP-4 | 低 | 需要 proxy 層才能收集真實 usage。 |

### 2.3 低優先（v1.0 前處理）

| ID | 債務 | 來源 | 風險 | 理由 |
|----|------|------|------|------|
| TD-8 | Integrate 指令依賴 OpenClaw CLI 格式 | SOP-1 | 低 | 外部依賴，需等 OpenClaw CLI 穩定。 |
| TD-9 | 無 refresh token 機制 | SOP-1 | 低 | Management key rotate 已可手動輪換。自動 refresh 是 nice-to-have。 |

---

## 3. 版本路線圖

### 3.1 版本總覽

```
v0.1.0 (current) ─── v0.2.0 ─── v0.3.0 ─── v1.0.0
    MVP CLI            穩固基礎      生產就緒      正式發布
    + Mock Backend     + Contract     + Proxy       + 付款
    + Real Backend     + E2E          + Rate Limit  + Dashboard
    + OAuth            + Config       + Deploy      + 監控
    + Key Rotation     + Cleanup      + Security    + 文件
```

---

### 3.2 v0.2.0 — 穩固基礎（Solid Foundation）

**主題**：還清高優先技術債、建立 CLI-Server contract testing、完善開發體驗。

**目標**：
1. Mock 與 Server 行為一致性有自動化保證
2. Mock backend 支援多用戶場景
3. 程式碼品質提升（消除重複、統一模式）
4. CLI 可靠連接真實 Server 的端到端流程

| # | 功能 / 任務 | 優先級 | 預估 SOP | 描述 |
|---|------------|--------|---------|------|
| 1 | Mock Handler 重構 | P0 | SOP-5 | 抽取 `extractToken`/`requireValidToken` 到 `mock/utils.ts`，消除三檔重複。重構 `MockStore.getEmailForToken()` 改為真實的 token-to-user 映射。 |
| 2 | Contract Testing | P0 | SOP-6 | 基於 `types.ts` 建立 contract test suite：同一組測試同時打 mock handler 和真實 server，驗證 response schema 與行為一致。 |
| 3 | E2E 測試框架 | P1 | SOP-7 | CLI → Real Server 端到端測試。需要 test server 啟動/關閉 harness、test DB setup/teardown。 |
| 4 | CLI Config 強化 | P1 | SOP-8 | 多 profile 支援（dev/staging/prod）、config migration、config validate 指令。 |
| 5 | 開發體驗改善 | P2 | (可合併) | README 完善、`--help` 範例補齊、error message 國際化準備（結構化 error code）。 |

**預估 SOP 數量**：3~4 個

**驗收標準（版本級）**：
- Mock handler 中不存在任何跨檔重複函式
- MockStore 支援多用戶 token 映射
- Contract test suite 存在且 CI green
- E2E 測試至少覆蓋 register → buy credits → create key → integrate 主流程

---

### 3.3 v0.3.0 — 生產就緒（Production Ready）

**主題**：API Proxy 核心功能、安全強化、部署能力。

**目標**：
1. Server 可以實際 proxy API 請求並計算 usage
2. Rate limiting 防濫用
3. Docker 化部署
4. 安全審計通過

| # | 功能 / 任務 | 優先級 | 預估 SOP | 描述 |
|---|------------|--------|---------|------|
| 1 | API Proxy 層 | P0 | SOP-9 | Server 端新增 proxy endpoint，接收 provisioned key 請求、轉發到上游 LLM provider、計算 token usage、扣減 credits。**核心價值所在。** |
| 2 | Usage Stats 真實化 | P0 | (含 SOP-9) | 移除靜態乘數 placeholder，基於 proxy 請求計算真實 usage。 |
| 3 | Rate Limiting | P1 | SOP-10 | 基於 provisioned key 的 credit_limit + limit_reset 實作 rate limiting。 |
| 4 | Auto-topup 觸發 | P1 | SOP-11 | 當 credits 低於 threshold 時自動觸發購買（需付款 placeholder 或 manual approval）。 |
| 5 | Docker Compose | P1 | SOP-12 | Server + PostgreSQL Docker Compose。一鍵啟動開發/測試環境。 |
| 6 | Security Hardening | P0 | SOP-13 | Token hashing at rest、request signing、HTTPS 強制、secrets 管理。Idempotency key TTL 清理。 |
| 7 | CLI: `credits usage` 指令 | P2 | (可合併) | 按模型/日期的 usage breakdown。 |

**預估 SOP 數量**：4~5 個

**驗收標準（版本級）**：
- Provisioned key 可透過 proxy 打到至少一個 LLM provider
- Usage 計算準確
- Credit limit 超額時請求被拒絕
- Docker Compose 一鍵跑起完整環境
- 安全審計清單全過

---

### 3.4 v1.0.0 — 正式發布（General Availability）

**主題**：付款整合、監控、文件、穩定性。

| # | 功能 / 任務 | 優先級 | 預估 SOP | 描述 |
|---|------------|--------|---------|------|
| 1 | Stripe 付款整合 | P0 | SOP-14 | `credits buy` 走真實 Stripe checkout。Server 端 webhook 處理付款確認。 |
| 2 | 雲端部署 | P0 | SOP-15 | Production 部署方案，CI/CD pipeline，monitoring。 |
| 3 | Observability | P1 | SOP-16 | Structured logging、metrics（Prometheus）、alerting。 |
| 4 | 其他 OAuth Provider | P2 | SOP-17 | Google OAuth、GitLab OAuth。 |
| 5 | 完整文件 | P0 | (非 SOP) | API reference、Getting Started guide、Troubleshooting。 |
| 6 | npm publish + CLI binary | P1 | (非 SOP) | npm package 發布、GitHub Releases。 |
| 7 | Web Dashboard | P2 | (另案) | 基本 web UI 查看 credits、keys、usage。獨立專案。 |

**預估 SOP 數量**：3~4 個

---

## 4. 風險評估

### 4.1 技術風險

| 風險 | 等級 | 緩解策略 |
|------|------|---------|
| API Proxy 層的 streaming 支援 | 高 | 先支援非 streaming，再加 streaming。Token 計算使用 tiktoken 或上游回傳的 usage 欄位 |
| Stripe webhook 可靠性 | 中 | Idempotent webhook handler + 定期對帳 reconciliation job |
| MockStore 多用戶重構影響範圍 | 中 | 分階段重構，每步跑全量測試 |
| OpenClaw CLI 格式變更 | 低 | 版本檢測 + graceful degradation |

### 4.2 依賴風險

| 依賴 | 風險 | 緩解策略 |
|------|------|---------|
| GitHub OAuth API | 外部服務不可控 | 已有 mock + 502 fallback |
| PostgreSQL | 開發者環境前置要求 | Docker Compose 解決（v0.3.0） |
| Bun runtime (server) | 生態成熟度 | 架構簡單，必要時可遷回 Node.js |
| 上游 LLM Provider API | 格式不統一 | OpenAI-compatible 為主，adapter pattern |

---

## 5. 建議的下一步

### 最優先：SOP-5 Mock Handler 重構

**理由**：
1. 修復成本極低：抽取兩個函式到共用模組
2. 消除已確認的 P-CLI-004 pitfall
3. 為後續 SOP 掃除障礙：MockStore 多用戶改造是 contract testing 的前置條件

**範圍**：
- 抽取 `extractToken()` + `requireValidToken()` 到 `src/mock/utils.ts`
- 重構 `MockStore.getEmailForToken()` 為真實的 token → email 映射
- 更新所有 mock handler import
- 全量測試回歸

### 次優先：SOP-6 Contract Testing

**理由**：
1. 兩套實作的行為分歧是定時炸彈
2. v0.3.0 的 proxy 層會大幅增加 server 端邏輯，沒有 contract test 會失控
3. SOP-5 完成後立即可做

---

## 附錄 A：SOP 總索引

| SOP | 功能 | 版本 | 狀態 | 日期 |
|-----|------|------|------|------|
| SOP-1 | openclaw-token-cli (核心 CLI) | v0.1.0 | 完成 | 2026-03-14 |
| SOP-2 | oauth-device-flow (GitHub OAuth) | v0.1.0 | 完成 | 2026-03-15 |
| SOP-3 | key-rotation (Key 輪換) | v0.1.0 | 完成 | 2026-03-15 |
| SOP-4 | real-backend (真實後端) | v0.1.0 | 完成 | 2026-03-15 |
| SOP-5 | mock-handler-refactor | v0.2.0 | 規劃 | - |
| SOP-6 | contract-testing | v0.2.0 | 規劃 | - |
| SOP-7 | e2e-testing | v0.2.0 | 規劃 | - |
| SOP-8 | cli-config-enhancement | v0.2.0 | 規劃 | - |
| SOP-9 | api-proxy | v0.3.0 | 規劃 | - |
| SOP-10~13 | security + infra | v0.3.0 | 規劃 | - |
| SOP-14~17 | payment + deploy + monitor | v1.0.0 | 規劃 | - |

## 附錄 B：Pitfall 總索引

| ID | 標籤 | 標題 | 來源 | 狀態 |
|----|------|------|------|------|
| P-CLI-001 | cli/mock | sk-mgmt- token format requires strict hex UUID | SOP-1 | 有效 |
| P-CLI-002 | cli/axios | Axios request interceptors execute in LIFO order | SOP-1 | 有效 |
| P-CLI-003 | cli/testing | Mock handlers must use router-injected store | SOP-1 | 有效 |
| P-CLI-004 | cli/architecture | 工具函式跨模組重複定義 | SOP-1 | 有效 |
| P-CLI-005 | cli/errors | mapApiError default case 丟失 errorCode | SOP-2 | 已修復 |
| P-CLI-006 | cli/security | child_process.exec command injection | SOP-2 | 已修復 |
