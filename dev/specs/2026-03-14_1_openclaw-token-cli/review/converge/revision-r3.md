# Round 3 修正摘要

## 修正項目（3 項 P1 + 1 項 P2）

### [SR-P1-001] Task #7 缺 createProgram() factory DoD
- **修正**: 在 Task #7 DoD 新增一條：匯出 `createProgram(options?: { store?: MockStore }): Command` factory function，供整合測試注入 MockStore。同步更新 verbose 輸出引用 Task #4 的 redactSecret()。

### [SR-P1-002] Task #15 --status key 失效行為未定義
- **修正**: 在 OpenClaw Config Contract 的 --status 定義補充：key 已撤銷/停用時顯示警告但不自動修改 config。Task #15 DoD 同步更新。AC#19 補充 error path。

### [SR-P1-003] Task #15 integrate 冪等性未定義
- **修正**: 在 Task #15 DoD 新增一條：若 fallback_chain 已含 type === "openclaw-token" 項目，先移除再注入（upsert 語意），顯示 "Updated existing integration."。

### [SR-P2-004] idempotency_key 命名不一致
- **修正**: Task #11 DoD 改為明確引用 `Idempotency-Key` HTTP header 名稱，並說明與 client 端 `idempotencyKey` 選項的關係。
