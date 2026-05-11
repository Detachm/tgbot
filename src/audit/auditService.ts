import type { MemoryStore } from "../db/memoryStore.js";

export class AuditService {
  constructor(private readonly store: MemoryStore) {}

  latest(limit = 10): string {
    return this.store.auditLogs
      .slice(-limit)
      .reverse()
      .map((item) => `${item.createdAt.toISOString()} ${item.action} ${item.entityType}:${item.entityId ?? "-"}`)
      .join("\n");
  }
}

