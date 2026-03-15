# S0 Brief Spec — Stripe 付款整合

**SOP ID**: SOP-14
**版本**: v1.0.0
**work_type**: new_feature
**建立日期**: 2026-03-15
**實作 repo**: openclaw-token-server + openclaw-token-cli

---

## 1. 一句話描述

將 credits purchase 從假的立即加值改為 Stripe Checkout 真實付款流程，CLI 開啟 Stripe 付款頁面，Server 透過 Webhook 確認付款後才加 credits。

## 2. 痛點

- `POST /credits/purchase` 目前是假的——直接加 credits，沒有真實付款
- 無法對外營運收費
- Auto-topup 觸發後也是假的加值

## 3. 目標

用 Stripe Checkout Session 實現真實付款流程。支援 test mode（無需真實信用卡）。

## 4. 核心流程

```
CLI: credits buy $25
    │
    ▼
Server: POST /credits/purchase
    ├─ 建立 Stripe Checkout Session（amount, success_url, cancel_url）
    ├─ 回傳 checkout_url
    │
    ▼
CLI: 開啟瀏覽器 → Stripe Checkout 頁面
    │ （用戶完成付款）
    ▼
Stripe → Server: POST /webhooks/stripe
    ├─ 驗證 webhook signature
    ├─ checkout.session.completed event
    ├─ 加 credits + 記錄 transaction
    │
    ▼
CLI: 輪詢 GET /credits → 確認餘額更新
```

## 5. 功能區

| FA ID | 名稱 | Repo | 描述 |
|-------|------|------|------|
| FA-S | Stripe 整合 | server | Checkout Session 建立 + Webhook handler |
| FA-P | Purchase 改造 | server | credits/purchase 回傳 checkout_url 而非直接加值 |
| FA-C | CLI 付款流程 | cli | 開啟瀏覽器 + 輪詢確認 |

## 6. 成功標準

1. `POST /credits/purchase` 回傳 `{ checkout_url }` 而非直接加 credits
2. `POST /webhooks/stripe` 正確處理 checkout.session.completed
3. Webhook 驗證 signature（STRIPE_WEBHOOK_SECRET）
4. 付款完成後 credits 正確增加
5. CLI `credits buy` 開啟瀏覽器並輪詢等待付款完成
6. Mock mode（無 Stripe key）退回原有的立即加值行為
7. 現有測試不受影響
8. 新增 Stripe 相關測試

## 7. 範圍外

- Stripe 訂閱（subscription）
- 退款（refund）API
- Stripe Customer Portal
- 發票生成
- 多幣種

## 8. 約束

- STRIPE_SECRET_KEY 未設定時 → 退回 mock 模式（立即加值）
- Webhook endpoint 不需要 auth middleware（Stripe 直接呼叫）
- 使用 Stripe Checkout（hosted page），不做 Elements（自建表單）
