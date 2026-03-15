# Spec Converge Review — Round 5 (FINAL)

> **Date**: 2026-03-15
> **Engine**: fallback (claude-sonnet-4-6)
> **Scope**: spec
> **Input**: spec-current.md (post R4 revision)

---

## Methodology

Reviewed spec-current.md against the following dimensions:
1. R4 modifications (createApiClient store injection, integrate auto-create defaults) introducing new contradictions
2. Cross-referencing all Task DoDs against API types, AC table, and each other
3. Checking R3 modifications (createProgram factory signature, --status warning spec) for carry-over inconsistencies
4. Verifying naming and contract consistency across the entire document

Previous 4 rounds corrected 13 findings (including 3 false positives). Focus is strictly on NEW issues not present in prior rounds.

---

## Findings

### F5-1 [P2] AC #19 missing `disabled` scenario — inconsistent with Task #15 Contract

**Location**:
- Task #15 OpenClaw Config Contract (line ~639): `若 key 已被撤銷或停用，顯示警告 Warning: integrated key <hash> is revoked/disabled.`
- Task #15 DoD (line ~650): `若整合的 key 已被撤銷/停用，顯示警告但不自動修改 config`
- AC #19 (line ~762): `顯示整合狀態 + fallback chain；若 key 已撤銷則顯示警告`

**Evidence**: AC #19 only mentions the `revoked` (撤銷) scenario. Task #15 Contract and DoD both explicitly cover `revoked` AND `disabled` (停用). R3 corrected Task #15 but did not sync AC #19.

**Impact**: Low. Implementation will follow Task #15 (more complete), but AC #19 as written cannot verify the `disabled` path during acceptance testing. A tester reading only the AC table would not know to test the disabled-key warning.

**Fix**: Update AC #19 to: `顯示整合狀態 + fallback chain；若 key 已被撤銷或停用，顯示警告`

---

### F5-2 [P2] `createProgram` call signature inconsistency between Task #7 and Task #17

**Location**:
- Task #7 DoD (line ~501): `匯出 createProgram(options?: { store?: MockStore }): Command factory function`
- Task #17 description (line ~679): `透過 program factory（createProgram(mockStore)）直接在 vitest 程序內初始化 Commander instance，注入共享的 MockStore 實例`

**Evidence**: Task #7 defines an options-object signature `createProgram(options?: { store?: MockStore })`. Task #17 describes calling it as `createProgram(mockStore)` — passing a MockStore directly as the first argument, not wrapped in an options object. These two signatures are incompatible.

**Impact**: Low. The actual implementation will resolve this, but a developer following Task #17's description literally will write code that does not match the Task #7 interface contract. This creates unnecessary confusion and risks a type error if TypeScript strict mode is enforced.

**Fix**: Align Task #17 to use the correct call syntax: `createProgram({ store: mockStore })`.

---

## Summary

No P0 or P1 findings. Two P2 documentation inconsistencies identified, both introduced by partial updates in prior revision rounds (R3 corrected Task #15 content but did not back-propagate to AC #19; Task #7 and Task #17 use different call-syntax notation for the same factory function).

Neither finding blocks implementation. The spec is functionally sound and internally coherent at the P0/P1 level.

```
totals: P0=0, P1=0, P2=2
decision: APPROVED
```

> **Note on APPROVED with P2 findings**: Per the review protocol, APPROVED requires P0=0 and P1=0. The two P2 findings are documentation consistency issues that do not affect implementation correctness. Fixing them is recommended but not blocking. The spec is approved to proceed to S3.
