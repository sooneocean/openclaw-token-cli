import { defineConfig } from 'vitest/config';

// Contract tests 專用設定：只執行 .contract.test.ts 檔案
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 只跑 contract tests
    include: ['tests/contract/**/*.contract.test.ts'],
  },
});
