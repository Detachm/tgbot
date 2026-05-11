import type { AccountSnapshot, Position, RiskDecision, Signal, User } from "../domain/types.js";

export class RiskService {
  calculate(input: { user: User; signal: Signal; account: AccountSnapshot; openPositions: Position[] }): RiskDecision {
    const { user, signal, account, openPositions } = input;
    const riskPercent = Math.min(user.riskProfile.riskPercent, signal.suggestedRiskPercent);
    const leverage = Math.min(user.riskProfile.maxLeverage, signal.suggestedLeverage, 10);
    const marginUsdt = roundMoney(account.equityUsdt * (riskPercent / 100));
    const notionalUsdt = roundMoney(marginUsdt * leverage);

    if (signal.suggestedLeverage > 10) {
      return reject("杠杆超过平台 demo 上限 10x", marginUsdt, leverage, notionalUsdt, riskPercent);
    }

    if (marginUsdt > account.availableUsdt) {
      return reject("可用余额不足", marginUsdt, leverage, notionalUsdt, riskPercent);
    }

    if (!user.riskProfile.allowAddPosition) {
      const duplicated = openPositions.some(
        (position) => position.symbol === signal.symbol && position.direction === signal.direction,
      );
      if (duplicated) {
        return reject("同一交易对同方向已有持仓，未开启加仓", marginUsdt, leverage, notionalUsdt, riskPercent);
      }
    }

    return {
      allowed: true,
      marginUsdt,
      leverage,
      notionalUsdt,
      riskPercent,
    };
  }
}

function reject(
  reason: string,
  marginUsdt: number,
  leverage: number,
  notionalUsdt: number,
  riskPercent: number,
): RiskDecision {
  return {
    allowed: false,
    reason,
    marginUsdt,
    leverage,
    notionalUsdt,
    riskPercent,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

