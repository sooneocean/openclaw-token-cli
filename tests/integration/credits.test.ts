/**
 * Integration test: Credits flow
 *
 * 測試策略：使用 CreditsService + mock 模式，設定 OPENCLAW_TOKEN_KEY env var
 * 提供合法的 management key，不需要先 login。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CreditsService } from '../../src/services/credits.service.js';
import { mockStore } from '../../src/mock/store.js';

// 確保 mock handlers 已載入
import '../../src/mock/index.js';

// 使用 MockStore 合法格式的 token（會對應到 demo@openclaw.dev）
const DEMO_TOKEN = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('Credits 完整流程', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-integration-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    process.env.OPENCLAW_TOKEN_KEY = DEMO_TOKEN;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('balance → buy → history 完整流程', async () => {
    const service = new CreditsService({ mock: true });

    // --- balance（初始）---
    const initialBalance = await service.balance(DEMO_TOKEN);
    expect(initialBalance.total_credits).toBe(100); // demo 帳號預設 100 credits
    expect(initialBalance.total_usage).toBe(0);
    expect(initialBalance.remaining).toBe(100);

    // --- buy $25 ---
    const purchaseResult = await service.buy(DEMO_TOKEN, 25);
    expect(purchaseResult.amount).toBe(25);
    expect(purchaseResult.new_balance).toBe(125); // 100 + 25
    expect(purchaseResult.transaction_id).toMatch(/^txn_/);
    expect(purchaseResult.platform_fee).toBeGreaterThan(0);

    // --- balance（購買後）---
    const balanceAfterBuy = await service.balance(DEMO_TOKEN);
    expect(balanceAfterBuy.total_credits).toBe(125);
    expect(balanceAfterBuy.remaining).toBe(125);

    // --- history ---
    const history = await service.history(DEMO_TOKEN);
    expect(history.items.length).toBeGreaterThan(0);
    const latestTxn = history.items[history.items.length - 1];
    expect(latestTxn.type).toBe('purchase');
    expect(latestTxn.amount).toBe(25);
  });

  it('buy 金額 < 5 應拋出錯誤', async () => {
    const service = new CreditsService({ mock: true });
    await expect(service.buy(DEMO_TOKEN, 4)).rejects.toThrow();
  });

  it('history 可篩選 type', async () => {
    const service = new CreditsService({ mock: true });

    // 先買一些 credits 產生 transaction
    await service.buy(DEMO_TOKEN, 10);

    const history = await service.history(DEMO_TOKEN, { type: 'purchase' });
    expect(history.items.every((t) => t.type === 'purchase')).toBe(true);
  });

  it('history limit/offset 分頁', async () => {
    const service = new CreditsService({ mock: true });

    // 購買 3 次
    await service.buy(DEMO_TOKEN, 5);
    await service.buy(DEMO_TOKEN, 10);
    await service.buy(DEMO_TOKEN, 15);

    const page1 = await service.history(DEMO_TOKEN, { limit: 2, offset: 0 });
    expect(page1.items.length).toBe(2);

    const page2 = await service.history(DEMO_TOKEN, { limit: 2, offset: 2 });
    expect(page2.items.length).toBe(1);
  });
});
