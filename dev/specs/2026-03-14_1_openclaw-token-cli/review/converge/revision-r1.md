# Round 1 修正摘要

## 合法修正（2 項 P1 + 1 項 P2）

### [SR-P1-003] FA-D OpenClaw Config Contract
- **修正**: 在 Task #15 補上完整 OpenClaw Config Contract，包含：路徑解析規則、注入 schema、--remove/--status 判定邏輯、備份命名、衝突偵測、rollback 流程、未知欄位保留策略。

### [SR-P1-004] 缺 AuthLoginResponse
- **修正**: 在 Section 4.3 API Response Types 補上 `AuthLoginResponse` interface，包含 management_key、email、last_login 三個欄位，明確與 AuthRegisterResponse 的差異。

### [SR-P2-006] --no-color 設計契約不完整
- **修正**: 在 Task #5 DoD 擴充 --no-color 行為規格：chalk level=0、ora spinner 降級純文字、cli-table3 無框線 style。

## 誤報排除（3 項 P1）

### [SR-P1-001] 任務清單缺少可測試 DoD — 誤報
- **原因**: review-input-r1.md 組裝時截斷了 Section 5.2，實際 spec 包含完整 18 個 Task 的 DoD。

### [SR-P1-002] 驗收標準未列出 — 誤報
- **原因**: review-input-r1.md 組裝時截斷了 Section 7.1，實際 spec 包含完整 23 條 Given-When-Then 驗收標準。

### [SR-P1-005] 風險章節摘要化 — 誤報
- **原因**: review-input-r1.md 組裝時截斷了 Section 8，實際 spec 包含完整風險表格（5 項含 trigger/impact/mitigation）。
