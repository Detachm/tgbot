import type { AccountSnapshot, Position, RiskDecision, Signal } from "../domain/types.js";
import type { Language } from "../domain/types.js";
import { directionText, riskReasonText } from "../i18n.js";

export function formatBoundSignal(signal: Signal, account: AccountSnapshot, decision: RiskDecision, language: Language = "zh"): string {
  if (language === "en") {
    return [
      `${signal.symbol} ${directionText(signal.direction, language)}`,
      "",
      `Available: ${account.availableUsdt} USDT`,
      `Suggested margin: ${decision.marginUsdt} USDT`,
      `Leverage: ${decision.leverage}x`,
      `Position: ${decision.notionalUsdt} USDT`,
      `Take profit: ${signal.takeProfit}`,
      `Stop loss: ${signal.stopLoss}`,
      "",
      decision.allowed ? "Ready to confirm demo order." : `Risk rejected: ${riskReasonText(decision.reason, language)}`,
    ].join("\n");
  }

  return [
    formatSignalHeader(signal),
    "",
    `可用余额：${account.availableUsdt} USDT`,
    `建议保证金：${decision.marginUsdt} USDT`,
    `杠杆：${decision.leverage}x`,
    `预计仓位：${decision.notionalUsdt} USDT`,
    `止盈：${signal.takeProfit}`,
    `止损：${signal.stopLoss}`,
    "",
    decision.allowed ? "可确认模拟开仓。" : `风控拒绝：${riskReasonText(decision.reason, language)}`,
  ].join("\n");
}

export function formatPositions(positions: Position[], language: Language = "zh"): string {
  if (positions.length === 0) {
    return language === "zh" ? "当前没有模拟持仓。" : "No demo positions.";
  }

  return positions
    .map((position) =>
      language === "zh"
        ? [
            `${position.symbol} ${directionText(position.direction, language)}`,
            `保证金：${position.marginUsdt} USDT`,
            `杠杆：${position.leverage}x`,
            `仓位：${position.notionalUsdt} USDT`,
            `开仓价：${position.entryPrice}`,
            `模式：模拟`,
          ].join("\n")
        : [
            `${position.symbol} ${directionText(position.direction, language)}`,
            `Margin: ${position.marginUsdt} USDT`,
            `Leverage: ${position.leverage}x`,
            `Position: ${position.notionalUsdt} USDT`,
            `Entry: ${position.entryPrice}`,
            `Mode: demo`,
          ].join("\n"),
    )
    .join("\n\n");
}

function formatSignalHeader(signal: Signal): string {
  return `${signal.symbol} ${directionText(signal.direction, "zh")}`;
}
