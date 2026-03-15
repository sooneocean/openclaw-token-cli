import type { MockRouter, MockRequest, MockResponse } from '../handler.js';
import type { MockStore } from '../store.js';
import { requireValidToken } from '../utils.js';

function calculatePlatformFee(amount: number): number {
  return Math.round(Math.max(amount * 0.055, 0.80) * 100) / 100;
}

export function registerCreditsHandlers(router: MockRouter): void {
  router.register('GET', '/credits', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const credits = store.credits.get(result) || { total_credits: 0, total_usage: 0 };
    return {
      status: 200,
      data: { data: { total_credits: credits.total_credits, total_usage: credits.total_usage, remaining: credits.total_credits - credits.total_usage } },
    };
  });

  router.register('POST', '/credits/purchase', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const body = req.body as { amount?: number } | undefined;
    if (!body?.amount || body.amount < 5) {
      return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Amount must be >= $5.00' } } };
    }

    const idempotencyKey = req.headers?.['Idempotency-Key'] || req.headers?.['idempotency-key'];
    if (idempotencyKey && store.idempotencyKeys.has(idempotencyKey)) {
      return { status: 200, data: store.idempotencyKeys.get(idempotencyKey) };
    }

    const platformFee = calculatePlatformFee(body.amount);
    const totalCharged = Math.round((body.amount + platformFee) * 100) / 100;
    const credits = store.credits.get(email) || { total_credits: 0, total_usage: 0 };
    credits.total_credits += body.amount;
    store.credits.set(email, credits);

    const txnId = store.generateTransactionId();
    const newBalance = credits.total_credits - credits.total_usage;
    const now = new Date().toISOString();

    const transactions = store.transactions.get(email) || [];
    transactions.push({ id: txnId, type: 'purchase', amount: body.amount, balance_after: newBalance, description: 'Credit purchase', created_at: now });
    store.transactions.set(email, transactions);

    const responseData = { data: { transaction_id: txnId, amount: body.amount, platform_fee: platformFee, total_charged: totalCharged, new_balance: newBalance, created_at: now } };
    if (idempotencyKey) store.idempotencyKeys.set(idempotencyKey, responseData);

    return { status: 200, data: responseData };
  });

  router.register('GET', '/credits/history', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;

    const limit = parseInt(req.query?.limit || '20', 10);
    const offset = parseInt(req.query?.offset || '0', 10);
    const typeFilter = req.query?.type;

    let transactions = store.transactions.get(result) || [];
    if (typeFilter) transactions = transactions.filter((t) => t.type === typeFilter);

    const total = transactions.length;
    const items = transactions.slice(offset, offset + limit);
    return { status: 200, data: { data: { items, total, limit, offset, has_more: offset + limit < total } } };
  });

  router.register('GET', '/credits/auto-topup', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const config = store.autoTopup.get(result) || { enabled: false, threshold: 5, amount: 25 };
    return { status: 200, data: { data: config } };
  });

  router.register('PUT', '/credits/auto-topup', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;

    const body = req.body as { enabled?: boolean; threshold?: number; amount?: number } | undefined;
    const current = store.autoTopup.get(result) || { enabled: false, threshold: 5, amount: 25 };

    if (body?.threshold !== undefined) {
      if (body.threshold < 1) return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Threshold must be >= $1.00' } } };
      current.threshold = body.threshold;
    }
    if (body?.amount !== undefined) {
      if (body.amount < 5) return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Amount must be >= $5.00' } } };
      current.amount = body.amount;
    }
    if (body?.enabled !== undefined) current.enabled = body.enabled;

    store.autoTopup.set(result, current);
    return { status: 200, data: { data: { ...current, updated_at: new Date().toISOString() } } };
  });
}
