import { nanoid } from "nanoid";
import type { AuditLog, Order, Position, Signal, Strategy, SystemState, TradeIntent, User } from "../domain/types.js";

export class MemoryStore {
  readonly users = new Map<number, User>();
  readonly signals = new Map<string, Signal>();
  readonly strategies = new Map<string, Strategy>();
  readonly userStrategies = new Map<number, Set<string>>();
  readonly signalSubscribers = new Set<number>();
  readonly lastPushedSignalAt = new Map<number, number>();
  readonly liveSignalMessages = new Map<number, number>();
  readonly positionMessages = new Map<string, number>();
  readonly pendingCustomInputs = new Map<number, { signalId: string; createdAt: number }>();
  readonly intents = new Map<string, TradeIntent>();
  readonly orders = new Map<string, Order>();
  readonly positions = new Map<string, Position>();
  readonly accountBalances = new Map<number, number>();
  readonly auditLogs: AuditLog[] = [];
  readonly systemState: SystemState = { newTradesEnabled: true };

  addAudit(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    const item: AuditLog = {
      id: nanoid(),
      createdAt: new Date(),
      ...input,
    };

    this.auditLogs.push(item);
    return item;
  }
}

export const store = new MemoryStore();
