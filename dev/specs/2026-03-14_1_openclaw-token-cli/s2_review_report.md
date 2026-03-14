# S2 Spec Review Report: OpenClaw Token CLI

> **階段**: S2 對抗式審查
> **日期**: 2026-03-14
> **Spec Mode**: Full Spec
> **結果**: Conditional Pass → 修正後 Pass

---

## 審查摘要

| 指標 | 值 |
|------|-----|
| 總發現數 | 5 |
| P0 (阻斷) | 0 |
| P1 (重要) | 2 |
| P2 (次要) | 3 |
| 修正狀態 | 全部已修正 |

Greenfield 專案，Phase 0 預審跳過（無既有 codebase）。R1 挑戰 → R2 防禦 → R3 裁決，無爭議。

---

## 問題清單與處置

### SR-001 (P1) MockStore 生命週期設計缺陷

- **問題**: Task #8 MockStore 為 in-process in-memory，每次 CLI 執行重置。跨指令 mock 流程斷裂（register → buy credits 時第二次 CLI 啟動 store 已重置）。
- **R1**: 建議 mock handler 接受任何 `sk-mgmt-*` 格式 token 為有效認證
- **R2**: agree，補充精確定義：stateless demo account 策略
- **R3**: 採納。修正 Task #8 + Task #9 DoD。
- **修正**: Task #8 新增「stateless demo account」策略描述 + 格式驗證 DoD；Task #9 GET /auth/me 改為格式驗證

### SR-002 (P1) 撤銷已 revoked key HTTP status 不一致

- **問題**: dev_spec Task #13 寫 404，api_spec 寫 410 `KEY_ALREADY_REVOKED`
- **R1/R2**: 一致同意 api_spec 是 source of truth
- **R3**: 採納。統一為 410。
- **修正**: Task #13 DoD 改為 410；Task #4 DoD 補充 410 error mapping

### SR-003 (P2) Management key prefix 不精確

- **問題**: Task #9 寫 "sk-開頭"，api_spec 定義 `sk-mgmt-` prefix
- **修正**: Task #9 DoD 精確化為 `sk-mgmt-<uuid-v4>`

### SR-004 (P2) --verbose 無實作細節

- **問題**: 全域 flag 但無 task 定義其行為
- **R2**: 部分同意，建議降為 P3
- **R3**: 維持 P2，補充規格
- **修正**: Task #7 描述補充 verbose 輸出規格（method+path+status+latency, stderr, key 遮蔽）

### SR-005 (P2) OPENCLAW_TOKEN_KEY 覆蓋機制不明確

- **問題**: env var 是否繞過 config？其他欄位如何處理？
- **修正**: Task #2 描述補充 config 欄位優先序（env > config > default）+ `ConfigManager.resolve()` DoD

---

## 完整性評分

| 維度 | 分數 (1-5) | 備註 |
|------|-----------|------|
| S0→S1 需求覆蓋 | 5/5 | 所有 FA + 例外全數覆蓋 |
| API 一致性 | 4/5 | 修正後一致（原有 410 vs 404 矛盾） |
| 任務完整性 | 4/5 | 修正後完整（原缺 verbose 定義 + env var 機制） |
| 風險識別 | 4/5 | MockStore 生命週期風險原未識別 |
| 可實作性 | 5/5 | Greenfield + 成熟技術棧，無架構障礙 |

---

## 審查軌跡

| 輪次 | 角色 | Agent | 說明 |
|------|------|-------|------|
| Phase 0 | 預審 | (skipped) | Greenfield 專案，無 codebase |
| R1 | 挑戰者 | orchestrator | 獨立審查，發現 5 個 findings |
| R2 | 防禦者 | architect (sonnet) | 全部 agree/partial agree |
| R3 | 裁決者 | orchestrator | 採納全部，應用修正 |
