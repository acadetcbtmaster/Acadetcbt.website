import { getDb, isDatabaseConfigured } from '../../db/index.js';
import { auditLogs } from '../../db/schema.js';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    const db = getDb();
    await db.insert(auditLogs).values({
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error('[AuditLog Error]', err instanceof Error ? err.message : err);
  }
}
