# Pitfalls Registry

> 自動追加於 S5/S6/S7 階段。詳見 sop-full-spec.md 知識管理章節。

## cli/mock

### P-CLI-001: sk-mgmt- token format requires strict hex UUID
**來源**: openclaw-token-cli (2026-03)

Do not use mnemonic chars like 'demo' in management key — mock auth validation will fail.

**Mitigation**: S3 implementation plan must specify exact token format and provide conforming fixture values.

---

## cli/axios

### P-CLI-002: Axios request interceptors execute in reverse registration order (LIFO)
**來源**: openclaw-token-cli (2026-03)

Setting auth headers in a separate interceptor registered after the mock adapter interceptor means the auth header is set before mock adapter runs, causing it to be missing.

**Mitigation**: Set auth headers in the same interceptor that reads them, or explicitly account for LIFO ordering.

---

## cli/testing

### P-CLI-003: Mock handlers must use router-injected store, not module-level singleton
**來源**: openclaw-token-cli (2026-03)

Module-level singleton store breaks test isolation — each test suite shares state across tests.

**Mitigation**: Pass store as a parameter to mock handler factory functions; reset per test in beforeEach.

---

## cli/architecture

### P-CLI-004: 工具函式跨模組重複定義
**來源**: openclaw-token-cli (2026-03)

Greenfield CLI 專案容易在多個模組中各自定義相同工具函式（如 redact、format），S4 完成後 S5 才發現。

**Mitigation**: S3 實作計畫中對每個 utils 函式明確標記 owner 模組；S5 Code Review 必須掃描同名 export。

---

## vitest

### P-CLI-005: vitest v4 spy/mock 狀態跨測試持久化
**來源**: tech-upgrade (2026-03)

vitest v4 改變了 spy 的生命週期行為，mock calls 跨測試持久化（vitest v2 不會）。若未在 beforeEach 加 `vi.restoreAllMocks()`，後續測試的 spy call count 會包含前一個測試的呼叫，導致 assertion 失敗。

**Mitigation**: 升級 vitest v2→v4 時，在 `vitest.config.ts` 設定 `restoreMocks: true`，或在每個用到 spy 的 describe block 的 `beforeEach` 加上 `vi.restoreAllMocks()`。

---
