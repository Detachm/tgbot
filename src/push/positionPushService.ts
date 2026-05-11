import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { MemoryStore } from "../db/memoryStore.js";
import type { Language, Position } from "../domain/types.js";
import { calculatePnl, formatSigned, getMockMarkPrice } from "../trade/pnl.js";
import { directionText, formatTime, t } from "../i18n.js";

const pnlIntervalMs = 5_000;

export class PositionPushService {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly bot: Bot,
    private readonly store: MemoryStore,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.pushTick();
    }, pnlIntervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async pushTick(): Promise<void> {
    for (const position of this.store.positions.values()) {
      if (position.status !== "open") {
        continue;
      }

      await this.upsertPositionCard(position);
    }
  }

  async upsertPositionCard(position: Position): Promise<void> {
    const language = this.store.users.get(position.userTelegramId)?.language ?? "zh";
    const text = formatPositionPnl(position, Date.now(), language);
    const messageId = this.store.positionMessages.get(position.id);
    try {
      if (messageId) {
        await this.bot.api.editMessageText(position.userTelegramId, messageId, text, {
          reply_markup: positionKeyboard(position, language),
        });
        return;
      }

      const message = await this.bot.api.sendMessage(position.userTelegramId, text, {
        reply_markup: positionKeyboard(position, language),
      });
      this.store.positionMessages.set(position.id, message.message_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (/message is not modified/i.test(errorMessage)) {
        return;
      }
      this.store.addAudit({
        actorTelegramId: position.userTelegramId,
        action: "position.pnl_push_failed",
        entityType: "position",
        entityId: position.id,
        metadata: { error: errorMessage },
      });
    }
  }
}

export function formatPositionPnl(position: Position, timestamp = Date.now(), language: Language = "zh"): string {
  const markPrice = getMockMarkPrice(position, timestamp);
  const pnl = calculatePnl(position, markPrice);
  const sep = language === "zh" ? "：" : ": ";

  return [
    language === "zh" ? "模拟持仓浮盈浮亏" : "Demo position PnL",
    `${language === "zh" ? "持仓编号" : "Position ID"}${sep}${position.id.slice(0, 8)}`,
    `${language === "zh" ? "交易对" : "Symbol"}${sep}${position.symbol}`,
    `${language === "zh" ? "方向" : "Side"}${sep}${directionText(position.direction, language)}`,
    `${language === "zh" ? "保证金" : "Margin"}${sep}${position.marginUsdt.toFixed(2)} USDT`,
    `${language === "zh" ? "仓位" : "Position"}${sep}${position.notionalUsdt.toFixed(2)} USDT`,
    `${language === "zh" ? "杠杆" : "Leverage"}${sep}${position.leverage}x`,
    `${language === "zh" ? "开仓价" : "Entry"}${sep}${position.entryPrice.toFixed(2)}`,
    `${language === "zh" ? "标记价" : "Mark"}${sep}${markPrice.toFixed(2)}`,
    `${language === "zh" ? "止盈" : "TP"}${sep}${position.takeProfit ?? "-"}`,
    `${language === "zh" ? "止损" : "SL"}${sep}${position.stopLoss ?? "-"}`,
    `${language === "zh" ? "毛盈亏" : "Gross PnL"}${sep}${formatSigned(pnl.grossPnlUsdt)} USDT (${formatSigned(pnl.grossPnlPct)}%)`,
    `${language === "zh" ? "预估手续费" : "Est. fee"}${sep}-${(pnl.openFeeUsdt + pnl.closeFeeUsdt).toFixed(2)} USDT`,
    `${language === "zh" ? "净浮盈亏" : "Net PnL"}${sep}${formatSigned(pnl.netPnlUsdt)} USDT (${formatSigned(pnl.netPnlPct)}%)`,
    `${language === "zh" ? "更新" : "Updated"}${sep}${formatTime(timestamp)}`,
  ].join("\n");
}

function positionKeyboard(position: Position, language: Language): InlineKeyboard {
  return new InlineKeyboard().text(t(language, "closeDemoPosition"), `close_position:${position.id}`);
}
