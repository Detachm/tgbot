import { nanoid } from "nanoid";
import { z } from "zod";
import type { MemoryStore } from "../db/memoryStore.js";
import type { Signal, Strategy } from "../domain/types.js";

export const createSignalSchema = z.object({
  strategyId: z.string().optional(),
  strategyName: z.string().optional(),
  strategyAnnualizedReturn: z.number().optional(),
  symbol: z.string().min(3).transform((value) => value.toUpperCase()),
  direction: z.enum(["long", "short"]),
  entryType: z.enum(["market", "limit"]),
  entryPrice: z.number().positive().optional(),
  takeProfit: z.number().positive(),
  stopLoss: z.number().positive(),
  suggestedRiskPercent: z.number().positive().max(15),
  suggestedLeverage: z.number().int().positive().max(50),
});

export type CreateSignalInput = z.input<typeof createSignalSchema>;

export class SignalService {
  constructor(private readonly store: MemoryStore) {}

  createAndPublish(input: CreateSignalInput, adminTelegramId: number): Signal {
    const parsed = createSignalSchema.parse(input);
    const signal: Signal = {
      id: nanoid(),
      ...parsed,
      status: "published",
      createdBy: adminTelegramId,
      createdAt: new Date(),
      publishedAt: new Date(),
    };

    this.store.signals.set(signal.id, signal);
    this.store.addAudit({
      actorTelegramId: adminTelegramId,
      action: "signal.published",
      entityType: "signal",
      entityId: signal.id,
      metadata: { signal },
    });

    return signal;
  }

  createDemoSignal(adminTelegramId: number): Signal {
    return this.createAndPublish(
      {
        symbol: "BTCUSDT",
        direction: "long",
        entryType: "market",
        takeProfit: 63800,
        stopLoss: 62200,
        suggestedRiskPercent: 3,
        suggestedLeverage: 5,
      },
      adminTelegramId,
    );
  }

  createFromStrategy(strategy: Strategy, actorTelegramId: number): Signal {
    const referencePrice = strategy.symbol.includes("BTC") ? 63000 : 3200;
    const isLong = strategy.directionBias === "long";

    return this.createAndPublish(
      {
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyAnnualizedReturn: strategy.annualizedReturn,
        symbol: strategy.symbol,
        direction: strategy.directionBias,
        entryType: "market",
        takeProfit: Math.round(referencePrice * (isLong ? 1.012 : 0.988)),
        stopLoss: Math.round(referencePrice * (isLong ? 0.992 : 1.008)),
        suggestedRiskPercent: strategy.riskPercent,
        suggestedLeverage: strategy.leverage,
      },
      actorTelegramId,
    );
  }

  latestPublished(): Signal | undefined {
    return [...this.store.signals.values()]
      .filter((signal) => signal.status === "published")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  }

  getPublished(signalId: string): Signal | undefined {
    const signal = this.store.signals.get(signalId);
    if (!signal || signal.status !== "published") {
      return undefined;
    }

    return signal;
  }
}
