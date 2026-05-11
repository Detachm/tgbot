import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "../config.js";
import type { AccountService } from "../account/accountService.js";
import type { AuditService } from "../audit/auditService.js";
import type { MemoryStore } from "../db/memoryStore.js";
import type { Language, Signal } from "../domain/types.js";
import type { RiskService } from "../risk/riskService.js";
import type { SignalService } from "../signal/signalService.js";
import type { StrategyService } from "../strategy/strategyService.js";
import type { TradeService } from "../trade/tradeService.js";
import type { UserService } from "../user/userService.js";
import { formatPushSignal, signalKeyboard } from "../push/signalPushService.js";
import type { PositionPushService } from "../push/positionPushService.js";
import { formatBoundSignal, formatPositions } from "./messages.js";
import { biasText, directionText, strategyDisplayName, strategyName, t } from "../i18n.js";

export interface BotServices {
  store: MemoryStore;
  userService: UserService;
  signalService: SignalService;
  strategyService: StrategyService;
  accountService: AccountService;
  riskService: RiskService;
  tradeService: TradeService;
  positionPushService?: PositionPushService;
  auditService: AuditService;
}

interface ReplyContext {
  from?: { id: number };
  reply: (text: string, other?: Parameters<Context["reply"]>[1]) => ReturnType<Context["reply"]>;
}

export function createBot(token: string, services: BotServices): Bot {
  const bot = new Bot(token);

  bot.catch((error) => {
    console.error("Bot update failed", error.error);
  });

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    const user = services.userService.getOrCreateUser({
      telegramId: from.id,
      username: from.username,
    });
    if (!user.language) {
      await ctx.reply(t(undefined, "chooseLanguage"), { reply_markup: languageKeyboard() });
      return;
    }

    await startUser(ctx, services, user.telegramId);
  });

  bot.callbackQuery(/^lang:(zh|en)$/, async (ctx) => {
    const language = ctx.match[1] as Language;
    services.userService.setLanguage(ctx.from.id, language);
    await ctx.answerCallbackQuery();
    await replyTemporary(ctx, t(language, "languageSet"));
    await startUser(ctx, services, ctx.from.id);
  });

  bot.command("bind_demo", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    services.userService.bindDemoAccount(from.id);
    await replyTemporary(ctx, t(userLanguage(services, from.id), "demoBound"));
  });

  bot.command("demo_signal", async (ctx) => {
    const from = ctx.from;
    if (!from || !isAdmin(from.id)) {
      await ctx.reply(t(userLanguage(services, from?.id), "noPermission"));
      return;
    }

    const signal = services.signalService.createDemoSignal(from.id);
    await ctx.reply(`${signal.symbol} ${directionText(signal.direction, userLanguage(services, from.id))}`, {
      reply_markup: mainMenuKeyboard(userLanguage(services, from.id)),
    });
  });

  bot.command("strategy_pool", async (ctx) => {
    await ctx.reply(formatStrategyPool(services.strategyService.listPool(), userLanguage(services, ctx.from?.id)), {
      reply_markup: strategyPoolKeyboard(services.strategyService.listPool(), userLanguage(services, ctx.from?.id)),
    });
  });

  bot.command("strategies", async (ctx) => {
    await ctx.reply(formatStrategyPool(services.strategyService.listPool(), userLanguage(services, ctx.from?.id)), {
      reply_markup: strategyPoolKeyboard(services.strategyService.listPool(), userLanguage(services, ctx.from?.id)),
    });
  });

  bot.command("my_strategies", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.reply(formatMyStrategies(services.strategyService.listUserStrategies(from.id), userLanguage(services, from.id)));
  });

  bot.command("mine", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.reply(formatMyStrategies(services.strategyService.listUserStrategies(from.id), userLanguage(services, from.id)));
  });

  bot.command("stop", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    services.store.signalSubscribers.delete(from.id);
    services.store.addAudit({
      actorTelegramId: from.id,
      action: "signal.unsubscribe",
      entityType: "user",
      entityId: String(from.id),
      metadata: {},
    });
    await replyTemporary(ctx, t(userLanguage(services, from.id), "paused"));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(formatHelp(userLanguage(services, ctx.from?.id)), { reply_markup: mainMenuKeyboard(userLanguage(services, ctx.from?.id)) });
  });

  bot.command("publish_strategy", async (ctx) => {
    const from = ctx.from;
    if (!from || !isAdmin(from.id)) {
      await ctx.reply("无 KOL 权限。");
      return;
    }

    const strategy = services.strategyService.createKolStrategy({ creatorTelegramId: from.id });
    await ctx.reply(
      [
        "策略码已发布",
        `${t(userLanguage(services, from.id), "strategy")}：${strategyName(strategy.name, strategy.annualizedReturn, userLanguage(services, from.id))}`,
        `策略码：${strategy.code}`,
        "把这串 6 位策略码发给用户，用户直接发送给 Bot 即可复刻。",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard(userLanguage(services, from.id)) },
    );
  });

  bot.command("latest", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    const user = services.userService.getOrCreateUser({
      telegramId: from.id,
      username: from.username,
    });
    services.store.signalSubscribers.add(user.telegramId);
    const strategy = services.strategyService.ensureDefaultStrategy(user.telegramId);
    const signal = services.signalService.createFromStrategy(strategy, user.telegramId);
    await sendSignalCard(ctx, services, signal);
  });

  bot.command("positions", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.reply(formatPositions(services.accountService.listOpenPositions(from.id), userLanguage(services, from.id)));
  });

  bot.command("balance", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    const account = services.accountService.getSnapshot(from.id);
    const language = userLanguage(services, from.id);
    await ctx.reply(
      language === "zh"
        ? [
            "模拟账户",
            `账户余额：${services.accountService.getBalance(from.id).toFixed(2)} USDT`,
            `账户权益：${account.equityUsdt.toFixed(2)} USDT`,
            `可用余额：${account.availableUsdt.toFixed(2)} USDT`,
            `占用保证金：${services.accountService.getUsedMargin(from.id).toFixed(2)} USDT`,
            `未实现盈亏：${services.accountService.getUnrealizedPnl(from.id).toFixed(2)} USDT`,
          ].join("\n")
        : [
            "Demo account",
            `Balance: ${services.accountService.getBalance(from.id).toFixed(2)} USDT`,
            `Equity: ${account.equityUsdt.toFixed(2)} USDT`,
            `Available: ${account.availableUsdt.toFixed(2)} USDT`,
            `Used margin: ${services.accountService.getUsedMargin(from.id).toFixed(2)} USDT`,
            `Unrealized PnL: ${services.accountService.getUnrealizedPnl(from.id).toFixed(2)} USDT`,
          ].join("\n"),
    );
  });

  bot.command("close_demo", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.reply(await services.tradeService.closeFirstOpenPosition(from.id, userLanguage(services, from.id)));
  });

  bot.command("admin_stop", async (ctx) => {
    const from = ctx.from;
    if (!from || !isAdmin(from.id)) {
      await ctx.reply("无管理员权限。");
      return;
    }
    services.store.systemState.newTradesEnabled = false;
    services.store.addAudit({
      actorTelegramId: from.id,
      action: "admin.stop_new_trades",
      entityType: "system",
      metadata: {},
    });
    await ctx.reply("已关闭新开仓。");
  });

  bot.command("admin_resume", async (ctx) => {
    const from = ctx.from;
    if (!from || !isAdmin(from.id)) {
      await ctx.reply("无管理员权限。");
      return;
    }
    services.store.systemState.newTradesEnabled = true;
    services.store.addAudit({
      actorTelegramId: from.id,
      action: "admin.resume_new_trades",
      entityType: "system",
      metadata: {},
    });
    await ctx.reply("已恢复新开仓。");
  });

  bot.command("audit", async (ctx) => {
    const from = ctx.from;
    if (!from || !isAdmin(from.id)) {
      await ctx.reply("无管理员权限。");
      return;
    }
    await ctx.reply(services.auditService.latest() || "暂无审计日志。");
  });

  bot.callbackQuery("menu:latest", async (ctx) => {
    await ctx.answerCallbackQuery();
    const user = services.userService.getOrCreateUser({
      telegramId: ctx.from.id,
      username: ctx.from.username,
    });
    const strategy = services.strategyService.ensureDefaultStrategy(user.telegramId);
    const signal = services.signalService.createFromStrategy(strategy, user.telegramId);
    await sendSignalCard(ctx, services, signal);
  });

  bot.callbackQuery("menu:bind", async (ctx) => {
    const from = ctx.from;
    const language = userLanguage(services, from.id);
    services.userService.bindDemoAccount(from.id);
    await ctx.answerCallbackQuery(t(language, "demoBound"));
    await replyTemporary(ctx, t(language, "demoBound"));
  });

  bot.callbackQuery("menu:strategy_pool", async (ctx) => {
    await ctx.answerCallbackQuery();
    const strategies = services.strategyService.listPool();
    const language = userLanguage(services, ctx.from.id);
    await ctx.reply(formatStrategyPool(strategies, language), { reply_markup: strategyPoolKeyboard(strategies, language) });
  });

  bot.callbackQuery("menu:my_strategies", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(formatMyStrategies(services.strategyService.listUserStrategies(ctx.from.id), userLanguage(services, ctx.from.id)));
  });

  bot.callbackQuery("menu:stop_push", async (ctx) => {
    const language = userLanguage(services, ctx.from.id);
    services.store.signalSubscribers.delete(ctx.from.id);
    await ctx.answerCallbackQuery(t(language, "pause"));
    await replyTemporary(ctx, t(language, "paused"));
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(formatHelp(userLanguage(services, ctx.from.id)), { reply_markup: mainMenuKeyboard(userLanguage(services, ctx.from.id)) });
  });

  bot.callbackQuery(/^strategy:copy:(.+)$/, async (ctx) => {
    const language = userLanguage(services, ctx.from.id);
    const strategy = services.strategyService.replicateByCode(ctx.from.id, ctx.match[1]);
    await ctx.answerCallbackQuery(strategy ? t(language, "copied") : t(language, "invalidStrategyCode"));
    if (!strategy) {
      await ctx.reply(t(language, "strategyCodeExpired"));
      return;
    }
    await ctx.reply(formatReplicatedStrategy(strategy, language), { reply_markup: mainMenuKeyboard(language) });
    const signal = services.signalService.createFromStrategy(strategy, ctx.from.id);
    await sendSignalCard(ctx, services, signal);
  });

  bot.callbackQuery(/^auto:(.+)$/, async (ctx) => {
    const signal = services.signalService.getPublished(ctx.match[1]);
    const user = services.userService.getOrCreateUser({
      telegramId: ctx.from.id,
      username: ctx.from.username,
    });
    const language = userLanguage(services, ctx.from.id);
    await ctx.answerCallbackQuery();

    if (!signal) {
      await ctx.reply(t(language, "signalExpired"));
      return;
    }

    if (user.bindingStatus !== "bound") {
      await ctx.reply(
        [
          t(language, "bindRequiredTitle"),
          t(language, "bindRequiredHint"),
        ].join("\n"),
        { reply_markup: new InlineKeyboard().text(t(language, "bindDemoAccount"), "menu:bind").url(t(language, "manualOpenLbank"), buildLbankTradeUrl(signal.symbol)) },
      );
      return;
    }

    const account = services.accountService.getSnapshot(user.telegramId);
    const openPositions = services.accountService.listOpenPositions(user.telegramId);
    const decision = services.riskService.calculate({ user, signal, account, openPositions });
    if (!decision.allowed) {
      await ctx.reply(formatBoundSignal(signal, account, decision, language));
      return;
    }

    const intent = services.tradeService.createIntent({ user, signal });
    await replyTemporary(ctx, formatBoundSignal(signal, account, decision, language), {
      reply_markup: new InlineKeyboard().text(t(language, "confirmAuto"), `confirm:${intent.id}`).row().text(t(language, "cancel"), "cancel"),
    });
  });

  bot.callbackQuery(/^custom:(.+)$/, async (ctx) => {
    const signal = services.signalService.getPublished(ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!signal) {
      await replyTemporary(ctx, t(userLanguage(services, ctx.from.id), "signalExpired"));
      return;
    }

    const user = services.userService.getOrCreateUser({
      telegramId: ctx.from.id,
      username: ctx.from.username,
    });
    if (user.bindingStatus !== "bound") {
      await replyTemporary(ctx, t(userLanguage(services, ctx.from.id), "customNeedBind"));
      return;
    }

    services.store.pendingCustomInputs.set(ctx.from.id, { signalId: signal.id, createdAt: Date.now() });
    await replyTemporary(ctx, formatCustomInputPrompt(signal, userLanguage(services, ctx.from.id)), {
      reply_markup: new InlineKeyboard().text(t(userLanguage(services, ctx.from.id), "cancel"), "cancel_custom"),
    }, 20_000);
  });

  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    const intentId = ctx.match[1];
    const result = await services.tradeService.confirmIntent(intentId, userLanguage(services, ctx.from.id));
    await ctx.answerCallbackQuery();
    await replyTemporary(ctx, result.message);
    if (result.position && services.positionPushService) {
      await services.positionPushService.upsertPositionCard(result.position);
    }
  });

  bot.callbackQuery("signal:pause", async (ctx) => {
    const language = userLanguage(services, ctx.from.id);
    services.store.signalSubscribers.delete(ctx.from.id);
    const liveMessageId = services.store.liveSignalMessages.get(ctx.from.id);
    if (liveMessageId) {
      await safeDelete(ctx, liveMessageId);
      services.store.liveSignalMessages.delete(ctx.from.id);
    }
    await ctx.answerCallbackQuery(t(language, "pausePush"));
    await replyTemporary(ctx, t(language, "paused"));
  });

  bot.callbackQuery(/^close_position:(.+)$/, async (ctx) => {
    const result = await services.tradeService.closePosition(ctx.from.id, ctx.match[1], userLanguage(services, ctx.from.id));
    await ctx.answerCallbackQuery();
    await ctx.reply(result);
  });

  bot.callbackQuery("cancel", async (ctx) => {
    await ctx.answerCallbackQuery(t(userLanguage(services, ctx.from.id), "cancel"));
  });

  bot.callbackQuery("cancel_custom", async (ctx) => {
    const language = userLanguage(services, ctx.from.id);
    services.store.pendingCustomInputs.delete(ctx.from.id);
    await ctx.answerCallbackQuery(t(language, "cancel"));
    await replyTemporary(ctx, t(language, "customCancelled"));
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const pendingCustomInput = services.store.pendingCustomInputs.get(ctx.from.id);
    if (pendingCustomInput) {
      await handleCustomInput(ctx, services, text, pendingCustomInput.signalId);
      return;
    }

    if (!/^[A-Za-z0-9]{6}$/.test(text)) {
      return;
    }

    const strategy = services.strategyService.replicateByCode(ctx.from.id, text);
    if (!strategy) {
      await ctx.reply(t(userLanguage(services, ctx.from.id), "strategyCodeNotFound"));
      return;
    }

    await ctx.reply(formatReplicatedStrategy(strategy, userLanguage(services, ctx.from.id)), { reply_markup: mainMenuKeyboard(userLanguage(services, ctx.from.id)) });
    services.store.signalSubscribers.add(ctx.from.id);
    const signal = services.signalService.createFromStrategy(strategy, ctx.from.id);
    await sendSignalCard(ctx, services, signal);
  });

  return bot;
}

async function replyTemporary(
  ctx: Context,
  text: string,
  other?: Parameters<Context["reply"]>[1],
  ttlMs = 5_000,
): Promise<void> {
  const message = await ctx.reply(text, other);
  setTimeout(() => {
    void safeDelete(ctx, message.message_id);
  }, ttlMs);
}

async function safeDelete(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat?.id ?? ctx.from?.id ?? 0, messageId);
  } catch {
    // Telegram may reject deletion for old or already deleted messages.
  }
}

async function handleCustomInput(
  ctx: Context & { from: NonNullable<Context["from"]>; message: NonNullable<Context["message"]> },
  services: BotServices,
  text: string,
  signalId: string,
): Promise<void> {
  const signal = services.signalService.getPublished(signalId);
  if (!signal) {
    services.store.pendingCustomInputs.delete(ctx.from.id);
    await replyTemporary(ctx, t(userLanguage(services, ctx.from.id), "signalExpired"));
    return;
  }

  const parsed = parseCustomTradeInput(text);
  if (!parsed) {
    await replyTemporary(ctx, t(userLanguage(services, ctx.from.id), "badCustomInput"), undefined, 8_000);
    return;
  }

  const user = services.userService.getOrCreateUser({
    telegramId: ctx.from.id,
    username: ctx.from.username,
  });
  if (user.bindingStatus !== "bound") {
    services.store.pendingCustomInputs.delete(ctx.from.id);
    await replyTemporary(ctx, t(userLanguage(services, ctx.from.id), "customNeedBind"));
    return;
  }

  const language = userLanguage(services, ctx.from.id);
  const validationError = validateCustomTradeInput(signal, parsed, language);
  if (validationError) {
    await replyTemporary(ctx, validationError, undefined, 8_000);
    return;
  }

  const marginUsdt = parsed.notionalUsdt / parsed.leverage;
  const account = services.accountService.getSnapshot(user.telegramId);
  if (marginUsdt > account.availableUsdt) {
    await replyTemporary(
      ctx,
      t(language, "insufficientAvailable").replace("{margin}", marginUsdt.toFixed(2)).replace("{available}", account.availableUsdt.toFixed(2)),
      undefined,
      8_000,
    );
    return;
  }

  const intent = services.tradeService.createIntent({
    user,
    signal,
    overrides: {
      leverage: parsed.leverage,
      notionalUsdt: parsed.notionalUsdt,
      takeProfit: parsed.takeProfit,
      stopLoss: parsed.stopLoss,
    },
  });
  services.store.pendingCustomInputs.delete(ctx.from.id);
  await replyTemporary(ctx, formatCustomPreview(signal, account.availableUsdt, parsed, language), {
    reply_markup: new InlineKeyboard().text(t(language, "confirmAuto"), `confirm:${intent.id}`).row().text(t(language, "cancel"), "cancel"),
  }, 12_000);
}

function parseCustomTradeInput(text: string):
  | {
      leverage: number;
      notionalUsdt: number;
      takeProfit: number;
      stopLoss: number;
    }
  | undefined {
  const parts = text
    .replace(/[xX倍,，]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length !== 4) {
    return undefined;
  }

  const [leverage, notionalUsdt, takeProfit, stopLoss] = parts.map(Number);
  if ([leverage, notionalUsdt, takeProfit, stopLoss].some((item) => !Number.isFinite(item) || item <= 0)) {
    return undefined;
  }

  return { leverage, notionalUsdt, takeProfit, stopLoss };
}

function validateCustomTradeInput(
  signal: Signal,
  input: { leverage: number; notionalUsdt: number; takeProfit: number; stopLoss: number },
  language: Language = "zh",
): string | undefined {
  if (!Number.isInteger(input.leverage) || input.leverage > 10) {
    return t(language, "invalidLeverage");
  }

  if (input.notionalUsdt < 10 || input.notionalUsdt > 10000) {
    return t(language, "invalidPosition");
  }

  if (signal.direction === "long" && input.takeProfit <= input.stopLoss) {
    return t(language, "invalidLongTpSl");
  }

  if (signal.direction === "short" && input.takeProfit >= input.stopLoss) {
    return t(language, "invalidShortTpSl");
  }

  return undefined;
}

export async function setupBotMenu(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([
    { command: "start", description: "Start / 启动助手" },
    { command: "strategies", description: "Strategies / 策略池" },
    { command: "mine", description: "My strategies / 我的策略" },
    { command: "balance", description: "Balance / 账户余额" },
    { command: "positions", description: "Positions / 当前持仓" },
    { command: "stop", description: "Pause signals / 暂停信号" },
    { command: "help", description: "Help / 帮助" },
  ]);
}

function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("中文", "lang:zh").text("English", "lang:en");
}

async function startUser(ctx: Context, services: BotServices, telegramId: number): Promise<void> {
  const user = services.store.users.get(telegramId);
  const language = user?.language ?? "zh";
  const strategy = services.strategyService.ensureDefaultStrategy(telegramId);
  const signal = services.signalService.createFromStrategy(strategy, telegramId);
  services.store.signalSubscribers.add(telegramId);

  await ctx.reply(formatWelcome(user?.bindingStatus ?? "unbound", strategy, language), {
    reply_markup: mainMenuKeyboard(language),
  });
  await sendSignalCard(ctx, services, signal);
}

function userLanguage(services: BotServices, telegramId: number | undefined): Language {
  if (telegramId === undefined) {
    return "zh";
  }
  return services.store.users.get(telegramId)?.language ?? "zh";
}

function mainMenuKeyboard(language: Language = "zh"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "refreshSignal"), "menu:latest")
    .text(t(language, "bindAccount"), "menu:bind")
    .row()
    .text(t(language, "strategyPool"), "menu:strategy_pool")
    .text(t(language, "myStrategies"), "menu:my_strategies")
    .row()
    .text(t(language, "pausePush"), "menu:stop_push")
    .text(t(language, "help"), "menu:help");
}

async function sendSignalCard(
  ctx: ReplyContext,
  services: BotServices,
  signal: Signal,
): Promise<void> {
  const text = [
    formatPushSignal(signal, Date.now(), userLanguage(services, ctx.from?.id)),
  ].join("\n");

  services.store.addAudit({
    actorTelegramId: ctx.from?.id,
    action: "signal.delivered",
    entityType: "signal",
    entityId: signal.id,
    metadata: { strategyId: signal.strategyId, mode: "strategy_realtime_demo" },
  });

  if (ctx.from?.id) {
    const oldMessageId = services.store.liveSignalMessages.get(ctx.from.id);
    if (oldMessageId) {
      await safeDelete(ctx as Context, oldMessageId);
      services.store.liveSignalMessages.delete(ctx.from.id);
    }
  }

  const user = ctx.from?.id ? services.store.users.get(ctx.from.id) : undefined;
  const message = await ctx.reply(text, { reply_markup: signalKeyboard(signal, user?.bindingStatus, user?.language) });
  if (ctx.from?.id) {
    services.store.liveSignalMessages.set(ctx.from.id, message.message_id);
  }
}

function formatWelcome(
  bindingStatus: string,
  strategy: {
    name: string;
    code: string;
    heat: number;
    annualizedReturn?: number;
    symbol: string;
    directionBias: "long" | "short";
  },
  language: Language = "zh",
): string {
  const sep = fieldSeparator(language);
  return [
    t(language, "welcomeTitle"),
    "",
    `${t(language, "accountStatus")}${sep}${bindingStatus === "bound" ? t(language, "bound") : t(language, "unbound")}`,
    `${t(language, "defaultStrategy")}${sep}${strategyName(strategy.name, strategy.annualizedReturn, language)} | ${strategy.code}`,
    `${strategy.symbol} ${biasText(strategy.directionBias, language)} | ${t(language, "heat")} ${strategy.heat}`,
    "",
    t(language, "autoRefreshHint"),
  ].join("\n");
}

function strategyPoolKeyboard(strategies: Array<{ code: string; name: string }>, language: Language = "zh"): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const strategy of strategies) {
    keyboard.text(`${t(language, "copiedPrefix")}: ${strategyDisplayName(strategy.name, language)}`, `strategy:copy:${strategy.code}`).row();
  }
  return keyboard;
}

function formatStrategyPool(
  strategies: Array<{
    code: string;
    name: string;
    description: string;
    symbol: string;
    directionBias: "long" | "short";
    riskPercent: number;
    leverage: number;
    heat: number;
    annualizedReturn?: number;
  }>,
  language: Language = "zh",
): string {
  return [
    t(language, "strategyPool"),
    language === "zh" ? "选择一个策略即可复刻。" : "Choose a strategy to copy.",
    "",
    ...strategies.map((strategy) =>
      [
        `${strategyName(strategy.name, strategy.annualizedReturn, language)} | ${strategy.code}`,
        `${strategy.symbol} ${biasText(strategy.directionBias, language)} | ${t(language, "heat")} ${strategy.heat} | ${language === "zh" ? "风险" : "Risk"} ${strategy.riskPercent}% | ${strategy.leverage}x`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

function formatMyStrategies(
  strategies: Array<{
    code: string;
    name: string;
    symbol: string;
    directionBias: "long" | "short";
    riskPercent: number;
    leverage: number;
    heat?: number;
    annualizedReturn?: number;
  }>,
  language: Language = "zh",
): string {
  if (strategies.length === 0) {
    return language === "zh"
      ? "你还没有复刻策略。进入策略池选择一个，或输入 KOL 发布的 6 位策略码。"
      : "No copied strategy yet. Choose from the strategy pool or send a 6-character KOL code.";
  }

  return [
    t(language, "myStrategies"),
    "",
    ...strategies.map(
      (strategy) =>
        `${strategyName(strategy.name, strategy.annualizedReturn, language)} | ${strategy.code}\n${strategy.symbol} ${biasText(strategy.directionBias, language)} | ${t(language, "heat")} ${strategy.heat ?? "-"} | ${language === "zh" ? "风险" : "Risk"} ${strategy.riskPercent}% | ${strategy.leverage}x`,
    ),
  ].join("\n\n");
}

function formatReplicatedStrategy(strategy: {
  code: string;
  name: string;
  symbol: string;
  directionBias: "long" | "short";
  riskPercent: number;
  leverage: number;
  heat?: number;
  annualizedReturn?: number;
}, language: Language = "zh"): string {
  const sep = fieldSeparator(language);
  return [
    language === "zh" ? "策略已复刻到你的 Bot" : "Strategy copied to your bot",
    `${t(language, "strategy")}${sep}${strategyName(strategy.name, strategy.annualizedReturn, language)}`,
    `${language === "zh" ? "策略码" : "Code"}${sep}${strategy.code}`,
    `${language === "zh" ? "标的" : "Symbol"}${sep}${strategy.symbol}`,
    `${language === "zh" ? "方向偏好" : "Bias"}${sep}${biasText(strategy.directionBias, language)}`,
    `${t(language, "heat")}${sep}${strategy.heat ?? "-"}`,
    `${language === "zh" ? "风险" : "Risk"}${sep}${strategy.riskPercent}%`,
    `${language === "zh" ? "杠杆" : "Leverage"}${sep}${strategy.leverage}x`,
    "",
    language === "zh" ? "后续信号和模拟交易会使用你的账户上下文展示。" : "Future signals and demo trades will use your account context.",
  ].join("\n");
}

function formatHelp(language: Language = "zh"): string {
  if (language === "en") {
    return [
      "Help",
      "",
      "/start Start and subscribe to default strategy",
      "/strategies View strategy pool",
      "/mine View my strategies",
      "/balance View demo balance",
      "/positions View demo positions",
      "/stop Pause signal push",
      "",
      "Send a 6-character strategy code to copy a KOL strategy.",
    ].join("\n");
  }
  return [
    "使用说明",
    "",
    "/start 启动并订阅默认策略",
    "/strategies 查看策略池",
    "/mine 查看我的策略",
    "/balance 查看 demo 余额",
    "/positions 查看模拟持仓",
    "/stop 暂停信号推送",
    "",
    "输入 6 位策略码可复刻 KOL 策略。",
  ].join("\n");
}

function formatCustomInputPrompt(signal: Signal, language: Language = "zh"): string {
  if (language === "en") {
    return [
      "Custom params",
      `Symbol: ${signal.symbol}`,
      `Side: ${directionText(signal.direction, language)}`,
      "",
      t(language, "customPrompt"),
    ].join("\n");
  }
  return [
    "自定参数",
    `交易对：${signal.symbol}`,
    `方向：${signal.direction === "long" ? "做多" : "做空"}`,
    "",
    "请输入：杠杆 仓位 止盈 止损",
    "示例：5 150 63800 62200",
    "",
    "保证金将自动计算：仓位 / 杠杆",
  ].join("\n");
}

function formatCustomPreview(
  signal: Signal,
  availableUsdt: number,
  input: { leverage: number; notionalUsdt: number; takeProfit: number; stopLoss: number },
  language: Language = "zh",
): string {
  const marginUsdt = input.notionalUsdt / input.leverage;
  if (language === "en") {
    return [
      `${signal.symbol} ${directionText(signal.direction, language)}`,
      "",
      `Available: ${availableUsdt.toFixed(2)} USDT`,
      `Leverage: ${input.leverage}x`,
      `Position: ${input.notionalUsdt.toFixed(2)} USDT`,
      `Margin: ${marginUsdt.toFixed(2)} USDT`,
      `Take profit: ${input.takeProfit}`,
      `Stop loss: ${input.stopLoss}`,
      "",
      "Confirm to place a demo auto trade.",
    ].join("\n");
  }
  return [
    `${signal.symbol} ${signal.direction === "long" ? "做多" : "做空"}`,
    "",
    `可用余额：${availableUsdt.toFixed(2)} USDT`,
    `自定杠杆：${input.leverage}x`,
    `自定仓位：${input.notionalUsdt.toFixed(2)} USDT`,
    `自动计算保证金：${marginUsdt.toFixed(2)} USDT`,
    `自定止盈：${input.takeProfit}`,
    `自定止损：${input.stopLoss}`,
    "",
    "确认后将模拟自动交易。",
  ].join("\n");
}

function buildLbankTradeUrl(symbol: string): string {
  return `${config.registerUrl}?symbol=${encodeURIComponent(symbol)}`;
}

function fieldSeparator(language: Language): string {
  return language === "zh" ? "：" : ": ";
}

function isAdmin(telegramId: number): boolean {
  if (config.adminTelegramIds.size === 0) {
    return true;
  }

  return config.adminTelegramIds.has(telegramId);
}
