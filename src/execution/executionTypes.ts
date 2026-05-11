import type { Direction } from "../domain/types.js";

export interface SubmitOrderRequest {
  userTelegramId: number;
  intentId: string;
  signalId: string;
  symbol: string;
  direction: Direction;
  marginUsdt: number;
  notionalUsdt: number;
  leverage: number;
}

export interface SubmitOrderResult {
  success: boolean;
  externalOrderId: string;
  fillPrice?: number;
  rejectReason?: string;
}

export interface ClosePositionRequest {
  userTelegramId: number;
  positionId: string;
}

export interface ClosePositionResult {
  success: boolean;
  externalOrderId: string;
  rejectReason?: string;
}

export interface ExecutionProvider {
  submitOrder(request: SubmitOrderRequest): Promise<SubmitOrderResult>;
  closePosition(request: ClosePositionRequest): Promise<ClosePositionResult>;
}

