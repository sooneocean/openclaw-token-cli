# S0 Brief Spec — 技術升級 v0.8.0

## 1. 一句話描述

升級所有 dependencies 至最新版本、移除死依賴、清理架構冗餘。

## 2. 工作類型

`refactor`

## 3. 痛點

- Dependencies 多處落後 2+ major versions（commander 12→14, vitest 2→4, zod 3→4）
- `inquirer@^9.3.0` 是死依賴（程式碼只用 `@inquirer/prompts`）
- `@types/which` 可能多餘（新版 `which` 可能自帶 types）

## 4. 目標

將所有 dependencies 升級到最新穩定版，移除不必要的套件，確保 173 測試全過。

## 4.0 功能區拆解

| FA ID | 名稱 | 描述 | 獨立性 |
|-------|------|------|--------|
| FA-SafeUpgrade | 安全升級 | Minor/patch 版本升級（axios, chalk, tsup, tsx, typescript） | high |
| FA-MajorUpgrade | Major 升級 | Breaking change 套件升級（commander 14, vitest 4, zod 4, ora 9, which 6, execa 9, @types/node 25） | medium |
| FA-Cleanup | 依賴清理 | 移除 inquirer、@types/which（如不需要） | high |

拆解策略：`single_sop_fa_labeled`

## 5. 成功標準

- 所有 dependencies 升級至最新穩定版
- 移除 `inquirer` 死依賴
- 173 既有測試全部通過
- `npm run build` 成功
- `npm run typecheck` 通過
- 無新增 `any` type hack

## 6. 範圍

### 範圍內
- package.json dependencies/devDependencies 版本升級
- 因 breaking change 需要修改的程式碼
- 移除未使用的依賴
- 測試程式碼因 API 變更的調整

### 範圍外
- 新增功能
- 架構大改（如換掉 axios → fetch）
- 新增測試
- CI/CD 變更

## 7. 約束

- 不改變任何外部行為
- 如果某個 major 升級導致大量 breaking change（>20 處修改），評估是否值得，可先跳過
- 升級順序：先安全升級 → 再 major → 最後清理

## 8. 例外探測

- E1（資料邊界）：zod 4 schema API 變了？ → 需逐一檢查所有 z.xxx 用法
- E2（外部依賴）：commander 14 有無移除我們用到的 API？ → 查 changelog
- E3（狀態轉換）：vitest 4 config format 有無變？ → 檢查 vitest.config.ts 相容性
- E4（業務邏輯）：ora 9 spinner API 變了？ → 檢查所有 spinner 用法
