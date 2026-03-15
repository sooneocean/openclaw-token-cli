import fs from 'node:fs/promises';
import path from 'node:path';
import { getAuditLogPath, getConfigDir } from '../config/paths.js';

export interface AuditEntry {
  timestamp: string;
  command: string;
  args: string[];
  status: 'success' | 'error';
  detail?: string;
}

export class AuditLogger {
  static async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const logPath = getAuditLogPath();
    const dir = path.dirname(logPath);
    await fs.mkdir(dir, { recursive: true });

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    }) + '\n';

    await fs.appendFile(logPath, line, 'utf-8');
  }

  static async read(limit = 50): Promise<AuditEntry[]> {
    const logPath = getAuditLogPath();
    try {
      const raw = await fs.readFile(logPath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      return lines
        .map((line) => {
          try { return JSON.parse(line) as AuditEntry; } catch { return null; }
        })
        .filter((e): e is AuditEntry => e !== null)
        .slice(-limit);
    } catch {
      return [];
    }
  }

  static async clear(): Promise<void> {
    const logPath = getAuditLogPath();
    try {
      await fs.unlink(logPath);
    } catch {
      // Already empty
    }
  }
}
