### [SR-P1-001] P1 - 任務清單缺少可測試 DoD，無法直接進入實作

- id: `SR-P1-001`
- severity: `P1`
- category: `test`
- file: `Section 5.2 任務詳情`
- line: `N/A`
- rule: `完整性：每個任務都有可測試的 DoD`
- evidence: `Section 5.2 只有 "(See full task details in spec sections Task #1 through Task #18)"，但本份待審查 spec 內沒有 Task #1~#18 的實際子章節，也沒有任何任務的 DoD、交付物或測試對應。`
- impact: `S3/S4 無法把 18 個任務轉成可驗證的工作項，實作者也無法判定何時算完成，容易造成範圍漂移與驗收爭議。`
- fix: `為每個 Task 補上獨立小節，至少定義 deliverables、DoD、依賴、測試點、對應 FA/驗收標準。`

### [SR-P1-002] P1 - 驗收標準只宣稱存在，實際未列出內容

- id: `SR-P1-002`
- severity: `P1`
- category: `test`
- file: `Section 7.1 功能驗收`
- line: `N/A`
- rule: `完整性：驗收標準使用 Given-When-Then，覆蓋 happy + error path；S0 成功標準可追溯到任務/驗收標準`
- evidence: `Section 7.1 只寫「23 項驗收標準，覆蓋 FA-A (6), FA-B (5), FA-C (5), FA-D (3), 全域 (4)。所有標準使用 Given-When-Then 格式」，但整份 spec 沒有列出任何一條實際驗收案例，也沒有任務對照。`
- impact: `無法確認 happy path 與 E1~E8 例外流程是否真的被驗收覆蓋，後續 review 與 test 階段缺少可執行的 gate。`
- fix: `逐條列出 23 項 Given-When-Then 驗收標準，標記所屬 FA、對應 Task，並註明覆蓋的例外流程。`

### [SR-P1-003] P1 - FA-D 整合功能缺少可實作的設定契約

- id: `SR-P1-003`
- severity: `P1`
- category: `architecture`
- file: `Section 3.1 主要流程 / Section 5.1 Task 15 / Section 8 風險與緩解`
- line: `N/A`
- rule: `完整性：技術決策有理由、有替代方案考量；風險與影響：相依關係與回歸風險需可落地評估`
- evidence: `Spec 只描述「偵測 OpenClaw → 注入 fallback config → 驗證」，Task #15 也只有 Integrate Service + Command；但整份 spec 沒定義 OpenClaw 設定檔路徑、檔案格式、要注入的 provider/fallback schema、--status 判定規則、備份與 rollback 行為。`
- impact: `FA-D 是核心功能，但目前不同實作者可能各自猜測整合格式，導致注入結果不相容，也無法可靠實作 --remove/--status 或跨平台驗證。`
- fix: `補上 OpenClaw config contract：路徑解析規則、檔案格式、schema mutation 範例、備份命名、衝突處理、rollback 流程與 status 檢查準則。`

### [SR-P1-004] P1 - Login API 缺少 response schema，FA-A 契約不完整

- id: `SR-P1-004`
- severity: `P1`
- category: `consistency`
- file: `Section 4.2 API 契約摘要 / Section 4.3 API Response Types`
- line: `N/A`
- rule: `Codebase 一致性：提到的 endpoint 名稱存在或明確標為新建；完整性：資料契約需足夠支撐實作`
- evidence: `Section 4.2 定義了 POST /auth/login「登入取得 Management Key」，Task #10 也要求 login 指令；但 Section 4.3 只定義 AuthRegisterResponse 與 AuthMeResponse，沒有 AuthLoginResponse，也沒有說 login 是否重用 register 回應格式。`
- impact: `實作者無法確定 login 成功後應解析哪些欄位、更新哪些 config 欄位，容易讓 register/login 行為分歧或遺漏必要持久化。`
- fix: `明確定義 AuthLoginResponse，並寫清楚 login 對 config 的更新語意與與 register 的差異。`

### [SR-P1-005] P1 - 風險章節只有標題式摘要，沒有緩解內容

- id: `SR-P1-005`
- severity: `P1`
- category: `architecture`
- file: `Section 8 風險與緩解`
- line: `N/A`
- rule: `風險與影響：回歸風險、相依關係、安全性影響、效能影響已評估`
- evidence: `Section 8 只有一句「5 項風險已評估（ESM import、CI TTY、Mock/Real 不一致、OpenClaw config 變更、Windows atomic write）」；沒有逐項說明觸發條件、影響、緩解措施、驗證方式或殘餘風險。`
- impact: `目前無法判斷 spec 是否真的處理跨平台檔案寫入、TTY 差異與 mock/real 漂移等關鍵問題，也無法把這些風險轉成實作與測試工作。`
- fix: `把 5 項風險展開成表格，至少包含 trigger、impact、mitigation、validation/test。`

### [SR-P2-006] P2 - `--no-color` 需求未落到輸出設計契約

- id: `SR-P2-006`
- severity: `P2`
- category: `consistency`
- file: `Section 1.2 技術方案摘要 / Section 5.1 Task 5、Task 7 / Section 7.2 非功能驗收`
- line: `N/A`
- rule: `完整性：非功能需求需可追溯到設計與任務`
- evidence: `Section 7.2 要求「所有指令支援 --json 和 --no-color」，但 Section 1.2 與 Task 5/7 只明確描述 human-readable 與 --json 輸出，沒有定義 --no-color 如何關閉 chalk、ora 或其他終端樣式輸出。`
- impact: `容易在 CI、non-TTY 或 log 擷取場景殘留 ANSI/spinner 控制碼，直到驗收階段才暴露不符合需求。`
- fix: `在 global flags 與 output module 補上 --no-color contract，定義 chalk level、spinner disable、table/plain fallback 與對應測試案例。`

## Summary

- totals: `P0=0, P1=5, P2=1`
- decision: `REJECTED`