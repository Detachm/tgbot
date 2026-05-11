import type { AccountSnapshot, Position } from "../domain/types.js";
import type { MemoryStore } from "../db/memoryStore.js";
import { calculatePnl, getMockMarkPrice, roundMoney } from "../trade/pnl.js";

const initialDemoBalance = 1000;

export class AccountService {
  constructor(private readonly store: MemoryStore) {}

  getSnapshot(userTelegramId: number): AccountSnapshot {
    const balance = this.getBalance(userTelegramId);
    const openPositions = this.listOpenPositions(userTelegramId);
    const usedMargin = openPositions.reduce((sum, position) => sum + position.marginUsdt, 0);
    const unrealizedPnl = openPositions.reduce((sum, position) => {
      const markPrice = getMockMarkPrice(position);
      return sum + calculatePnl(position, markPrice).netPnlUsdt;
    }, 0);

    return {
      userTelegramId,
      availableUsdt: roundMoney(balance - usedMargin),
      equityUsdt: roundMoney(balance + unrealizedPnl),
      refreshedAt: new Date(),
      source: "mock",
    };
  }

  listOpenPositions(userTelegramId: number): Position[] {
    return [...this.store.positions.values()].filter(
      (position) => position.userTelegramId === userTelegramId && position.status === "open",
    );
  }

  getUsedMargin(userTelegramId: number): number {
    return roundMoney(this.listOpenPositions(userTelegramId).reduce((sum, position) => sum + position.marginUsdt, 0));
  }

  getUnrealizedPnl(userTelegramId: number): number {
    return roundMoney(
      this.listOpenPositions(userTelegramId).reduce((sum, position) => {
        const markPrice = getMockMarkPrice(position);
        return sum + calculatePnl(position, markPrice).netPnlUsdt;
      }, 0),
    );
  }

  getBalance(userTelegramId: number): number {
    const balance = this.store.accountBalances.get(userTelegramId);
    if (balance !== undefined) {
      return balance;
    }

    this.store.accountBalances.set(userTelegramId, initialDemoBalance);
    return initialDemoBalance;
  }

  applyRealizedPnl(userTelegramId: number, realizedPnlUsdt: number): number {
    const nextBalance = roundMoney(this.getBalance(userTelegramId) + realizedPnlUsdt);
    this.store.accountBalances.set(userTelegramId, nextBalance);
    return nextBalance;
  }
}
