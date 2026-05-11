import type { Position } from "../domain/types.js";

export const demoFeeRate = 0.0004;

export interface PnlSnapshot {
  markPrice: number;
  grossPnlUsdt: number;
  grossPnlPct: number;
  openFeeUsdt: number;
  closeFeeUsdt: number;
  netPnlUsdt: number;
  netPnlPct: number;
}

export function getMockMarkPrice(position: Position, timestamp = Date.now()): number {
  const seconds = Math.floor(timestamp / 1000);
  const wave = Math.sin(seconds / 8 + position.id.length) * 0.003;
  return position.entryPrice * (1 + wave);
}

export function calculatePnl(position: Position, markPrice: number): PnlSnapshot {
  const changePct =
    position.direction === "long"
      ? (markPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - markPrice) / position.entryPrice;
  const grossPnlUsdt = roundMoney(position.notionalUsdt * changePct);
  const openFeeUsdt = position.openFeeUsdt ?? roundMoney(position.notionalUsdt * demoFeeRate);
  const closeFeeUsdt = roundMoney(position.notionalUsdt * demoFeeRate);
  const netPnlUsdt = roundMoney(grossPnlUsdt - openFeeUsdt - closeFeeUsdt);
  const grossPnlPct = position.marginUsdt === 0 ? 0 : roundPct((grossPnlUsdt / position.marginUsdt) * 100);
  const netPnlPct = position.marginUsdt === 0 ? 0 : roundPct((netPnlUsdt / position.marginUsdt) * 100);

  return {
    markPrice,
    grossPnlUsdt,
    grossPnlPct,
    openFeeUsdt,
    closeFeeUsdt,
    netPnlUsdt,
    netPnlPct,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

