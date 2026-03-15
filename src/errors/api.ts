import { CLIError } from './base.js';
import {
  SESSION_EXPIRED,
  INSUFFICIENT_CREDITS,
  PAYMENT_FAILED,
  RESOURCE_CONFLICT,
  KEY_ALREADY_REVOKED,
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  SERVER_ERROR,
  SUGGESTIONS,
} from './messages.js';

export function mapApiError(status: number, errorCode?: string, message?: string): CLIError {
  const suggestion = errorCode ? SUGGESTIONS[errorCode] : undefined;

  switch (status) {
    case 400:
      return new CLIError(
        message ?? 'Invalid request',
        1,
        suggestion ?? 'Check your input and try again.',
        errorCode,
      );

    case 401:
      return new CLIError(SESSION_EXPIRED, 1, SUGGESTIONS.SESSION_EXPIRED);

    case 402:
      if (errorCode === 'PAYMENT_FAILED') {
        return new CLIError(PAYMENT_FAILED, 1, SUGGESTIONS.PAYMENT_FAILED);
      }
      return new CLIError(
        INSUFFICIENT_CREDITS + (message ? ` ${message}` : ''),
        1,
        SUGGESTIONS.INSUFFICIENT_CREDITS,
      );

    case 404:
      return new CLIError(
        message ?? 'Resource not found',
        1,
        suggestion ?? 'Verify the resource exists.',
        errorCode,
      );

    case 409:
      return new CLIError(
        `${RESOURCE_CONFLICT}${message ? `: ${message}` : ''}`,
        1,
        suggestion,
      );

    case 410:
      return new CLIError(KEY_ALREADY_REVOKED, 1);

    case 429:
      return new CLIError(
        'Rate limited. Too many requests.',
        1,
        'Wait a moment and try again.',
      );

    default:
      if (status >= 500) {
        return new CLIError(SERVER_ERROR, 1, SUGGESTIONS.SERVER_ERROR, errorCode);
      }
      return new CLIError(message ?? 'Unknown error', 1, suggestion, errorCode);
  }
}

export function mapNetworkError(error: unknown): CLIError {
  const msg = error instanceof Error ? error.message : '';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return new CLIError(TIMEOUT_ERROR, 1, SUGGESTIONS.TIMEOUT_ERROR);
  }
  return new CLIError(NETWORK_ERROR, 1, SUGGESTIONS.NETWORK_ERROR);
}

export { redactSecret } from '../utils/redact.js';
