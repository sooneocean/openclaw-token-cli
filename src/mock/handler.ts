import { MockStore, mockStore } from './store.js';

export interface MockRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

type HandlerFn = (req: MockRequest, store: MockStore) => MockResponse | Promise<MockResponse>;

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: HandlerFn;
}

export class MockRouter {
  store: MockStore;
  private routes: RouteEntry[] = [];

  constructor(store?: MockStore) {
    this.store = store ?? mockStore;
  }

  register(method: string, path: string, handler: HandlerFn): void {
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([a-zA-Z]+)/g, (_match, name: string) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
      handler,
    });
  }

  /**
   * Register a batch of handlers. Handler modules call this to attach their
   * routes to the router instance.
   */
  registerHandlers(setup: (router: MockRouter) => void): void {
    setup(this);
  }

  async handle(request: MockRequest): Promise<MockResponse> {
    const method = request.method.toUpperCase();

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = request.path.match(route.pattern);
      if (!match) continue;

      // Extract path params and merge into query
      const enrichedReq: MockRequest = {
        ...request,
        query: { ...(request.query ?? {}) },
      };
      route.paramNames.forEach((name, i) => {
        enrichedReq.query![name] = match[i + 1];
      });

      return route.handler(enrichedReq, this.store);
    }

    return {
      status: 404,
      data: { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton router — used by the legacy functional API below
// and by the default axios mock adapter in client.ts.
// ---------------------------------------------------------------------------
export const defaultRouter = new MockRouter();

/**
 * Register a handler on the module-level singleton router.
 * Kept for backward compatibility with handler files that call registerHandler().
 */
export function registerHandler(method: string, path: string, handler: HandlerFn): void {
  defaultRouter.register(method, path, handler);
}

/**
 * Dispatch a request through the module-level singleton router.
 * Used by the axios mock adapter in client.ts.
 */
export async function handleMockRequest(req: MockRequest): Promise<MockResponse> {
  return defaultRouter.handle(req);
}

/**
 * Remove all registered routes from the singleton router (useful for tests).
 */
export function clearHandlers(): void {
  // Access private field via cast — acceptable for test utilities
  (defaultRouter as unknown as { routes: RouteEntry[] }).routes.length = 0;
}
