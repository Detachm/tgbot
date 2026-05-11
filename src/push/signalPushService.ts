import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import type { AccountService } from "../account/accountService.js";
import type { MemoryStore } from "../db/memoryStore.js";
import type { RiskService } from "../risk/riskService.js";
import type { BindingStatus, Signal } from "../domain/types.js";
import type { Language } from "../domain/types.js";
import type { SignalService } from "../signal/signalService.js";
import type { StrategyService } from "../strategy/strategyService.js";
import { directionText, formatTime, strategyName, t } from "../i18n.js";

interface SignalPushServices {
  store: MemoryStore;
  signalService: SignalService;
  strategyService: StrategyService;
  accountService: AccountService;
  riskService: RiskService;
}

const pushIntervalMs = 10_000;
const minUserIntervalMs = 9_000;

export class SignalPushService {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly bot: Bot,
    private readonly services: SignalPushServices,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.pushTick();
    }, pushIntervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async pushTick(): Promise<void> {
    const now = Date.now();
    for (const telegramId of this.services.store.signalSubscribers) {
      const lastPushedAt = this.services.store.lastPushedSignalAt.get(telegramId) ?? 0;
      if (now - lastPushedAt < minUserIntervalMs) {
        continue;
      }

      const user = this.services.store.users.get(telegramId);
      if (!user) {
        continue;
      }

      const strategy = this.services.strategyService.ensureDefaultStrategy(telegramId);
      const signal = this.services.signalService.createFromStrategy(strategy, telegramId);
      const messageId = this.services.store.liveSignalMessages.get(telegramId);
      try {
        if (messageId) {
          await this.safeDeleteMessage(telegramId, messageId);
        }
        const message = await this.bot.api.sendMessage(telegramId, formatPushSignal(signal, now, user.language), {
          reply_markup: signalKeyboard(signal, user.bindingStatus, user.language),
        });
        this.services.store.liveSignalMessages.set(telegramId, message.message_id);
        this.services.store.lastPushedSignalAt.set(telegramId, now);
        this.services.store.addAudit({
          actorTelegramId: telegramId,
          action: messageId ? "signal.replaced" : "signal.auto_pushed",
          entityType: "signal",
          entityId: signal.id,
          metadata: { strategyId: signal.strategyId },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.services.store.addAudit({
          actorTelegramId: telegramId,
          action: "signal.push_failed",
          entityType: "signal",
          entityId: signal.id,
          metadata: { error: errorMessage },
        });
      }
    }
  }

  private async safeDeleteMessage(telegramId: number, messageId: number): Promise<void> {
    try {
      await this.bot.api.deleteMessage(telegramId, messageId);
    } catch {
      this.services.store.liveSignalMessages.delete(telegramId);
    }
  }
}

export function signalKeyboard(
  signal: Signal,
  bindingStatus: BindingStatus = "unbound",
  language: Language = "zh",
): InlineKeyboard {
  if (bindingStatus === "bound") {
    const autoLabel = language === "zh" ? t(language, "autoTrade") : "Auto";
    const paramsLabel = language === "zh" ? t(language, "customParams") : "Params";
    return new InlineKeyboard()
      .text(autoLabel, `auto:${signal.id}`)
      .text(paramsLabel, `custom:${signal.id}`)
      .text(t(language, "pause"), "signal:pause");
  }

  const manualLabel = language === "zh" ? t(language, "manualTrade") : "LBank";
  const bindAutoLabel = language === "zh" ? t(language, "bindThenAuto") : "Bind auto";
  return new InlineKeyboard()
    .url(manualLabel, buildLbankTradeUrl(signal.symbol))
    .text(bindAutoLabel, `auto:${signal.id}`)
    .text(t(language, "pause"), "signal:pause");
}

export function formatPushSignal(signal: Signal, pushedAt = Date.now(), language: Language = "zh"): string {
  const sep = fieldSeparator(language);
  return [
    t(language, "signalTitle"),
    signal.strategyName
      ? `${t(language, "strategy")}${sep}${strategyName(signal.strategyName, signal.strategyAnnualizedReturn, language)}`
      : undefined,
    `${t(language, "updated")}${sep}${formatTime(pushedAt)}`,
    `${t(language, "signalId")}${sep}${signal.id.slice(0, 8)}`,
    "",
    `${signal.symbol} ${directionText(signal.direction, language)}`,
    `${t(language, "entry")}${sep}${signal.entryType === "market" ? t(language, "market") : signal.entryPrice}`,
    `${t(language, "takeProfit")}${sep}${signal.takeProfit}`,
    `${t(language, "stopLoss")}${sep}${signal.stopLoss}`,
    `${t(language, "suggestedRisk")}${sep}${signal.suggestedRiskPercent}%`,
    `${t(language, "suggestedLeverage")}${sep}${signal.suggestedLeverage}x`,
    "",
    t(language, "chooseTradeMode"),
  ]
    .filter((item): item is string => typeof item === "string")
    .join("\n");
}

function fieldSeparator(language: Language): string {
  return language === "zh" ? "：" : ": ";
}

function buildLbankTradeUrl(symbol: string): string {
  return `${config.registerUrl}?symbol=${encodeURIComponent(symbol)}`;
}
