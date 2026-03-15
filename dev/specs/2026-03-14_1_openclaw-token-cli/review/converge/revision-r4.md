# Round 4 修正摘要

## 修正項目（1 項 P1 + 1 項 P2）

### [SR-P1-01] createApiClient() 與 MockStore wiring 缺失
- **修正**: Task #3 DoD 第 1 條更新 `createApiClient({ mock: true, store?: MockStore })` 簽名，明確 store 注入路徑。搭配 Task #7 的 `createProgram(options?: { store?: MockStore })` 形成完整 DI 鏈：createProgram → createApiClient → mock adapter → MockStore。

### [SR-P2-01] integrate auto-create key 的 name 決策未定義
- **修正**: Task #15 DoD 補充：自動建立時預設 name 為 `openclaw-integration`，credit_limit 為 null（無限制），不 prompt 用戶。
