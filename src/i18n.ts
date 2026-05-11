import type { Direction, Language } from "./domain/types.js";

export function directionText(direction: Direction, language: Language): string {
  if (language === "zh") {
    return direction === "long" ? "做多" : "做空";
  }
  return direction === "long" ? "Long" : "Short";
}

export function biasText(direction: Direction, language: Language): string {
  if (language === "zh") {
    return direction === "long" ? "偏多" : "偏空";
  }
  return direction === "long" ? "Long bias" : "Short bias";
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(timestamp));
}

export function strategyName(name: string, annualizedReturn: number | undefined, language: Language): string {
  const localizedName = strategyDisplayName(name, language);
  if (annualizedReturn === undefined) {
    return localizedName;
  }
  return language === "zh" ? `${localizedName}（年化 ${annualizedReturn}%）` : `${localizedName} (${annualizedReturn}% annualized)`;
}

export function strategyDisplayName(name: string, language: Language): string {
  if (language === "zh") {
    return name;
  }

  const names: Record<string, string> = {
    "BTC 稳健突破": "BTC Steady Breakout",
    "ETH 回踩跟随": "ETH Pullback Follow",
    "BTC 防守空头": "BTC Defensive Short",
    "KOL 快速策略": "KOL Quick Strategy",
  };
  return names[name] ?? name;
}

export function riskReasonText(reason: string | undefined, language: Language): string {
  if (!reason) {
    return language === "zh" ? "风控拒绝" : "risk rejected";
  }
  if (language === "zh") {
    return reason;
  }

  const reasons: Record<string, string> = {
    "杠杆超过平台 demo 上限 10x": "Leverage exceeds the demo limit of 10x",
    "可用余额不足": "Available balance is insufficient",
    "同一交易对同方向已有持仓，未开启加仓": "An open position already exists for this symbol and side. Adding is disabled.",
    "模拟拒绝：下单参数无效": "Demo rejected: invalid order parameters",
    "交易意图不存在": "Trade intent does not exist",
  };
  return reasons[reason] ?? reason;
}

export const text = {
  zh: {
    chooseLanguage: "请选择语言 / Choose language",
    languageSet: "语言已设置为中文。",
    welcomeTitle: "欢迎回来，已为你启用当前热度最高策略。",
    accountStatus: "账户状态",
    bound: "已绑定 demo 账户",
    unbound: "未绑定",
    defaultStrategy: "默认策略",
    heat: "热度",
    autoRefreshHint: "下方信号会自动刷新。输入 6 位策略码可切换策略。",
    refreshSignal: "刷新信号",
    bindAccount: "绑定账户",
    strategyPool: "策略池",
    myStrategies: "我的策略",
    pause: "暂停",
    pausePush: "暂停推送",
    help: "帮助",
    autoTrade: "自动交易",
    customParams: "自定参数",
    manualTrade: "手动交易",
    bindThenAuto: "绑定后自动交易",
    signalTitle: "策略实时信号",
    strategy: "策略",
    updated: "更新",
    signalId: "信号编号",
    entry: "入场",
    market: "市价",
    takeProfit: "止盈",
    stopLoss: "止损",
    suggestedRisk: "建议风险",
    suggestedLeverage: "建议杠杆",
    chooseTradeMode: "请选择交易方式。",
    demoBound: "已绑定 demo 账户。",
    noPermission: "无管理员权限。",
    signalExpired: "信号已失效。",
    customNeedBind: "自定参数需要先绑定账户。",
    paused: "已暂停策略信号推送。发送 /start 可重新开启。",
    customPrompt: "请输入：杠杆 仓位 止盈 止损\n示例：5 150 63800 62200\n\n保证金将自动计算：仓位 / 杠杆",
    badCustomInput: "格式不正确，请输入：杠杆 仓位 止盈 止损，例如：5 150 63800 62200",
    customCancelled: "已取消自定参数。",
    confirmAuto: "确认模拟自动交易",
    cancel: "取消",
    copied: "已复刻",
    invalidStrategyCode: "策略码无效",
    strategyCodeExpired: "策略码无效或已过期。",
    strategyCodeNotFound: "没有找到这个策略码。请确认 6 位码是否正确。",
    bindRequiredTitle: "自动交易需要先绑定账户。",
    bindRequiredHint: "demo 阶段点击下方按钮会绑定演示账户；正式版会要求绑定 LBank API Key。",
    bindDemoAccount: "绑定 demo 账户",
    manualOpenLbank: "手动交易：打开 LBank",
    copiedPrefix: "复刻",
    closeDemoPosition: "模拟平仓",
    invalidLeverage: "杠杆必须是 1-10 的整数。",
    invalidPosition: "仓位需在 10-10000 USDT 之间。",
    invalidLongTpSl: "做多时止盈必须高于止损。",
    invalidShortTpSl: "做空时止盈必须低于止损。",
    insufficientAvailable: "可用余额不足。需要保证金 {margin} USDT，当前可用 {available} USDT。",
  },
  en: {
    chooseLanguage: "Please choose a language / 请选择语言",
    languageSet: "Language set to English.",
    welcomeTitle: "Welcome back. The hottest strategy is enabled.",
    accountStatus: "Account",
    bound: "Demo account bound",
    unbound: "Not bound",
    defaultStrategy: "Default strategy",
    heat: "Heat",
    autoRefreshHint: "Signals refresh automatically below. Send a 6-character code to switch strategy.",
    refreshSignal: "Refresh signal",
    bindAccount: "Bind account",
    strategyPool: "Strategy pool",
    myStrategies: "My strategies",
    pause: "Pause",
    pausePush: "Pause push",
    help: "Help",
    autoTrade: "Auto trade",
    customParams: "Custom params",
    manualTrade: "Manual trade",
    bindThenAuto: "Bind for auto",
    signalTitle: "Live strategy signal",
    strategy: "Strategy",
    updated: "Updated",
    signalId: "Signal ID",
    entry: "Entry",
    market: "Market",
    takeProfit: "Take profit",
    stopLoss: "Stop loss",
    suggestedRisk: "Suggested risk",
    suggestedLeverage: "Suggested leverage",
    chooseTradeMode: "Choose a trade mode.",
    demoBound: "Demo account bound.",
    noPermission: "No admin permission.",
    signalExpired: "Signal expired.",
    customNeedBind: "Custom params require account binding first.",
    paused: "Signal push paused. Send /start to resume.",
    customPrompt: "Input: leverage position take-profit stop-loss\nExample: 5 150 63800 62200\n\nMargin is calculated automatically: position / leverage",
    badCustomInput: "Invalid format. Input: leverage position take-profit stop-loss, e.g. 5 150 63800 62200",
    customCancelled: "Custom params cancelled.",
    confirmAuto: "Confirm demo auto trade",
    cancel: "Cancel",
    copied: "Copied",
    invalidStrategyCode: "Invalid strategy code",
    strategyCodeExpired: "Invalid or expired strategy code.",
    strategyCodeNotFound: "Strategy code not found. Please check the 6-character code.",
    bindRequiredTitle: "Auto trading requires account binding first.",
    bindRequiredHint: "In demo mode, the button below binds a demo account. The production version will require an LBank API Key.",
    bindDemoAccount: "Bind demo account",
    manualOpenLbank: "Manual trade: open LBank",
    copiedPrefix: "Copy",
    closeDemoPosition: "Close demo position",
    invalidLeverage: "Leverage must be an integer from 1 to 10.",
    invalidPosition: "Position must be between 10 and 10000 USDT.",
    invalidLongTpSl: "For long trades, take profit must be higher than stop loss.",
    invalidShortTpSl: "For short trades, take profit must be lower than stop loss.",
    insufficientAvailable: "Available balance is insufficient. Required margin: {margin} USDT. Current available: {available} USDT.",
  },
} satisfies Record<Language, Record<string, string>>;

export function t(language: Language | undefined, key: keyof typeof text.zh): string {
  return text[language ?? "zh"][key];
}
