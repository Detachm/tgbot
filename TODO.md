# Demo TODO

## P0 当前冲刺：完整 demo 闭环

| 状态 | 优先级 | 功能 | 类型 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- |
| done | P0 | 初始化 TypeScript Bot 工程 | real | 无 | 可以启动本地进程，加载配置，注册 Bot 命令 |
| done | P0 | 用户状态与绑定状态 | real | 工程初始化 | 用户可以进入 Bot，系统能区分未绑定和已绑定 |
| done | P0 | 管理员发结构化信号 | real | 用户状态 | 管理员能创建并发布包含交易对、方向、止盈止损、风险、杠杆的信号 |
| done | P0 | 未绑定用户信号展示 | real | 信号发布 | 未绑定用户收到引流版信号和注册链接 |
| done | P0 | 绑定用户仓位计算 | real | 信号发布、用户状态、风控 | 绑定用户收到余额、保证金、杠杆、预计仓位 |
| done | P0 | 确认式模拟开仓 | mock | 仓位计算、风控、模拟执行器 | 重复点击只产生一笔模拟订单，消息明确显示“模拟成交” |
| done | P0 | 一键模拟平仓 | mock | 模拟开仓 | 用户可以关闭本地模拟持仓，消息明确显示“模拟平仓” |
| done | P0 | 审计日志 | real | 用户、信号、交易服务 | API 绑定、信号发布、交易确认、模拟执行都有审计记录 |
| done | P0 | 管理员停机开关 | real | 管理员权限 | 关闭后不能新开仓，只能查账户和看信号 |

## P1 demo 增强

| 状态 | 优先级 | 功能 | 类型 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- |
| done | P1 | 点击和来源统计 | real | Bot 交互 | 注册、打开合约、教程按钮点击可统计 |
| done | P1 | 余额查询反馈 | partial | 用户绑定状态 | demo 可返回模拟余额；后续可接 LBank 只读接口 |
| pending | P1 | 持仓查询反馈 | partial | 模拟订单 | demo 可返回本地模拟持仓；后续可接 LBank 只读接口 |
| pending | P1 | LBank API Key 绑定流程 | partial | 用户状态、审计 | demo 可保存脱敏绑定状态；不保存真实 Secret |
| pending | P1 | 信号撤回与过期 | real | 信号状态 | 旧信号不能继续生成新交易意图 |
| done | P1 | Start 菜单和问候 | real | Bot 交互 | `/start` 后展示问候和常用按钮 |
| done | P1 | 策略池选择 | real | 用户状态 | 用户可从策略池一键复刻策略 |
| done | P1 | KOL 策略码发布 | real | 策略池 | KOL 可生成 6 位策略码 |
| done | P1 | 策略码复刻 | real | 策略码发布 | 用户输入 6 位策略码可复刻策略到自己的 Bot 上下文 |

## P2 真实交易前置

| 状态 | 优先级 | 功能 | 类型 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- |
| pending | P2 | PostgreSQL 持久化 | real | demo 服务稳定 | 替换内存数据层，重启不丢关键数据 |
| pending | P2 | LBank 只读账户接口 | real | API Key 权限检测 | 余额和持仓来自真实交易所 |
| pending | P2 | 真实交易状态机 | planned | 持久化、审计、风控 | 状态只能单向推进，未知状态可恢复 |
| pending | P2 | LBank 真实下单执行器 | planned | 真实交易状态机 | 使用真实执行器前必须通过幂等、限速、恢复测试 |
| pending | P2 | 未知状态恢复 | planned | 真实执行器 | 网络中断后不能重复提交，只能查询恢复或人工处理 |

## 当前依赖链

```text
工程初始化
-> 用户状态
-> 管理员发信号
-> 信号展示
-> 仓位计算和风控
-> 模拟开仓
-> 模拟平仓
-> 审计和停机开关贯穿全流程
```

## 本地运行

```text
cp .env.example .env
填写 BOT_TOKEN
可选填写 ADMIN_TELEGRAM_IDS，逗号分隔；为空时默认所有用户都是管理员，方便 demo
npm run dev
```

## demo 命令

```text
/start：进入 Bot
/bind_demo：绑定演示账户
/demo_signal：管理员发布一条 demo 信号
/latest：查看最新信号，已绑定用户可生成确认按钮
/positions：查看本地模拟持仓
/close_demo：一键模拟平仓
/admin_stop：关闭新开仓
/admin_resume：恢复新开仓
/audit：查看最近审计日志
/strategy_pool：查看策略池
/my_strategies：查看我的策略
/publish_strategy：KOL 发布 6 位策略码
```
