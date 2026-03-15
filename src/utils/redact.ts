/**
 * Redact a secret string for safe display in logs/verbose output.
 *
 * Rules:
 * - Empty or <= 4 chars → "****"
 * - 5-16 chars → first 4 + "****"
 * - > 16 chars → first 12 + "****" + last 4
 *
 * Example: "sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *          → "sk-mgmt-a1b2****7890"
 */
export function redactSecret(secret: string): string {
  if (secret.length <= 4) return '****';
  if (secret.length <= 16) return `${secret.slice(0, 4)}****`;
  return `${secret.slice(0, 12)}****${secret.slice(-4)}`;
}
