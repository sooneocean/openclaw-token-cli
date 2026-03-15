import crypto from 'node:crypto';

export interface MockUser {
  email: string;
  password?: string;
  management_key: string;
  plan: string;
  created_at: string;
  oauth_provider?: string;
}

export interface MockCredits {
  total_credits: number;
  total_usage: number;
}

export interface MockTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface MockProvisionedKey {
  key: string;
  hash: string;
  name: string;
  credit_limit: number | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  usage: number;
  disabled: boolean;
  revoked: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface MockAutoTopupConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
}

export interface MockOAuthSession {
  device_code: string;
  user_code: string;
  client_id: string;
  access_token: string | null;
  authorized: boolean;
  auto_authorize_at: number;
  expires_at: number;
  email: string;
  created_at: string;
}

export interface MockStoreState {
  users?: Map<string, MockUser>;
  credits?: Map<string, MockCredits>;
  transactions?: Map<string, MockTransaction[]>;
  keys?: Map<string, MockProvisionedKey[]>;
  autoTopup?: Map<string, MockAutoTopupConfig>;
  oauthSessions?: Map<string, MockOAuthSession>;
}

export const DEMO_EMAIL = 'demo@openclaw.dev';
export const DEMO_MANAGEMENT_KEY = 'sk-mgmt-de000000-0000-0000-0000-000000000000';
const DEMO_PASSWORD = 'Demo1234!';

export class MockStore {
  users = new Map<string, MockUser>();
  credits = new Map<string, MockCredits>();
  transactions = new Map<string, MockTransaction[]>();
  /** key: email → list of provisioned keys owned by that user */
  keys = new Map<string, MockProvisionedKey[]>();
  autoTopup = new Map<string, MockAutoTopupConfig>();
  idempotencyKeys = new Map<string, unknown>();
  oauthSessions = new Map<string, MockOAuthSession>();
  revokedManagementKeys = new Set<string>();
  private tokenEmailMap = new Map<string, string>();

  constructor(initialState?: Partial<MockStoreState>) {
    if (initialState) {
      if (initialState.users) this.users = initialState.users;
      if (initialState.credits) this.credits = initialState.credits;
      if (initialState.transactions) this.transactions = initialState.transactions;
      if (initialState.keys) this.keys = initialState.keys;
      if (initialState.autoTopup) this.autoTopup = initialState.autoTopup;
      if (initialState.oauthSessions) this.oauthSessions = initialState.oauthSessions;
    } else {
      this.initDefaults();
    }
  }

  private initDefaults(): void {
    this.users.set(DEMO_EMAIL, {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      management_key: DEMO_MANAGEMENT_KEY,
      plan: 'free',
      created_at: new Date().toISOString(),
    });
    this.credits.set(DEMO_EMAIL, { total_credits: 100, total_usage: 0 });
    this.transactions.set(DEMO_EMAIL, []);
    this.keys.set(DEMO_EMAIL, []);
    this.autoTopup.set(DEMO_EMAIL, { enabled: false, threshold: 5, amount: 25 });
    this.tokenEmailMap.set(DEMO_MANAGEMENT_KEY, DEMO_EMAIL);
  }

  reset(): void {
    this.users.clear();
    this.credits.clear();
    this.transactions.clear();
    this.keys.clear();
    this.idempotencyKeys.clear();
    this.autoTopup.clear();
    this.oauthSessions.clear();
    this.revokedManagementKeys.clear();
    this.tokenEmailMap.clear();
    this.initDefaults();
  }

  isValidToken(token: string): boolean {
    if (this.revokedManagementKeys.has(token)) return false;
    return /^sk-mgmt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  }

  getEmailForToken(token: string): string | null {
    return this.tokenEmailMap.get(token) ?? null;
  }

  setTokenEmailMapping(token: string, email: string): void {
    this.tokenEmailMap.set(token, email);
  }

  removeTokenEmailMapping(token: string): void {
    this.tokenEmailMap.delete(token);
  }

  generateManagementKey(): string {
    return `sk-mgmt-${crypto.randomUUID()}`;
  }

  generateProvisionedKey(): string {
    return `sk-prov-${crypto.randomBytes(16).toString('hex')}`;
  }

  generateKeyHash(): string {
    return `hash_${crypto.randomBytes(6).toString('hex')}`;
  }

  generateTransactionId(): string {
    return `txn_${crypto.randomBytes(6).toString('hex')}`;
  }

  generateDeviceCode(): string {
    return `dc_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateUserCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}-${part()}`;
  }

  generateAccessToken(): string {
    return `gho_${crypto.randomBytes(10).toString('hex')}`;
  }
}

export const mockStore = new MockStore();
