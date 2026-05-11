export type BindingStatus = "unbound" | "bound";
export type Language = "zh" | "en";
export type Direction = "long" | "short";
export type EntryType = "market" | "limit";
export type SignalStatus = "draft" | "published" | "cancelled" | "expired";
export type ExecutionMode = "paper" | "live";
export type OrderStatus =
  | "pending_submit"
  | "paper_filled"
  | "paper_rejected"
  | "paper_closed"
  | "submitted"
  | "unknown";

export interface User {
  telegramId: number;
  username?: string;
  language?: Language;
  bindingStatus: BindingStatus;
  riskProfile: RiskProfile;
  activeStrategyId?: string;
  createdAt: Date;
}

export interface RiskProfile {
  riskPercent: number;
  maxLeverage: number;
  dailyTradeLimit: number;
  dailyRiskLimitPercent: number;
  allowAddPosition: boolean;
}

export interface Signal {
  id: string;
  strategyId?: string;
  strategyName?: string;
  strategyAnnualizedReturn?: number;
  symbol: string;
  direction: Direction;
  entryType: EntryType;
  entryPrice?: number;
  takeProfit: number;
  stopLoss: number;
  suggestedRiskPercent: number;
  suggestedLeverage: number;
  status: SignalStatus;
  createdBy: number;
  createdAt: Date;
  publishedAt?: Date;
}

export interface Strategy {
  id: string;
  code: string;
  name: string;
  description: string;
  symbol: string;
  directionBias: Direction;
  riskPercent: number;
  leverage: number;
  heat: number;
  annualizedReturn: number;
  createdBy: number;
  source: "pool" | "kol";
  createdAt: Date;
}

export interface AccountSnapshot {
  userTelegramId: number;
  availableUsdt: number;
  equityUsdt: number;
  refreshedAt: Date;
  source: "mock" | "lbank";
}

export interface Position {
  id: string;
  userTelegramId: number;
  symbol: string;
  direction: Direction;
  marginUsdt: number;
  notionalUsdt: number;
  leverage: number;
  entryPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  closePrice?: number;
  openFeeUsdt?: number;
  closeFeeUsdt?: number;
  realizedPnlUsdt?: number;
  realizedPnlPct?: number;
  status: "open" | "closed";
  executionMode: ExecutionMode;
  openedAt: Date;
  closedAt?: Date;
}

export interface RiskDecision {
  allowed: boolean;
  reason?: string;
  marginUsdt: number;
  leverage: number;
  notionalUsdt: number;
  riskPercent: number;
}

export interface TradeIntent {
  id: string;
  userTelegramId: number;
  signalId: string;
  riskDecision: RiskDecision;
  overrides?: TradeOverrides;
  status: "created" | "confirmed" | "expired" | "rejected";
  expiresAt: Date;
  createdAt: Date;
}

export interface TradeOverrides {
  marginUsdt?: number;
  leverage?: number;
  notionalUsdt?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface Order {
  id: string;
  userTelegramId: number;
  intentId: string;
  signalId: string;
  symbol: string;
  direction: Direction;
  executionMode: ExecutionMode;
  status: OrderStatus;
  marginUsdt: number;
  notionalUsdt: number;
  leverage: number;
  takeProfit?: number;
  stopLoss?: number;
  fillPrice?: number;
  rejectReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actorTelegramId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SystemState {
  newTradesEnabled: boolean;
}
