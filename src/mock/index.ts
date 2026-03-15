/**
 * Mock subsystem entry point.
 *
 * Importing this module registers all built-in mock handlers onto the
 * singleton router inside handler.ts, ensuring handleMockRequest() works.
 *
 * client.ts imports handleMockRequest from here (not directly from handler.ts)
 * so that all handlers are registered before the first request is dispatched.
 */
import { registerAuthHandlers } from './handlers/auth.mock.js';
import { registerCreditsHandlers } from './handlers/credits.mock.js';
import { registerKeysHandlers } from './handlers/keys.mock.js';
import { registerOAuthHandlers } from './handlers/oauth.mock.js';
import {
  clearHandlers,
  defaultRouter,
  handleMockRequest,
  MockRouter,
  registerHandler,
  type MockRequest,
  type MockResponse,
} from './handler.js';

// Bootstrap: attach all built-in route handlers to the singleton router.
registerAuthHandlers(defaultRouter);
registerCreditsHandlers(defaultRouter);
registerKeysHandlers(defaultRouter);
registerOAuthHandlers(defaultRouter);

export { handleMockRequest, clearHandlers, MockRouter, registerHandler, defaultRouter };
export type { MockRequest, MockResponse };
