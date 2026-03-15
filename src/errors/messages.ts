export const NOT_LOGGED_IN = 'Not logged in. Run: openclaw-token auth login';
export const SESSION_EXPIRED = 'Session expired or token is invalid.';
export const INSUFFICIENT_CREDITS = 'Insufficient credits.';
export const RESOURCE_CONFLICT = 'Resource conflict';
export const KEY_ALREADY_REVOKED = 'This key has already been revoked.';
export const NETWORK_ERROR = 'Cannot reach API server.';
export const TIMEOUT_ERROR = 'Request timed out after 15 seconds.';
export const INVALID_INPUT = 'Invalid input';
export const PAYMENT_FAILED = 'Payment failed.';
export const SERVER_ERROR = 'Server error (5xx). The request was retried but still failed.';

// Suggestions mapped to error types
export const SUGGESTIONS: Record<string, string> = {
  SESSION_EXPIRED: 'Run: openclaw-token auth login',
  INSUFFICIENT_CREDITS: 'Run: openclaw-token credits buy --amount <USD>',
  PAYMENT_FAILED: 'Check your payment method and try again.',
  NETWORK_ERROR: 'Check your network connection or try again later.',
  TIMEOUT_ERROR: 'The server may be overloaded. Try again later.',
  SERVER_ERROR: 'The server is experiencing issues. Try again later.',
  KEY_NOT_FOUND: 'Check the key hash with: openclaw-token keys list',
  EMAIL_EXISTS: 'This email is already registered. Run: openclaw-token auth login',
  INVALID_CREDENTIALS: 'Check your email and password.',
};
