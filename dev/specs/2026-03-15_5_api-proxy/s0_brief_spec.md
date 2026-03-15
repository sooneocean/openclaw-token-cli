# S0 Brief Spec — API Proxy 層

**SOP ID**: SOP-9
**版本**: v0.3.0
**work_type**: new_feature
**建立日期**: 2026-03-15
**實作 repo**: openclaw-token-server（/Users/asd/demo/openclaw-token-server）

---

## 1. 一句話描述

在 openclaw-token-server 新增 proxy endpoint，讓 agent 用 provisioned key 透過 proxy 打 OpenAI-compatible LLM API，自動計算 token usage 並扣減 credits。

## 2. 痛點

- Agent 用 provisioned key 但目前 server 沒有 proxy 功能，key 只是一張「卡片」沒有實際轉發能力
- Usage stats 是假的靜態乘數 placeholder
- Credits 買了但沒有消耗機制
- 整個 OpenClaw Token 系統目前只是管理面，缺少核心的 proxy 價值

## 3. 目標

讓 provisioned key 成為真正可用的 API key：agent 發送 OpenAI-compatible 請求到 proxy → proxy 驗證 key → 轉發到上游 LLM → 攔截 response → 計算 usage → 扣減 credits → 回傳給 agent。

## 4. 功能區拆解

### §4.0 FA 識別表

| FA ID | 名稱 | 描述 | 獨立性 |
|-------|------|------|--------|
| FA-P | Proxy Endpoint | POST /v1/chat/completions — 接收請求、轉發、回傳 | high |
| FA-A | Key 驗證 + 授權 | 驗證 provisioned key 有效性、credit limit、disabled/revoked 狀態 | high |
| FA-U | Usage 計算 + 扣減 | 從 OpenAI response 提取 usage tokens、計算 cost、扣減 credits | medium |
| FA-D | DB Schema 擴充 | 新增 usage_logs 表記錄每次 proxy 請求 | medium |

**拆解策略**: `single_sop_fa_labeled`

### §4.1 跨 FA 依賴

```
FA-D ──→ FA-A ──→ FA-P ──→ FA-U
                    ↑          │
                    └──────────┘ (usage 寫回 DB)
```

## 5. 核心流程

```
Agent Request
    │
    ▼
POST /v1/chat/completions
    │
    ├─ Authorization: Bearer sk-prov-xxx
    │
    ▼
[FA-A] Key 驗證
    ├─ 查 provisioned_keys: 存在？revoked？disabled？
    ├─ 查 credit_balances: remaining >= 0？
    ├─ 查 credit_limit: 今日/週/月用量 < limit？
    │
    ├─ 失敗 → 401/402/429
    │
    ▼
[FA-P] 轉發到上游
    ├─ 替換 Authorization header 為上游 API key
    ├─ 轉發 request body 不修改
    ├─ 上游 URL 從 config 或 request header 取得
    │
    ├─ 上游失敗 → 502
    │
    ▼
[FA-U] 攔截 Response
    ├─ 從 response.usage 提取 prompt_tokens、completion_tokens、total_tokens
    ├─ 計算 cost（基於 model pricing）
    ├─ 更新 provisioned_keys.usage += cost
    ├─ 更新 credit_balances.total_usage += cost
    ├─ 插入 usage_logs 記錄
    │
    ▼
回傳原始 Response 給 Agent
```

## 6. 成功標準

1. `POST /v1/chat/completions` endpoint 存在且可接收 OpenAI-compatible request
2. 有效 provisioned key 的請求成功轉發到上游 LLM 並回傳結果
3. 無效/revoked/disabled key 回傳 401
4. Credits 不足回傳 402
5. Response 中的 usage tokens 被正確提取並記錄
6. provisioned_keys.usage 和 credit_balances.total_usage 在每次請求後更新
7. usage_logs 表記錄每次 proxy 請求
8. 上游不可達時回傳 502 + 友善錯誤訊息
9. 現有 44 個 server 測試 + 167 個 CLI 測試不受影響
10. 新增至少 10 個 proxy 相關測試

## 7. 範圍內

- **FA-P**: `POST /v1/chat/completions`（非 streaming，直接 JSON 回傳）
- **FA-A**: Provisioned key 驗證 middleware（查 DB）
- **FA-U**: Usage 計算（prompt_tokens + completion_tokens → cost）、credits 扣減、usage_logs 記錄
- **FA-D**: `usage_logs` 表（migration 002）
- 上游 API key 配置（環境變數 `UPSTREAM_API_KEY` + `UPSTREAM_API_BASE`）
- 簡易 model pricing 表（硬編碼，後續可擴充）
- proxy 相關測試（使用 mock upstream server）

## 8. 範圍外

- Streaming（SSE）— v0.3.1 再做
- 多 provider adapter（Anthropic、Google）— 只做 OpenAI-compatible
- 真實 model pricing API — 用硬編碼 pricing 表
- Rate limiting（SOP-10）
- Auto-topup 觸發（SOP-11）
- token-cli 程式碼修改
- Credit limit 的 daily/weekly/monthly reset cron

## 9. 約束

- 在 openclaw-token-server repo 實作（Hono + Bun）
- 使用現有 PostgreSQL schema + 新增 migration
- 上游 API 的 API key 從環境變數取得
- Proxy 不修改 request/response body，只做轉發 + usage 記錄
- 價格計算使用 cost-per-1M-tokens 模型（與 OpenAI pricing 一致）

## 10. 例外情境

| 維度 | 編號 | 情境 | 處理 |
|------|------|------|------|
| 網路/外部 | E1 | 上游 LLM API 不可達 | 502 + `{ error: { code: "UPSTREAM_ERROR", message } }` |
| 網路/外部 | E2 | 上游回傳非 200 | 透傳上游 status code + body |
| 業務邏輯 | E3 | Credits 不足（remaining <= 0） | 402 + `{ error: { code: "INSUFFICIENT_CREDITS" } }` |
| 業務邏輯 | E4 | Provisioned key disabled | 401 + `{ error: { code: "KEY_DISABLED" } }` |
| 業務邏輯 | E5 | Provisioned key revoked | 401 + `{ error: { code: "KEY_REVOKED" } }` |
| 資料邊界 | E6 | Response 缺少 usage 欄位 | 記錄 warning，usage 設為 0，不阻擋回傳 |
| 資料邊界 | E7 | 未知 model（無 pricing）| 使用 default pricing（fallback rate） |
| 並行 | E8 | 多個並行請求同時扣減 credits | PostgreSQL transaction + SELECT FOR UPDATE |

## 11. 技術決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 上游呼叫方式 | 原生 fetch | Bun 內建，不需額外依賴 |
| Pricing 策略 | 硬編碼 Map | MVP 夠用，後續可改為 DB 表 |
| Usage 計算時機 | 拿到 response 後同步計算 | 非 streaming 模式下 response 是完整 JSON |
| 並行扣減 | PostgreSQL transaction | 確保原子性 |
| Proxy key 格式 | `sk-prov-*` | 與 management key `sk-mgmt-*` 區分 |
| 上游 API key 來源 | 環境變數 `UPSTREAM_API_KEY` | 簡單直接 |
