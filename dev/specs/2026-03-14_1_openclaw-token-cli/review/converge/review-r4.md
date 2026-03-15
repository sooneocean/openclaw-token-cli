# Spec Converge Review — Round 4

**審查時間**: 2026-03-15
**Engine**: fallback (claude-sonnet-4-6)
**輸入**: spec-current.md（R3 後最新版本）

---

## 前輪修正確認

| 項目 | 確認狀態 |
|------|---------|
| R2: stateless login（demo-password 驗證）| Task #8/#9 已明確定義，confirmed |
| R2: redactSecret 統一（Task #4 為唯一 source of truth）| Task #5/#7 均有明確 reference，confirmed |
| R3: createProgram() factory DoD | Task #7 DoD 最後一項完整定義，confirmed |
| R3: --status key 失效行為（顯示警告不自動改 config）| Task #15 Contract + DoD 均已明確，confirmed |
| R3: integrate upsert 語意（先移除再注入）| Task #15 DoD 已明確含 "Updated existing integration."，confirmed |
| R3: idempotency header 命名統一（Idempotency-Key）| Task #3/#11/#12 三處一致，confirmed |

---

## Findings

### [SR-P1-01] createApiClient() 與 MockStore 的 wiring 機制缺失

- **id**: SR-P1-01
- **severity**: P1
- **category**: 技術合規 / 分層架構介面定義
- **file**: `src/api/client.ts`（Task #3）、`src/mock/store.ts`（Task #8）、`src/index.ts`（Task #7）
- **rule**: 完整性——各層介面必須明確定義，尤其跨 Task 的依賴
- **evidence**:
  - Task #3 DoD 定義 `createApiClient({ mock: true })` 只接受 `{ mock: boolean, baseURL?, token? }`，無 `store` 參數
  - Task #8 DoD 定義 MockStore 支援 constructor injection，但未說明誰持有 store instance
  - Task #7 DoD 定義 `createProgram(options?: { store?: MockStore })` 可注入 MockStore
  - 缺失：mock adapter（Task #3）如何取得 MockStore 實例？是透過 `createApiClient` 的額外參數、還是由 `createProgram` 呼叫 `createApiClient` 時傳入、還是全域 singleton？這三種方式的 interface 完全不同，Task #3 與 Task #7/#8 的實作者對此沒有 spec 指引
- **impact**: Task #3 和 Task #8 的實作者可能各自做出不相容的設計，導致整合測試（Task #17）的 in-process mock 流程無法 work，需要重構
- **fix**: 在 Task #3 或 Task #8 中明確定義 wiring 方式，建議選項之一：`createApiClient({ mock: true, store: MockStore })` 接受 store 注入；或在 Task #7 的 `createProgram()` 描述中說明 store instance 如何傳遞到 API client

---

### [SR-P2-01] integrate auto-create key 的 name 決策邏輯未定義

- **id**: SR-P2-01
- **severity**: P2
- **category**: 完整性 / 行為定義
- **file**: `src/services/integrate.service.ts`（Task #15）
- **rule**: 每個任務有可測試 DoD，行為邊界必須明確
- **evidence**:
  - Task #15 DoD：`integrate — 無 provisioned key 時自動建立`
  - Task #14 DoD：`keys create --name my-agent --limit 10` 需要 `--name` 參數
  - 缺失：`integrate` 自動建立 key 時，key name 從何而來？是否 prompt 用戶輸入？是否使用預設值（如 `openclaw-integration`）？Spec 未定義
- **impact**: 實作者需自行決定行為，可能導致不同人對「自動建立」的實作不一致，且 Task #17 FA-D 整合測試無法明確驗證此行為（測試 script 不知道該期待什麼 key name）
- **fix**: 在 Task #15 描述或 DoD 中補充：自動建立時的 key name 決策（例如：prompt 用戶輸入，或預設為 `openclaw-integration`），以及 credit_limit 預設值

---

## Summary

totals: P0=0, P1=1, P2=1

decision: REJECTED
