# Contract Assistant Bot KOL Partnership Introduction

## One-Line Summary

Contract Assistant Bot is a Telegram-based contract trading assistant demo. It turns a KOL's strategy into a copyable, push-based, paper-trading experience with live PnL cards, helping users move from simply reading signals to following a strategy and eventually enabling automated trading.

The current version is a demo environment. It does not place real orders. All fills, positions, balances, and PnL are simulated for product validation and partnership discussion.

## Why This Product Exists

Many trading communities still distribute strategies through plain text calls, screenshots, and manual explanations. After seeing a signal, users still need to interpret direction, leverage, position size, TP/SL, and the trading entry point by themselves.

This bot is designed to solve three problems:

- Standardized signals: turn strategy calls into structured Telegram signal cards.
- Lower follow barrier: users can copy a KOL strategy by entering a 6-character strategy code.
- Closed feedback loop: users can see demo fills, live PnL, and close reports instead of only receiving a signal.

## What The Current Demo Supports

- Language selection between Chinese and English.
- Automatically loads the hottest strategy and starts live signal push.
- Strategy pool where users can choose a strategy with one tap.
- KOL strategy code: a KOL can publish a 6-character code, and users can copy the strategy by sending the code to the bot.
- A fresh signal card is pushed every 10 seconds. The old signal card is deleted to avoid spamming the chat.
- Unbound users can use a manual trading entry.
- After binding a demo account, users can choose demo auto trading.
- Users can customize leverage, position size, take profit, and stop loss. Margin is calculated automatically.
- After a demo fill, the bot creates a live PnL card and refreshes it every 5 seconds.
- Multiple demo positions are displayed as separate PnL cards.
- Users can close a demo position and receive a detailed close report, including prices, fees, PnL, balance, equity, and available balance.

## How A KOL Can Use It

A KOL can package a strategy into a strategy code, such as `A8K2QX`. Users enter the 6-character code in the bot, and the strategy is copied into their own bot context.

After that, users can:

- Receive strategy signals only.
- Open the exchange trading page manually.
- Use a demo account to test auto trading.
- Later enable real automated trading after connecting an exchange API key.

This turns a KOL's signal distribution from a plain text call into a lightweight strategy-following experience.

## Demo Scope: Not Real Trading Yet

For safety and faster validation, the current version does not call real exchange order APIs.

Completed real product functions:

- Telegram bot interaction.
- Chinese and English language modes.
- Menus, buttons, strategy pool, and strategy codes.
- Signal push and old signal cleanup.
- User state, binding state, and strategy selection.
- Risk calculation and trade intent creation.
- Demo position cards, demo PnL, and demo close flow.

Mock / demo-only parts:

- Demo account balance.
- Simulated fill price.
- Simulated order ID.
- Simulated position PnL.
- Simulated close report.
- LBank API key binding is not connected to live trading yet.
- The bot does not place real orders, close real positions, or read real exchange balances yet.

## What Can Be Customized For A KOL

If a KOL sees value in the direction, the next version can be customized around:

- KOL-specific strategy pool and strategy codes.
- KOL-branded welcome messages and presentation.
- Strategy templates, such as aggressive, balanced, and defensive modes.
- Strategy performance page, including win rate, max drawdown, signal history, and demo return.
- User tiers, such as free users, VIP users, or private community users.
- Follow modes, such as signal only, confirm-to-trade, and fully automated trading.
- Risk controls, such as max position size, max leverage, daily loss limit, and pause switch.
- Future real trading through exchange API key integration.

## Security Direction For Real Trading

For real trading, the recommended approach is API key binding, not asking users for exchange passwords.

Security principles:

- Users create an API key with read and trade permissions only.
- Withdrawal permission is not needed and should not be enabled.
- IP whitelist should be enabled where possible, allowing only our trading server to call the API.
- Users should start with a sub-account or a small dedicated account.
- API secrets are encrypted and never shown in logs or Telegram messages.
- Automated trading must have risk limits and a pause button.
- Moving from demo to live trading requires explicit user confirmation.

## Feedback We Want From KOLs

We would like KOLs to evaluate:

- Whether the strategy code mechanism fits their community distribution workflow.
- Whether users would be willing to start with demo following before enabling real trading.
- Whether the current signal card contains enough information.
- What parameters each strategy should support.
- What performance metrics users should see.
- Whether a dedicated version for the KOL's community is worth exploring.

## Suggested Next Step

The best next step is a 20-30 minute demo session.

The demo can show:

- First-time user onboarding.
- Strategy pool selection.
- Copying a KOL strategy with a strategy code.
- Live signal push.
- Demo account binding.
- Demo auto trade.
- Live PnL card.
- Demo close and trade details.

If the KOL is interested, the next step is to define one dedicated strategy template and a small pilot scope together.
