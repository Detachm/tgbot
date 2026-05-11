import { AccountService } from "./account/accountService.js";
import { AuditService } from "./audit/auditService.js";
import { createBot, setupBotMenu, type BotServices } from "./bot/bot.js";
import { requireBotToken } from "./config.js";
import { store } from "./db/memoryStore.js";
import { PaperExecutionProvider } from "./execution/paper/paperExecution.js";
import { PositionPushService } from "./push/positionPushService.js";
import { SignalPushService } from "./push/signalPushService.js";
import { RiskService } from "./risk/riskService.js";
import { SignalService } from "./signal/signalService.js";
import { StrategyService } from "./strategy/strategyService.js";
import { TradeService } from "./trade/tradeService.js";
import { UserService } from "./user/userService.js";

const userService = new UserService(store);
const signalService = new SignalService(store);
const strategyService = new StrategyService(store);
const accountService = new AccountService(store);
const riskService = new RiskService();
const executionProvider = new PaperExecutionProvider();
const tradeService = new TradeService(store, accountService, riskService, executionProvider);
const auditService = new AuditService(store);

const botServices: BotServices = {
  store,
  userService,
  signalService,
  strategyService,
  accountService,
  riskService,
  tradeService,
  auditService,
};
const bot = createBot(requireBotToken(), botServices);
const positionPushService = new PositionPushService(bot, store);
botServices.positionPushService = positionPushService;
const signalPushService = new SignalPushService(bot, {
  store,
  signalService,
  strategyService,
  accountService,
  riskService,
});

try {
  await bot.start({
    onStart: (botInfo) => {
      console.log(`Bot started as @${botInfo.username}`);
      console.log("Execution mode: paper");
      console.log("Signal push interval: 10s");
      void setupBotMenu(bot);
      signalPushService.start();
      positionPushService.start();
    },
  });
} catch (error) {
  console.error("Bot polling stopped", error);
  signalPushService.stop();
  positionPushService.stop();
  process.exitCode = 1;
}
