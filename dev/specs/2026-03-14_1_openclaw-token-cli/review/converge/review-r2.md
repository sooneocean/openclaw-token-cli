### [SR-P1-001] P1 - Task #8 stateless 策略與 Task #9 login 密碼驗證邏輯矛盾

- id: `SR-P1-001`
- severity: `P1`
- category: `logic`
- file: `Section 5.2 Task #8, Task #9`
- line: `N/A`
- rule: `完整性：技術決策有理由、有替代方案考量；各層職責清晰，不越界`
- evidence: `Task #8 明確定義「Mock 採用 stateless demo account 策略：認證驗證改為 token 格式驗證（sk-mgmt-<uuid> 格式即視為有效），不做 store lookup」。但 Task #9 DoD 要求「POST /auth/login — 密碼錯：401」，且 Task #9 描述說「Login 驗證 email + password」。若 stateless 模式不做 store lookup，則無法從哪裡取得「正確密碼」來比對，密碼錯 401 的邏輯無從實作。`
- impact: `實作者面對矛盾設計，將各自猜測解法：有人可能跳過密碼驗證（永遠成功），有人可能 hardcode 密碼，導致 mock handler 行為不可預測。驗收標準 AC#3（登入失敗）也因此無法可靠測試。`
- fix: `在 Task #9 明確說明 login mock 的密碼驗證策略：選項 A — stateless 模式接受任何密碼（login 總是成功，AC#3 不適用 mock 模式）；選項 B — 約定固定 demo 密碼（如 `demo-password`），密碼不符回傳 401。選擇其中一個，並在 Task #8 補充 login 例外規則。`

### [SR-P1-002] P1 - Task #7 verbose 遮蔽規格與 Task #4 redactSecret() 定義不一致

- id: `SR-P1-002`
- severity: `P1`
- category: `consistency`
- file: `Section 5.2 Task #4, Task #5, Task #7`
- line: `N/A`
- rule: `Codebase 一致性：命名與既有 codebase 風格一致；各層職責清晰，不越界`
- evidence: `Task #4 定義 `redactSecret(secret: string): string`：「保留前 12 char + 末 4 char，總長 <= 16 時全遮蔽為 ****」。Task #5 DoD 說 `formatVerboseRequest()` 對 Authorization header 執行 `redactSecret()`。但 Task #7 描述另外寫了不同規格：「Authorization 遮蔽為 sk-mgmt-****...****（保留前 8 碼、後 4 碼）」。前 8 碼 vs 前 12 char 不一致，且 Task #7 的格式模板（sk-mgmt-****...****）暗示保留前綴 `sk-mgmt-`（8 chars），但這與 Task #4 generic 的「前 12 char」語意衝突。兩個描述均出現在 spec 中，沒有說哪個優先。`
- impact: `實作者可能產出不一致的遮蔽輸出，尤其 Task #5 和 Task #7 都描述 verbose 輸出遮蔽，卻給出不同規格。審查 verbose 輸出時也無法確定哪個格式才算通過驗收。`
- fix: `統一在 Task #4 定義 `redactSecret()` 為單一 source of truth，更新規格為「保留前 12 char + 末 4 char」或「保留前 8 char + 末 4 char」，選定一個並移除 Task #7 中的重複規格描述。Task #5 和 Task #7 均引用 Task #4 的函式。`

## Summary

- totals: `P0=0, P1=2, P2=0`
- decision: `REJECTED`
