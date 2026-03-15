import { defineConfig } from 'vitest/config';

// 預設設定：排除 contract tests，確保 npm test 只跑原有 173 個單元與整合測試
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 排除 contract tests 目錄，contract tests 使用獨立設定檔執行
    exclude: ['tests/contract/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'bin/**'],
    },
  },
});
