# R1 Code Review Findings

## Summary
- P0 (Critical): 2
- P1 (Blocking): 7
- P2 (Suggestion): 3

---

## Findings

### [P0] CR-001: OAuth device/token 直接回傳 GitHub access_token，未產生 server session token
**檔案**: `src/routes/oauth.ts:145-150`
**描述**: Spec 明確規定 `POST /oauth/device/token` 成功時應回傳 **server 產生的 session token**（不是 GitHub token）。但實作直接將 GitHub 的 `access_token` 原封不動回傳給 client。
**預期行為**: Server 應產生自己的 session token（例如 `ost-xxx`），將其與 GitHub access_token 的映射存入 DB，僅回傳 server session token。
**實際行為**: 第 138 行 `const accessToken = ghResponse.access_token;` 直接存入 DB 並回傳給 client，等同將 GitHub 原始 token 洩漏給前端。
**修正建議**: 產生獨立的 server session token，DB 中保留 GitHub token 與 session token 的映射，response 只回傳 server session token。

### [P0] CR-002: OAuth userinfo 使用 authMiddleware（management key 驗證），而非 OAuth session token 驗證
**檔案**: `src/routes/oauth.ts:154`
**描述**: Spec 明確規定 `GET /oauth/userinfo` 的 Auth 是 `Bearer oauth session token`（非 management key）。但實作使用 `authMiddleware(sql)`，該 middleware 查的是 `management_keys` 表。
**預期行為**: 應用獨立的 OAuth session token middleware，從 `oauth_sessions` 表查 session token 驗證身份。
**實際行為**: 使用 management key 驗證，完全違反 API 合約。OAuth 登入流程中，用戶此時可能根本還沒有 management key（新用戶首次登入場景）。
**修正建議**: 建立獨立的 `oauthAuthMiddleware`，從 Bearer token 查 `oauth_sessions` 表驗證身份。

### [P1] CR-003: OAuth device/code 錯誤碼不符合 Spec
**檔案**: `src/routes/oauth.ts:22`
**描述**: Spec 規定 client_id 不匹配時回傳 error code `INVALID_CLIENT_ID`。
**預期行為**: `{ error: { code: "INVALID_CLIENT_ID", message: "..." } }`，HTTP 400。
**實際行為**: 回傳 `{ error: { code: "INVALID_INPUT", message: "Invalid client_id" } }`。error code 是 `INVALID_INPUT` 而非 `INVALID_CLIENT_ID`。
**修正建議**: 將 error code 改為 `INVALID_CLIENT_ID`。

### [P1] CR-004: GET /keys/:hash 的 usage_weekly 乘數不符合 Spec
**檔案**: `src/routes/keys.ts:115`
**描述**: Spec 規定 `usage_weekly = usage * 0.6`，但實作使用 `usage * 0.45`。
**預期行為**: `usage_weekly: Math.round(usage * 0.6 * 100) / 100`
**實際行為**: `usage_weekly: Math.round(usage * 0.45 * 100) / 100`
**修正建議**: 將乘數從 `0.45` 改為 `0.6`。

### [P1] CR-005: GET /keys/:hash 的 requests_count 乘數不符合 Spec
**檔案**: `src/routes/keys.ts:117`
**描述**: Spec 規定 `requests_count = usage * 40`，但實作使用 `usage * 100`。
**預期行為**: `requests_count: Math.floor(usage * 40)`
**實際行為**: `requests_count: Math.floor(usage * 100)`
**修正建議**: 將乘數從 `100` 改為 `40`。

### [P1] CR-006: GET /keys/:hash 的 model_usage requests 分配不符合邏輯一致性
**檔案**: `src/routes/keys.ts:119-121`
**描述**: 兩個 model 各佔 `usage * 50` requests，加總為 `usage * 100`。但 CR-005 指出 spec 定義 `requests_count = usage * 40`。若 requests_count 修正為 40，model 的 requests 加總也必須為 40（每個 model 各 20），否則 model_usage 和 requests_count 自相矛盾。
**預期行為**: 每個 model 的 requests 各為 `usage * 20`，tokens 與 cost 的比例也需相應調整。
**實際行為**: 每個 model `usage * 50`，加總 100，與 requests_count 應為 40 矛盾。
**修正建議**: 調整 model_usage 的 requests 為 `usage * 20`，確保加總等於 `requests_count`。

### [P1] CR-007: POST /keys 產生的 key 格式：`sk-prov-{32 hex}` 看似正確，但需確認 randomBytes(16)
**檔案**: `src/utils/token.ts:8`
**描述**: `randomBytes(16).toString('hex')` 產生 32 個 hex 字元，符合 spec `sk-prov-{32 hex}`。hash = SHA-256 前 16 hex 也正確（第 12 行 `.slice(0, 16)`）。
**預期行為**: key format `sk-prov-{32 hex}`, hash = SHA-256 前 16 hex。
**實際行為**: 符合 spec。
**結論**: ✅ 此項通過。（保留記錄作為審查證據）

### [P1] CR-008: OAuth device/token 的 error response 格式不符合全域慣例
**檔案**: `src/routes/oauth.ts:71, 81, 88, 121, 124, 128, 134`
**描述**: 通用 error 格式為 `{ error: { code, message } }`，但 `device/token` 端點使用 RFC 8628 風格的 `{ error: "...", error_description: "..." }`。Spec 中雖然允許 OAuth pending 狀態使用此格式（因為 client 需要辨識 `authorization_pending`、`slow_down`），但 bad_device_code、expired_token 等 error 應統一用系統格式。
**預期行為**: 非 OAuth-specific 錯誤（如 bad_device_code）應使用 `{ error: { code, message } }` 格式。
**實際行為**: 所有錯誤都用 `{ error: "string", error_description: "string" }` 扁平格式。
**修正建議**: 區分 OAuth polling 中繼狀態（`authorization_pending`、`slow_down` 可保留 RFC 格式）與真正的錯誤（`bad_device_code`、`expired_token` 應用系統格式）。此項有商議空間，降為 P1 偏 P2。

### [P1] CR-009: Login 的 password 驗證在 transaction 之外，存在 TOCTOU 風險
**檔案**: `src/routes/auth.ts:67-95`
**描述**: Login 流程先查詢 user 並驗證密碼（67-78 行），然後才進入 transaction 去 revoke 舊 key 並產生新 key（83-95 行）。密碼驗證和 key 操作不在同一個 transaction 中。
**預期行為**: 密碼驗證結果與 key 操作應在同一 transaction 或有一致性保障。
**實際行為**: 理論上在驗證與 revoke 之間，另一個 login 請求可能已經 revoke 了舊 key 並產生新 key，導致兩個併發 login 都成功，各自產生一把 active key。雖然後一個 login 仍然有效（D1 語義是 revoke 所有舊 key + 產新 key），但存在短暫窗口期兩把 key 同時有效。
**修正建議**: 將整個 login（含查詢 + 驗證 + revoke + insert）包在同一個 transaction 中，或使用 `SELECT ... FOR UPDATE` 鎖定 user row。

### [P1] CR-010: credits/purchase 的 idempotency 檢查與實際購買不在同一 transaction 中
**檔案**: `src/routes/credits.ts:43-63`
**描述**: Idempotency key 的檢查在 transaction 外（43-63 行），然後購買在另一個 transaction（67-84 行）。兩個相同 idempotency key 的併發請求可能同時通過檢查（都沒找到 existing），然後都執行購買。
**預期行為**: Idempotency 檢查與購買操作應在同一 transaction 中，或依賴 DB unique constraint 做衝突偵測。
**實際行為**: Race condition 可能導致重複扣款。DB 若有 `idempotency_key` 的 unique constraint 可以擋住（23505），但 error handler 會回傳 generic `CONFLICT` 而非正確的冪等回應。
**修正建議**: 將 idempotency 檢查放入同一 transaction，或在 catch 23505 時改為查詢既有交易並回傳正確結果。

### [P2] CR-011: PATCH /keys/:hash 不驗證 updates 是否為空
**檔案**: `src/routes/keys.ts:140-147`
**描述**: 若 body 中沒有 `credit_limit`、`limit_reset`、`disabled` 任何一個欄位，`updates` 物件為空，`sql(updates)` 可能產生無效 SQL 或意外行為。
**預期行為**: 空 body 應回傳 400 或直接回傳當前狀態。
**實際行為**: 空 updates 物件傳入 `sql()` template helper，行為取決於 postgres.js 的實作，可能拋出異常或產生無效 SQL。
**修正建議**: 在 `Object.keys(updates).length === 0` 時提早回傳或拋出 400。

### [P2] CR-012: OAuth userinfo 的 unlinked session 邏輯有安全風險
**檔案**: `src/routes/oauth.ts:171-179`
**描述**: 當找不到與 user 關聯的 session 時，會取「任何一個」unlinked 且 authorized 的 session 並將其綁定到當前用戶。這代表用戶 A 的 OAuth session 可能被用戶 B（先通過 management key 驗證）搶走。
**預期行為**: 應有明確的 session 與用戶綁定機制，例如在 device/token 成功時就綁定。
**實際行為**: 搶到最新 unlinked session 的 management key 持有者獲得該 session 的 GitHub token。多用戶環境下可能導致帳號錯誤綁定。
**修正建議**: 在 `device/token` 成功後就通過 GitHub user info 確認身份並綁定，而非在 `userinfo` 端點懶綁定。

### [P2] CR-013: error handler 中的 PG 23505 被 keys.ts 自行 catch 後可能重複處理
**檔案**: `src/middleware/error.ts:10-15` & `src/routes/keys.ts:45-50`
**描述**: `POST /keys` 已自行 catch 23505 並拋出 `KEY_NAME_EXISTS` AppError。但 error handler 也攔截 23505 回傳 generic `CONFLICT`。當前不衝突是因為 keys.ts 先 catch 了。但若未來其他路由有 23505 且需要特定 error code，error handler 的 generic 處理會吃掉細節。
**預期行為**: 各路由若需特定 error code 應自行處理 23505。
**實際行為**: 目前運作正常，但 error handler 的 23505 catch-all 是潛在陷阱。
**修正建議**: 考慮移除 error handler 中的 23505 通用處理，改由各路由自行處理，避免未來遺漏。
