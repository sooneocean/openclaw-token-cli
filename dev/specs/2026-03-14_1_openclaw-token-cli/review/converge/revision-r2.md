# Round 2 修正摘要

## 修正項目（2 項 P1）

### [SR-P1-001] stateless 策略與 login 密碼驗證矛盾
- **修正**: 在 Task #8 補充 Login 例外規則：`POST /auth/login` 不適用 stateless 策略，改用約定固定 demo 密碼（`demo-password`）驗證，密碼不符回傳 401。同步更新 Task #9 描述，明確 login 使用 demo 密碼驗證。

### [SR-P1-002] redactSecret() 保留字元數不一致
- **修正**: 統一 Task #4 `redactSecret()` 為「保留前 8 char + 末 4 char，總長 <= 12 時全遮蔽」，標記為 single source of truth。移除 Task #7 中的重複遮蔽規格描述，改為引用 Task #4 的 `redactSecret()`。
