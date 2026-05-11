# LBank Contract Assistant Bot Demo

面向 LBank 合约用户的 Telegram 交易助手 demo。当前目标不是直接做真实自动下单，而是验证 `Telegram Bot -> 策略发现 -> 信号推送 -> 模拟交易 -> 活动页跳转` 这条转化链路是否比普通网页活动更有效。

Demo Bot:

```text
https://t.me/ctrhelperbot
```

## 项目定位

这个 bot 主要服务两个场景：

- 用户侧：用 Telegram 接收策略信号、复刻 KOL 策略、模拟开仓、查看实时浮盈浮亏，并跳转到 LBank 活动或交易页面。
- 运营侧：配合代理和 KOL 做渠道投放，用 A/B test 对比普通网页活动和 TG bot 路径的转化效果。

考虑到 LBank 短期大概率不会开放交易 API，本项目当前不重点押真实自动交易，也不直接投入 Mini App。更现实的路径是先用轻量 TG bot 验证转化，如果数据有效，再推动 Mini App 或更深层产品开发。

## 当前能力

- 中文 / English 双语入口。
- `/start` 后展示语言选择、欢迎语和常用菜单。
- 默认选择热度最高策略，并开始实时推送信号。
- 策略池展示，用户可一键复刻策略。
- KOL 策略码机制：KOL 生成 6 位策略码，用户输入后复制策略。
- 信号卡每 10 秒刷新一次，旧卡会删除，避免刷屏。
- 未绑定用户看到 `LBank` 跳转入口、绑定后自动交易入口和暂停按钮。
- 绑定 demo 账户后，用户可选择模拟自动交易。
- 支持用户自定义杠杆、仓位、止盈、止损，保证金自动计算。
- 模拟成交后生成独立持仓 PnL 卡片，每 5 秒刷新。
- 多个模拟持仓会分别展示。
- 支持模拟平仓，平仓报告包含价格、手续费、实际盈亏、余额、权益和可用余额。
- 支持暂停推送。
- 支持管理员停机开关和审计日志。

## Demo 边界

当前版本是演示环境，不会真实调用 LBank 下单接口。

真实完成的部分：

- Telegram bot 交互。
- 中英文切换。
- 策略池、策略码、信号推送。
- 用户绑定状态和策略选择状态。
- 风控计算和交易意图。
- 模拟订单、模拟持仓、PnL 展示和平仓流程。

Mock / 模拟部分：

- demo 账户余额。
- 模拟成交价。
- 模拟订单号。
- 模拟浮盈浮亏。
- 模拟平仓结果。
- LBank API key 绑定和真实账户读取暂未接入。
- 不会真实开仓、平仓或读取交易所余额。

## 用户流程

```text
/start
-> 选择语言
-> 查看默认策略和实时信号
-> 进入策略池或输入 KOL 策略码
-> 复刻策略
-> 接收实时信号
-> 未绑定用户跳转 LBank 网页
-> 绑定 demo 账户
-> 模拟自动交易或自定义参数
-> 查看实时 PnL
-> 模拟平仓
```

## 目录结构

```text
src/
  account/      demo 账户余额、权益、持仓快照
  audit/        审计日志
  bot/          Telegram 命令、按钮、回调和消息格式
  db/           当前 demo 的内存存储
  domain/       核心类型定义
  execution/    交易执行器接口和 paper 模拟执行器
  push/         信号推送和持仓 PnL 推送
  risk/         风控和仓位计算
  signal/       信号生成
  strategy/     策略池和 KOL 策略码
  trade/        交易意图、模拟成交、模拟平仓
  user/         用户状态、语言、绑定状态
docs/
  kol-introduction-zh.md
  kol-introduction-en.md
```

## 本地运行

要求：

- Node.js 18+
- npm
- Telegram bot token

安装和启动：

```bash
cp .env.example .env
npm install
npm run dev
```

`.env` 示例：

```text
BOT_TOKEN=
ADMIN_TELEGRAM_IDS=
L_BANK_REGISTER_URL=https://www.lbank.com/
```

说明：

- `BOT_TOKEN` 必填。
- `ADMIN_TELEGRAM_IDS` 为空时，所有用户都被视为管理员，方便 demo。
- `L_BANK_REGISTER_URL` 用于信号卡里的网页跳转按钮。

## 常用命令

用户命令：

```text
/start       启动并订阅默认策略
/strategies  查看策略池
/mine        查看我的策略
/balance     查看 demo 余额
/positions   查看模拟持仓
/stop        暂停信号推送
/help        查看说明
```

Demo / 管理命令：

```text
/bind_demo         绑定 demo 账户
/latest            立即刷新信号
/close_demo        关闭第一笔模拟持仓
/demo_signal       创建一条 demo 信号
/publish_strategy  发布 KOL 策略码
/admin_stop        关闭新开仓
/admin_resume      恢复新开仓
/audit             查看最近审计日志
```

## NPM Scripts

```bash
npm run dev     # 本地开发启动
npm run check   # TypeScript 类型检查
npm run build   # 编译到 dist/
npm start       # 运行已编译版本
```

## 推送和状态说明

- 信号推送间隔：10 秒。
- PnL 卡片刷新间隔：5 秒。
- 数据存储：当前使用内存存储，服务重启后用户状态、策略选择、模拟持仓都会清空。
- 执行模式：`paper`，即模拟成交。

## 后续方向

短期建议：

- 用 TG bot 跳转网页做 A/B test。
- 对比同渠道下普通网页活动路径和 TG bot 路径的注册、策略参与、demo 交易、eFTTC 转化率。
- 如果 TG bot 路径明显更好，再推进 Mini App。

中期可扩展：

- 持久化数据库。
- 活动页埋点和渠道归因。
- KOL 专属策略池。
- 策略表现页。
- Mini App 页面。
- API key 绑定向导。

真实交易前必须补齐：

- API key 权限检测。
- 密钥加密存储。
- 真实交易状态机。
- 幂等下单。
- 未知状态恢复。
- 限速和风控。
- 审计和人工停机。

## 安全说明

不要提交以下内容：

- `.env`
- bot token
- API key / API secret
- 带敏感信息的截图
- 构建产物和临时压缩包

仓库已通过 `.gitignore` 忽略：

- `node_modules/`
- `dist/`
- `.env`
- `*.log`
- `*.zip`
- `*.docx`
- `AGENT.md`

如果 bot token 曾经在聊天、日志或其他地方暴露，建议通过 BotFather 重新生成 token。

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TODO.md](./TODO.md)
- [中文 KOL 介绍](./docs/kol-introduction-zh.md)
- [English KOL Introduction](./docs/kol-introduction-en.md)
