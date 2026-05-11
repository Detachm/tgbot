# LBank Contract Assistant Bot Demo

Telegram bot demo for strategy discovery, signal push, paper auto-trading, live demo PnL cards, and KOL strategy-code distribution.

This repository is a demo. It does not place real LBank orders and does not read real exchange balances. All orders, fills, positions, and PnL are simulated in memory.

## Features

- Chinese / English onboarding.
- Strategy pool and 6-character KOL strategy code replication.
- Live signal card push every 10 seconds.
- Old signal card cleanup to avoid chat spam.
- Demo account binding.
- Paper auto-trade confirmation.
- Custom leverage, position size, take-profit, and stop-loss input.
- Per-position live demo PnL card refresh.
- Demo close report with fees, realized PnL, balance, equity, and available balance.

## Run Locally

```bash
cp .env.example .env
npm install
npm run dev
```

Required environment variables:

```text
BOT_TOKEN=
ADMIN_TELEGRAM_IDS=
L_BANK_REGISTER_URL=https://www.lbank.com/
```

If `ADMIN_TELEGRAM_IDS` is empty, all users are treated as admins for demo convenience.

## Scripts

```bash
npm run dev
npm run check
npm run build
npm start
```

## Repository Notes

The repo intentionally ignores local secrets and generated artifacts:

- `.env`
- `node_modules/`
- `dist/`
- `*.log`
- `*.zip`
- `*.docx`

Do not commit real bot tokens, API keys, screenshots containing sensitive data, or generated archives.
