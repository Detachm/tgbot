import { nanoid } from "nanoid";
import type { AccountService } from "../account/accountService.js";
import type { MemoryStore } from "../db/memoryStore.js";
import type { Order, Position, Signal, TradeIntent, TradeOverrides, User } from "../domain/types.js";
import type { Language } from "../domain/types.js";
import type { ExecutionProvider } from "../execution/executionTypes.js";
import { calculatePnl, demoFeeRate, formatSigned, getMockMarkPrice, roundMoney } from "./pnl.js";
import { directionText, riskReasonText } from "../i18n.js";
import type { RiskService } from "../risk/riskService.js";

export class TradeService {
  constructor(
    private readonly store: MemoryStore,
    private readonly accountService: AccountService,
    private readonly riskService: RiskService,
    private readonly executionProvider: ExecutionProvider,
  ) {}

  createIntent(input: { user: User; signal: Signal; overrides?: TradeOverrides }): TradeIntent {
    const account = this.accountService.getSnapshot(input.user.telegramId);
    const openPositions = this.accountService.listOpenPositions(input.user.telegramId);
    const riskDecision = this.riskService.calculate({
      user: input.user,
      signal: input.signal,
      account,
      openPositions,
    });

    const finalDecision = applyOverrides(riskDecision, input.overrides);
    const intent: TradeIntent = {
      id: nanoid(),
      userTelegramId: input.user.telegramId,
      signalId: input.signal.id,
      riskDecision: finalDecision,
      overrides: input.overrides,
      status: finalDecision.allowed ? "created" : "rejected",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };

    this.store.intents.set(intent.id, intent);
    this.store.addAudit({
      actorTelegramId: input.user.telegramId,
      action: "trade_intent.created",
      entityType: "trade_intent",
      entityId: intent.id,
      metadata: { signalId: input.signal.id, riskDecision: finalDecision, overrides: input.overrides },
    });

    return intent;
  }

  async confirmIntent(intentId: string, language: Language = "zh"): Promise<{ intent: TradeIntent; order?: Order; position?: Position; message: string }> {
    const intent = this.store.intents.get(intentId);
    if (!intent) {
      return this.failUnknownIntent(language);
    }

    const existingOrder = [...this.store.orders.values()].find((order) => order.intentId === intent.id);
    if (existingOrder) {
      return {
        intent,
        order: existingOrder,
        message: formatOrderResult(existingOrder, true, language),
      };
    }

    if (intent.status === "rejected" || !intent.riskDecision.allowed) {
      return {
        intent,
        message: language === "zh" ? `模拟开仓失败：${riskReasonText(intent.riskDecision.reason, language)}` : `Demo order failed: ${riskReasonText(intent.riskDecision.reason, language)}`,
      };
    }

    if (intent.expiresAt.getTime() < Date.now()) {
      intent.status = "expired";
      this.store.intents.set(intent.id, intent);
      return { intent, message: language === "zh" ? "交易意图已过期，请重新生成订单。" : "Trade intent expired. Please create a new order." };
    }

    if (!this.store.systemState.newTradesEnabled) {
      return { intent, message: language === "zh" ? "管理员已关闭新开仓，当前只能查看账户和信号。" : "New trades are disabled. You can only view account and signals." };
    }

    const signal = this.store.signals.get(intent.signalId);
    if (!signal || signal.status !== "published") {
      return { intent, message: language === "zh" ? "信号不存在或已失效，订单未提交。" : "Signal does not exist or expired. Order not submitted." };
    }

    const now = new Date();
    const order: Order = {
      id: nanoid(),
      userTelegramId: intent.userTelegramId,
      intentId: intent.id,
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      executionMode: "paper",
      status: "pending_submit",
      marginUsdt: intent.riskDecision.marginUsdt,
      notionalUsdt: intent.riskDecision.notionalUsdt,
      leverage: intent.riskDecision.leverage,
      takeProfit: intent.overrides?.takeProfit ?? signal.takeProfit,
      stopLoss: intent.overrides?.stopLoss ?? signal.stopLoss,
      createdAt: now,
      updatedAt: now,
    };
    this.store.orders.set(order.id, order);

    const result = await this.executionProvider.submitOrder({
      userTelegramId: order.userTelegramId,
      intentId: order.intentId,
      signalId: order.signalId,
      symbol: order.symbol,
      direction: order.direction,
      marginUsdt: order.marginUsdt,
      notionalUsdt: order.notionalUsdt,
      leverage: order.leverage,
    });

    order.status = result.success ? "paper_filled" : "paper_rejected";
    order.fillPrice = result.fillPrice;
    order.rejectReason = result.rejectReason;
    order.updatedAt = new Date();
    this.store.orders.set(order.id, order);

    let position: Position | undefined;
    if (result.success) {
      position = {
        id: nanoid(),
        userTelegramId: order.userTelegramId,
        symbol: order.symbol,
        direction: order.direction,
        marginUsdt: order.marginUsdt,
        notionalUsdt: order.notionalUsdt,
        leverage: order.leverage,
        entryPrice: result.fillPrice ?? 0,
        takeProfit: order.takeProfit,
        stopLoss: order.stopLoss,
        openFeeUsdt: roundMoney(order.notionalUsdt * demoFeeRate),
        status: "open",
        executionMode: "paper",
        openedAt: new Date(),
      };
      this.store.positions.set(position.id, position);
    }

    intent.status = "confirmed";
    this.store.intents.set(intent.id, intent);
    this.store.addAudit({
      actorTelegramId: intent.userTelegramId,
      action: result.success ? "order.paper_filled" : "order.paper_rejected",
      entityType: "order",
      entityId: order.id,
      metadata: { executionMode: order.executionMode, result },
    });

    return { intent, order, position, message: formatOrderResult(order, false, language) };
  }

  async closeFirstOpenPosition(userTelegramId: number, language: Language = "zh"): Promise<string> {
    const position = this.accountService.listOpenPositions(userTelegramId)[0];
    return this.closePosition(userTelegramId, position?.id, language);
  }

  async closePosition(userTelegramId: number, positionId: string | undefined, language: Language = "zh"): Promise<string> {
    const position = positionId ? this.store.positions.get(positionId) : undefined;
    if (!position) {
      return language === "zh" ? "当前没有可平的模拟持仓。" : "No open demo position to close.";
    }

    if (position.userTelegramId !== userTelegramId || position.status !== "open") {
      return language === "zh" ? "该模拟持仓不存在或已平仓。" : "This demo position does not exist or is already closed.";
    }

    const result = await this.executionProvider.closePosition({
      userTelegramId,
      positionId: position.id,
    });

    if (!result.success) {
      return language === "zh" ? `模拟平仓失败：${riskReasonText(result.rejectReason, language)}` : `Demo close failed: ${riskReasonText(result.rejectReason, language)}`;
    }

    position.status = "closed";
    position.closedAt = new Date();
    position.closePrice = getMockMarkPrice(position);
    const pnl = calculatePnl(position, position.closePrice);
    position.closeFeeUsdt = pnl.closeFeeUsdt;
    position.realizedPnlUsdt = pnl.netPnlUsdt;
    position.realizedPnlPct = pnl.netPnlPct;
    this.store.positions.set(position.id, position);
    this.store.positionMessages.delete(position.id);
    const balanceAfter = this.accountService.applyRealizedPnl(userTelegramId, pnl.netPnlUsdt);
    const account = this.accountService.getSnapshot(userTelegramId);
    this.store.addAudit({
      actorTelegramId: userTelegramId,
      action: "position.paper_closed",
      entityType: "position",
      entityId: position.id,
      metadata: { externalOrderId: result.externalOrderId, pnl, balanceAfter },
    });

    if (language === "en") {
      return [
        "Demo close filled",
        `Fill ID: ${result.externalOrderId}`,
        `Position ID: ${position.id.slice(0, 8)}`,
        `Symbol: ${position.symbol}`,
        `Side: ${directionText(position.direction, language)}`,
        `Margin: ${position.marginUsdt.toFixed(2)} USDT`,
        `Position: ${position.notionalUsdt.toFixed(2)} USDT`,
        `Leverage: ${position.leverage}x`,
        `Entry: ${position.entryPrice.toFixed(2)}`,
        `Close: ${position.closePrice.toFixed(2)}`,
        `Gross PnL: ${formatSigned(pnl.grossPnlUsdt)} USDT (${formatSigned(pnl.grossPnlPct)}%)`,
        `Open fee: -${pnl.openFeeUsdt.toFixed(2)} USDT`,
        `Close fee: -${pnl.closeFeeUsdt.toFixed(2)} USDT`,
        `Realized PnL: ${formatSigned(pnl.netPnlUsdt)} USDT (${formatSigned(pnl.netPnlPct)}%)`,
        `Balance: ${balanceAfter.toFixed(2)} USDT`,
        `Equity: ${account.equityUsdt.toFixed(2)} USDT`,
        `Available: ${account.availableUsdt.toFixed(2)} USDT`,
        "Mode: demo fill",
      ].join("\n");
    }

    return [
      "模拟平仓成交",
      `成交编号：${result.externalOrderId}`,
      `持仓编号：${position.id.slice(0, 8)}`,
      `交易对：${position.symbol}`,
      `方向：${position.direction === "long" ? "做多" : "做空"}`,
      `保证金：${position.marginUsdt.toFixed(2)} USDT`,
      `仓位：${position.notionalUsdt.toFixed(2)} USDT`,
      `杠杆：${position.leverage}x`,
      `开仓价：${position.entryPrice.toFixed(2)}`,
      `平仓价：${position.closePrice.toFixed(2)}`,
      `毛盈亏：${formatSigned(pnl.grossPnlUsdt)} USDT (${formatSigned(pnl.grossPnlPct)}%)`,
      `开仓手续费：-${pnl.openFeeUsdt.toFixed(2)} USDT`,
      `平仓手续费：-${pnl.closeFeeUsdt.toFixed(2)} USDT`,
      `实际盈亏：${formatSigned(pnl.netPnlUsdt)} USDT (${formatSigned(pnl.netPnlPct)}%)`,
      `账户余额：${balanceAfter.toFixed(2)} USDT`,
      `账户权益：${account.equityUsdt.toFixed(2)} USDT`,
      `可用余额：${account.availableUsdt.toFixed(2)} USDT`,
      "模式：模拟成交",
    ].join("\n");
  }

  private failUnknownIntent(language: Language = "zh"): { intent: TradeIntent; message: string } {
    const intent: TradeIntent = {
      id: "unknown",
      userTelegramId: 0,
      signalId: "unknown",
      riskDecision: {
        allowed: false,
        reason: "交易意图不存在",
        marginUsdt: 0,
        leverage: 0,
        notionalUsdt: 0,
        riskPercent: 0,
      },
      status: "rejected",
      expiresAt: new Date(),
      createdAt: new Date(),
    };
    return {
      intent,
      message: language === "zh" ? "交易意图不存在，订单未提交。" : "Trade intent does not exist. Order not submitted.",
    };
  }
}

function applyOverrides(riskDecision: import("../domain/types.js").RiskDecision, overrides: TradeOverrides | undefined) {
  if (!overrides || !riskDecision.allowed) {
    return riskDecision;
  }

  const marginUsdt = overrides.marginUsdt ?? riskDecision.marginUsdt;
  const leverage = overrides.leverage ?? riskDecision.leverage;
  const notionalUsdt = overrides.notionalUsdt ?? marginUsdt * leverage;
  const finalMarginUsdt = overrides.notionalUsdt !== undefined ? roundMoney(notionalUsdt / leverage) : marginUsdt;
  return {
    ...riskDecision,
    marginUsdt: finalMarginUsdt,
    leverage,
    notionalUsdt: roundMoney(notionalUsdt),
  };
}

function formatOrderResult(order: Order, duplicate: boolean, language: Language = "zh"): string {
  if (order.status === "paper_rejected") {
    return language === "zh" ? `模拟失败：${riskReasonText(order.rejectReason, language)}` : `Demo failed: ${riskReasonText(order.rejectReason, language)}`;
  }

  if (language === "en") {
    return [
      duplicate ? "Duplicate click blocked. Same demo order:" : "Demo fill:",
      `Order ID: ${order.id}`,
      `Symbol: ${order.symbol}`,
      `Side: ${directionText(order.direction, language)}`,
      `Margin: ${order.marginUsdt} USDT`,
      `Leverage: ${order.leverage}x`,
      `Position: ${order.notionalUsdt} USDT`,
      `Fill price: ${order.fillPrice ?? "demo market"}`,
      `Take profit: ${order.takeProfit ?? "-"}`,
      `Stop loss: ${order.stopLoss ?? "-"}`,
      `Est. open fee: ${roundMoney(order.notionalUsdt * demoFeeRate).toFixed(2)} USDT`,
      "Mode: demo fill",
    ].join("\n");
  }

  const prefix = duplicate ? "重复点击已拦截，返回同一笔模拟订单：" : "模拟成交：";
  return [
    prefix,
    `订单号：${order.id}`,
    `交易对：${order.symbol}`,
    `方向：${order.direction === "long" ? "做多" : "做空"}`,
    `保证金：${order.marginUsdt} USDT`,
    `杠杆：${order.leverage}x`,
    `预计仓位：${order.notionalUsdt} USDT`,
    `成交价：${order.fillPrice ?? "模拟市价"}`,
    `止盈：${order.takeProfit ?? "-"}`,
    `止损：${order.stopLoss ?? "-"}`,
    `预估开仓手续费：${roundMoney(order.notionalUsdt * demoFeeRate).toFixed(2)} USDT`,
    "模式：模拟成交",
  ].join("\n");
}
