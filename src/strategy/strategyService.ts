import { customAlphabet, nanoid } from "nanoid";
import type { MemoryStore } from "../db/memoryStore.js";
import type { Direction, Strategy } from "../domain/types.js";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const createCode = customAlphabet(codeAlphabet, 6);

const poolTemplates = [
  {
    name: "BTC 稳健突破",
    description: "偏稳健，适合 demo 展示确认式开仓。",
    symbol: "BTCUSDT",
    directionBias: "long" as Direction,
    riskPercent: 3,
    leverage: 5,
    heat: 98,
    annualizedReturn: 126,
  },
  {
    name: "ETH 回踩跟随",
    description: "中等风险，关注主流币回踩后的顺势机会。",
    symbol: "ETHUSDT",
    directionBias: "long" as Direction,
    riskPercent: 2,
    leverage: 4,
    heat: 87,
    annualizedReturn: 84,
  },
  {
    name: "BTC 防守空头",
    description: "偏防守，用于展示做空策略复制流程。",
    symbol: "BTCUSDT",
    directionBias: "short" as Direction,
    riskPercent: 2,
    leverage: 3,
    heat: 76,
    annualizedReturn: 61,
  },
];

export class StrategyService {
  constructor(private readonly store: MemoryStore) {
    this.seedPool();
  }

  listPool(): Strategy[] {
    return [...this.store.strategies.values()]
      .filter((strategy) => strategy.source === "pool")
      .sort((left, right) => right.heat - left.heat);
  }

  getHottestStrategy(): Strategy {
    const strategy = this.listPool()[0];
    if (!strategy) {
      throw new Error("strategy pool is empty");
    }
    return strategy;
  }

  ensureDefaultStrategy(userTelegramId: number): Strategy {
    const existing = this.getActiveStrategy(userTelegramId);
    if (existing) {
      return existing;
    }

    const strategy = this.getHottestStrategy();
    this.selectStrategy(userTelegramId, strategy.id);
    return strategy;
  }

  getActiveStrategy(userTelegramId: number): Strategy | undefined {
    const user = this.store.users.get(userTelegramId);
    if (!user?.activeStrategyId) {
      return undefined;
    }
    return this.store.strategies.get(user.activeStrategyId);
  }

  selectStrategy(userTelegramId: number, strategyId: string): Strategy | undefined {
    const strategy = this.store.strategies.get(strategyId);
    const user = this.store.users.get(userTelegramId);
    if (!strategy || !user) {
      return undefined;
    }

    this.attachToUser(userTelegramId, strategy.id);
    user.activeStrategyId = strategy.id;
    this.store.users.set(userTelegramId, user);
    this.store.addAudit({
      actorTelegramId: userTelegramId,
      action: "strategy.selected",
      entityType: "strategy",
      entityId: strategy.id,
      metadata: { code: strategy.code, name: strategy.name },
    });
    return strategy;
  }

  listUserStrategies(userTelegramId: number): Strategy[] {
    const ids = this.store.userStrategies.get(userTelegramId) ?? new Set<string>();
    return [...ids]
      .map((id) => this.store.strategies.get(id))
      .filter((item): item is Strategy => Boolean(item));
  }

  createKolStrategy(input: {
    creatorTelegramId: number;
    name?: string;
    symbol?: string;
    directionBias?: Direction;
    riskPercent?: number;
    leverage?: number;
  }): Strategy {
    const strategy: Strategy = {
      id: nanoid(),
      code: this.nextUniqueCode(),
      name: input.name ?? "KOL 快速策略",
      description: "KOL 发布的 6 位策略码，用户输入后可复刻到自己的 Bot。",
      symbol: input.symbol ?? "BTCUSDT",
      directionBias: input.directionBias ?? "long",
      riskPercent: input.riskPercent ?? 3,
      leverage: input.leverage ?? 5,
      heat: 50,
      annualizedReturn: 72,
      createdBy: input.creatorTelegramId,
      source: "kol",
      createdAt: new Date(),
    };

    this.store.strategies.set(strategy.id, strategy);
    this.attachToUser(input.creatorTelegramId, strategy.id);
    this.store.addAudit({
      actorTelegramId: input.creatorTelegramId,
      action: "strategy.kol_published",
      entityType: "strategy",
      entityId: strategy.id,
      metadata: { code: strategy.code, name: strategy.name },
    });
    return strategy;
  }

  replicateByCode(userTelegramId: number, code: string): Strategy | undefined {
    const normalized = code.trim().toUpperCase();
    const strategy = [...this.store.strategies.values()].find((item) => item.code === normalized);
    if (!strategy) {
      return undefined;
    }

    this.attachToUser(userTelegramId, strategy.id);
    const user = this.store.users.get(userTelegramId);
    if (user) {
      user.activeStrategyId = strategy.id;
      this.store.users.set(userTelegramId, user);
    }
    this.store.addAudit({
      actorTelegramId: userTelegramId,
      action: "strategy.replicated",
      entityType: "strategy",
      entityId: strategy.id,
      metadata: { code: strategy.code, source: strategy.source },
    });
    return strategy;
  }

  private seedPool(): void {
    if (this.store.strategies.size > 0) {
      return;
    }

    for (const template of poolTemplates) {
      const strategy: Strategy = {
        id: nanoid(),
        code: this.nextUniqueCode(),
        createdBy: 0,
        source: "pool",
        createdAt: new Date(),
        ...template,
      };
      this.store.strategies.set(strategy.id, strategy);
    }
  }

  private attachToUser(userTelegramId: number, strategyId: string): void {
    const existing = this.store.userStrategies.get(userTelegramId) ?? new Set<string>();
    existing.add(strategyId);
    this.store.userStrategies.set(userTelegramId, existing);
  }

  private nextUniqueCode(): string {
    let code = createCode();
    const usedCodes = new Set([...this.store.strategies.values()].map((strategy) => strategy.code));
    while (usedCodes.has(code)) {
      code = createCode();
    }
    return code;
  }
}
