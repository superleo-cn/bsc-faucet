# Faucet Service

一个按地址每日限额派发测试代币 ("100 U") 的水龙头服务。支持通过 HTTP API 领取，每个地址 24 小时只能成功领取一次，额度固定 100（可配置），通过本地或远程节点签名/发送交易。私钥、RPC、额度等放入配置。

当前实现默认针对 BSC Testnet (ChainId 97)。可通过环境变量 `CHAIN_ID` 与 `RPC_URL` 改为主网或其他测试网。若需要发放 BEP20 代币，设置 `TOKEN_CONTRACT` 即可；留空表示转原生 BNB。

## 目标与范围

核心目标:
1. 对外提供简单、可防滥用的领取接口: `POST /claim`。
2. 每个链上地址 24h 内仅可成功领取一次 (幂等限制)。
3. 派发固定额度的测试代币 (默认 100 单位)。
4. 记录发放日志，便于审计与监控。
5. 可通过配置切换不同 EVM 测试网络 (如 Sepolia)。

不在当前范围 (可列为后续迭代):
- 多链并行发放聚合接口。
- 图形化前端页面。
- 人机验证 (Captcha) / OAuth / Web3 Sign-In 进一步防刷。
- 复杂速率限制策略 (IP + 指纹 + 地址组合)。

## 角色 / 使用场景
- 用户 (开发者) : 提供一个地址，调用 API 领取测试币。
- 管理者 : 调整限额、密钥、白名单、开关。

## 关键需求清单
功能:
- 领取接口: 输入地址，验证格式，检查冷却窗口，发送链上转账，返回交易哈希。
- 冷却/限额控制: 24 小时 (可配置) 再次领取拒绝并返回上次成功时间。
- 配置系统: 通过 `.env` 或 `config.(ts|json)` 支持以下参数:
	- PRIVATE_KEY (派发账户私钥)
	- RPC_URL (链 RPC Endpoint)
	- TOKEN_CONTRACT (可选: 若是 ERC20; 若为空则表示原生代币)
	- CLAIM_AMOUNT (默认 100)
	- COOLDOWN_HOURS (默认 24)
	- PORT (HTTP 服务端口)
	- RATE_LIMIT_IP (每 IP 每窗口最大请求数, 防止暴力尝试)
	- ENABLE_METRICS (是否开启 Prometheus 指标)
- 日志与持久化: 记录 (address, txHash, amount, timestamp, status)。
- 指标 / 健康检查: `/healthz` 返回服务状态; `/metrics` 暴露统计 (可选)。

非功能:
- 可部署 Docker 容器。
- 幂等性: 并发重复请求同一地址在同一窗口只执行一次链上交易 (需锁或唯一约束)。
- 安全: 私钥不写入日志; 支持通过环境变量加载。未来可接入 HSM / Vault。
- 可观察性: 基本日志 + 可选 metrics。

## 设计概述
### 核心流程 (claim)
1. 校验输入地址格式 (EVM checksum / 长度)。
2. 查存储: 是否存在最近一次成功领取并在冷却时间内。
3. 若在冷却期: 返回 429 (或 200 + remaining) 按需选择 (当前采用 429 + JSON)。
4. 获取 nonce / 构造转账 (原生或 ERC20 transfer)。
5. 使用私钥签名并广播。失败则记录失败原因。
6. 记录成功领取 (address, txHash, amount, nextAvailableAt)。
7. 返回 JSON: { address, amount, txHash }。

### 数据模型 (逻辑层)
ClaimRecord:
```
address: string
txHash: string
amount: string
claimedAt: Date
nextAllowedAt: Date
status: 'SUCCESS' | 'FAILED'
failureReason?: string
ip?: string
```

存储实现初期可选:
- 轻量: SQLite / LowDB / JSON 文件 (开发用)
- 生产建议: PostgreSQL / Redis (配合分布式锁)
初始实现选 SQLite (嵌入式, 零依赖, 事务支持)。

### 防滥用策略 (初版)
- 单地址 24h 冷却。
- 基础 IP 速率限制 (如 20 req / 10 min)。
- 同地址并发领取使用内存 Map + 进程锁避免重复链上交易。

### API 设计 (初版)
`POST /claim`
Request JSON:
```
{ "address": "0x..." }
```
Responses:
```
201 { address, amount, txHash }                    // 成功
429 { error: 'cooldown', nextAllowedAt, remainingSeconds }
400 { error: 'invalid_address' }
500 { error: 'internal', detail? }
```

`GET /healthz`

环境变量示例 (BSC Testnet 默认)
```
200 { status: 'ok', network, chainId }
```

`GET /metrics` (可选, Prometheus 格式)

### 配置加载顺序
1. 环境变量 (.env)
2. 命令行参数 (未来可拓展)
3. 默认值 fallback

### 错误处理分类
- UserError: 输入无效, 冷却中 → 4xx
- UpstreamError: RPC 失败, nonce 冲突 → 502/500
- InternalError: DB/逻辑 bug → 500

## 语言选择
在 Java / Scala / Python / TypeScript / Go 中选择 TypeScript (Node.js) 作为首选:
- 与 EVM 生态 (ethers.js / viem) 集成最成熟, 开发效率高。
- 快速迭代, 轻量部署 (单进程 + SQLite 即可起步)。
- 强类型 (TypeScript) 降低错误率, 兼具脚本式敏捷性。
- 大量现成中间件 (express, rate limit, prometheus client)。
因此后续实现采用 TypeScript + Node.js + Express + SQLite (better-sqlite3) + viem/ethers。

## 技术栈 (初版)
- Runtime: Node.js 20+
- Lang: TypeScript
- HTTP: Express (或 Fastify; 初版选 Express 熟悉度高)
- Web3: viem (更现代) 或 ethers v6 (二选一; 初版选 viem)
- DB: better-sqlite3 (同步简洁)；后续可换 Prisma + Postgres。
- Env: dotenv
- Rate Limit: express-rate-limit
- Metrics: prom-client
- Logging: pino

## 目录规划 (拟定)
```
faucet/
	src/
		config.ts
		server.ts
		routes/claim.ts
		services/claimService.ts
		services/txSender.ts
		db/
			index.ts
			migrations/
		models/
			ClaimRecord.ts
		middlewares/
			rateLimit.ts
			errorHandler.ts
		utils/
			address.ts
			time.ts
	prisma/ (若后续使用)
	scripts/
	tests/
	.env.example
```

## MVP 交付标准
- `POST /claim` 完成，限制生效。
- 可配置参数工作正常。
- SQLite 中能看到记录。
- 日志含 txHash。
- README 包含使用说明。

## 后续迭代路线 (建议)
1. Captcha / Wallet Sign Message 防刷。
2. 多网络支持 (参数 network=sepolia / holesky)。
3. Redis 分布式锁 & 限速。
4. Web 前端页面 + 钱包连接。
5. 多额度/白名单策略。
6. 失败自动重试队列 (指数退避)。
7. OpenTelemetry tracing。

## 环境变量示例 (BSC Testnet + 自定义 BEP20)
```
PRIVATE_KEY=0x...
RPC_URL=https://bsc-testnet.bnbchain.org
TOKEN_CONTRACT=0xddf4b7938b4379301690fc2c7dc898b9084a4826
CLAIM_AMOUNT_TOKENS=100
TOKEN_DECIMALS=18
COOLDOWN_HOURS=24
PORT=8080
RATE_LIMIT_IP=30
ENABLE_METRICS=true
CHAIN_ID=97
```

## 简单使用流程 (未来实现后)
1. 安装依赖 & 构建
2. 复制 `.env.example` 到 `.env` 并填充
3. 启动服务: `npm run start` / `docker run ...`
4. 调用示例:
```
curl -X POST http://localhost:8080/claim -H 'Content-Type: application/json' -d '{"address":"0xabc..."}'
```

## 简易前端页面
项目已内置一个静态页面用于手动测试：启动后访问 `http://localhost:8080/`，输入地址点击领取即可；该页面仅为调试用途，没有做钱包签名与防刷验证。


---
下一步: 初始化 TypeScript 项目结构与依赖。请确认是否直接继续生成代码。
参考: 详细架构说明见 `docs/ARCHITECTURE.md`。

项目已初始化，下一步: 安装依赖并启动 (见下)。

### 运行 (开发态)
```
npm install
npm run dev
```

### 构建 & 生产启动
```
npm run build
npm start
```

### Docker (后续可添加 Dockerfile)
```
# 占位: 将会提供 Dockerfile
```

## 故障排查 (Troubleshooting)

### 编译原生模块出现: C++20 or later required (better-sqlite3 / node-gyp)
原因: 使用的 Node 版本较新 (>=22) 但本地 Xcode / clang 版本或 node-gyp 组合未正确传递 C++ 标准，或反向——某些二进制预编译包不可用而触发本地编译。

解决步骤建议顺序:
1. 使用项目建议 Node 版本 (见 `.nvmrc`):
	```bash
	nvm use
	```
2. 确认安装 Xcode Command Line Tools:
	```bash
	xcode-select --install || true
	```
3. 清理并重新安装依赖:
	```bash
	rm -rf .yarn/cache node_modules
	yarn install --inline-builds
	```
4. 若仍报错，可强制指定 C++ 标准 (临时)：
	```bash
	export CXXFLAGS="-std=c++20"
	yarn rebuild better-sqlite3
	```
5. 如果仍失败，考虑暂时切换到纯 JS 驱动 (备用计划): 改用 `sqlite3` 或更换到 Postgres + `pg`。

### 国内加速 (已启用)
当前项目使用 Yarn Berry (PnP) 并设置 `npmRegistryServer: https://registry.npmmirror.com`。

首次安装:
```bash
yarn install --inline-builds
```

若需要关闭 PnP 改为 node_modules (可调试):
```bash
echo "nodeLinker: node-modules" >> .yarnrc.yml
yarn install
```

如需锁定依赖后再构建:
```bash
yarn dedupe
yarn install --immutable
```



