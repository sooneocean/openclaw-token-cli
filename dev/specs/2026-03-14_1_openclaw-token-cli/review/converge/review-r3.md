# Spec Review — Convergence Round 3

> Round: 3
> Engine: fallback (claude-sonnet-4-6)
> Scope: spec
> Input: spec-current.md

---

## Findings

### [SR-P1-001] P1 - Task #7 缺少 `createProgram()` factory DoD，但 Task #17 明確依賴它

- id: `SR-P1-001`
- severity: `P1`
- category: `consistency`
- file: `Section 5.2 Task #7, Task #17`
- line: `Task #7 DoD（全部）、Task #17 描述`
- rule: `完整性：每個任務有可測試 DoD；Codebase 一致性：依賴關係明確`
- evidence: `Task #17 描述明確說「透過 program factory（createProgram(mockStore)）直接在 vitest 程序內初始化 Commander instance，注入共享的 MockStore 實例」。但 Task #7 的全部 DoD 項目（5 條）完全未提到須匯出 createProgram() factory function，也未說 program 需接受 mockStore 注入參數。Task #7 只有 --version、--help、全域 flags、未知指令、error handler 五條 DoD。`
- impact: `實作 Task #7 的 agent 會照 DoD 產出單一 program singleton（常見 Commander 實作），沒有 factory。到 Task #17 時 createProgram(mockStore) 不存在，整合測試架構無從建立，需要返工 Task #7。這是跨任務的介面契約缺口，會造成 Wave 6 卡住。`
- fix: `在 Task #7 DoD 新增一條：「匯出 createProgram(options?: { store?: MockStore }): Command factory function，供整合測試注入 MockStore；預設不傳時使用全域 MockStore singleton（--mock 模式）」。同時在描述補充 factory pattern 的設計意圖。`

---

### [SR-P1-002] P1 - Task #15 `integrate --status` key 失效時的行為未定義

- id: `SR-P1-002`
- severity: `P1`
- category: `logic`
- file: `Section 5.2 Task #15 OpenClaw Config Contract / DoD`
- line: `--status 定義、DoD 第 5 條`
- rule: `完整性：每個任務有可測試 DoD；驗收標準涵蓋 error path`
- evidence: `Task #15 OpenClaw Config Contract 定義 --status 說「驗證對應 key 仍然有效（非 revoked/disabled）」。Task #15 DoD 第 5 條是「integrate --status — 顯示整合狀態 + fallback chain」。但 spec 完全沒有定義當 key 已被撤銷（revoked）或停用（disabled）時 --status 的行為：(A) 只顯示警告但不改動 config？(B) 自動移除整合並提示？(C) 顯示錯誤要求用戶手動處理？三種行為的用戶體驗完全不同，且無法從現有 DoD 推導。Section 7.1 驗收標準 AC#19 只說「顯示整合狀態 + fallback chain」，也未涵蓋此 error case。`
- impact: `實作者將自行猜測行為，導致 --status 在 key 失效情境下行為不可預測，且 AC#19 無法作為完整驗收依據（只覆蓋 happy path）。`
- fix: `在 Task #15 --status 定義補充 key 失效分支：建議選擇「顯示警告訊息（如 'Warning: integrated key is revoked/disabled. Run integrate --remove to clean up.'）但不自動修改 config」，並在 DoD 新增對應負向 case 的可測試項目。同時在 Section 7.1 AC#19 補充 Given（整合的 key 已被撤銷）的 error path。`

---

### [SR-P1-003] P1 - Task #15 `integrate` 主流程缺少冪等性定義

- id: `SR-P1-003`
- severity: `P1`
- category: `logic`
- file: `Section 5.2 Task #15 DoD`
- line: `DoD 第 1 條`
- rule: `完整性：業務邏輯邊界條件需明確定義`
- evidence: `Task #15 DoD 定義了三個 integrate 主流程分支：(1) 正常注入、(2) OpenClaw 未安裝時顯示指引、(3) 無 provisioned key 時自動建立。但沒有定義第四個分支：當 fallback_chain 中已存在 type === "openclaw-token" 項目時，再次執行 integrate 的行為。對照 Section 3.2 異常流程表（E1~E8）也沒有涵蓋此情境。integrate 的備份/atomic write 機制表明這是「修改操作」，冪等行為直接影響是否會建立重複 fallback_chain 項目。`
- impact: `用戶重複執行 integrate（常見場景：換 key 後重新整合）可能導致 fallback_chain 中出現多個 type === "openclaw-token" 項目，使 OpenClaw 行為不可預期。或實作者加入防護但未測試，在 Task #17 整合測試中才暴露。`
- fix: `在 Task #15 DoD 新增一條：「integrate — 若 fallback_chain 已含 type === "openclaw-token" 項目，先移除再注入新項目（upsert 語意），並顯示提示『Updated existing integration.』」。這也需要在 Section 7.1 補充對應 AC。`

---

### [SR-P2-004] P2 - Task #11 `idempotency_key` 與 Task #3/12 `idempotencyKey` 命名不一致

- id: `SR-P2-004`
- severity: `P2`
- category: `consistency`
- file: `Section 5.2 Task #11 DoD、Task #3 DoD、Task #12 DoD`
- line: `Task #11 DoD 第 3 條、Task #3 DoD 第 8 條、Task #12 DoD 最後一條`
- rule: `Codebase 一致性：命名與既有 codebase 風格一致`
- evidence: `Task #11 DoD 第 3 條：「支援 idempotency_key 防重複」（snake_case）。Task #3 DoD 第 8 條：「post() 方法支援選用 idempotencyKey 選項，自動帶入 Idempotency-Key header」（camelCase）。Task #12 DoD 最後一條：「透過 apiClient.post() 的 idempotencyKey 選項傳入」（camelCase）。Task #11 的 snake_case 措辭與 Task #3/12 的 camelCase TypeScript 選項名稱不一致，可能讓實作 mock handler 的 agent 誤用錯誤的 header 名稱格式。`
- impact: `低風險但確實不一致。mock handler 實作者若照 Task #11 措辭實作，可能預期 header 名稱為 idempotency_key 而非 Idempotency-Key，導致冪等性檢查失效。`
- fix: `Task #11 DoD 第 3 條改為「支援 Idempotency-Key request header 防重複（header 值由 client 端 idempotencyKey 選項傳入）」，明確說明是 HTTP header 名稱而非 TypeScript 選項名稱。`

---

## Summary

- totals: `P0=0, P1=3, P2=1`
- decision: `REJECTED`
