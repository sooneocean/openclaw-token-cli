import { CLIError } from './base.js';
import {
  SESSION_EXPIRED,
  INSUFFICIENT_CREDITS,
  PAYMENT_FAILED,
  RESOURCE_CONFLICT,
  KEY_ALREADY_REVOKED,
  NETWORK_ERROR,
} from './messages.js';

export function mapApiError(status: number, errorCode?: string, message?: string): CLIError {
  switch (status) {
    case 401:
      return new CLIError(SESSION_EXPIRED, 1, 'auth login');

    case 402:
      if (errorCode === 'INSUFFICIENT_CREDITS') {
        return new CLIError(INSUFFICIENT_CREDITS, 1, 'credits buy');
      }
      if (errorCode === 'PAYMENT_FAILED') {
        return new CLIError(PAYMENT_FAILED, 1);
      }
      // fallback for other 402 variants
      return new CLIError(
        `${INSUFFICIENT_CREDITS}${message ? ` ${message}` : ''}`,
        1,
        'credits buy',
      );

    case 409:
      return new CLIError(
        `${RESOURCE_CONFLICT}${message ? `: ${message}` : ''}`,
        1,
      );

    case 410:
      return new CLIError(KEY_ALREADY_REVOKED, 1);

    default:
      return new CLIError(message ?? 'Unknown error', 1, undefined, errorCode);
  }
}

export function mapNetworkError(_error: unknown): CLIError {
  return new CLIError(NETWORK_ERROR, 1);
}

export { redactSecret } from '../utils/redact.js';
