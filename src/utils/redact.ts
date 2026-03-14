/**
 * Redact a secret string for safe display in logs/verbose output.
 *
 * Rules:
 * - Total length <= 16 chars → return "****" (fully hidden)
 * - Otherwise → keep first 12 chars + "****" + last 4 chars
 *
 * Example: "sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *          → "sk-mgmt-a1b2****7890"
 */
export function redactSecret(secret: string): string {
  if (secret.length <= 16) return '****';
  return `${secret.slice(0, 12)}****${secret.slice(-4)}`;
}
