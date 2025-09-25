# Multi-Chain Faucet 更新说明

## 新功能概述
现在这个 faucet 系统已经支持多链操作，包括：
- **BSC 链**: 原有的BSC testnet/mainnet功能
- **SOCCHAIN**: 您自己的公链

## 页面结构
- `/` - 主页面，提供链选择界面
- `/bsc.html` - BSC链专用的faucet页面
- `/socchain.html` - SOCCHAIN专用的faucet页面

## API端点

### BSC链相关
- `POST /claim` - BSC token领取
- `GET /api/status` - BSC chain状态和余额
- `GET /healthz` - BSC链健康检查

### SOCCHAIN相关  
- `POST /socchain/claim` - SOCCHAIN token领取
- `GET /api/socchain/status` - SOCCHAIN状态和余额
- `GET /socchain/healthz` - SOCCHAIN链健康检查

## 环境变量配置

### 服务器配置
```bash
PORT=8080
RATE_LIMIT_IP=30
ENABLE_METRICS=true
```

### BSC链配置
```bash
BSC_PRIVATE_KEY=0x...your_bsc_private_key...
BSC_RPC_URL=https://bsc-testnet.bnbchain.org
BSC_TOKEN_CONTRACT=    # 可选：token合约地址，留空为原生BNB
BSC_CLAIM_AMOUNT_TOKENS=100
BSC_TOKEN_DECIMALS=18
BSC_COOLDOWN_HOURS=24
BSC_CHAIN_ID=97        # BSC testnet=97, mainnet=56
```

### SOCCHAIN配置
```bash
SOCCHAIN_PRIVATE_KEY=0x...your_socchain_private_key...
SOCCHAIN_RPC_URL=http://your-socchain-rpc-url:8545
SOCCHAIN_TOKEN_CONTRACT=    # 可选：token合约地址，留空为原生SOC
SOCCHAIN_CLAIM_AMOUNT_TOKENS=100  
SOCCHAIN_TOKEN_DECIMALS=18
SOCCHAIN_COOLDOWN_HOURS=24
SOCCHAIN_CHAIN_ID=1001     # 您的SOCCHAIN链ID
```

## 数据库
两个链共用同一个SQLite数据库，通过地址进行冷却时间管理。这意味着：
- 同一地址在BSC链和SOCCHAIN上的冷却时间是独立的
- 您可以同时在两个链上进行token分发

## 部署说明

1. 复制 `.env.example` 到 `.env`
2. 填写所需的环境变量
3. 确保您有两个链的私钥，并且账户中有足够的余额
4. 启动服务：`npm start`

## 需要用户提供的信息

要完成SOCCHAIN的集成，您需要提供：

1. **SOCCHAIN_RPC_URL**: SOCCHAIN节点的RPC地址
2. **SOCCHAIN_CHAIN_ID**: SOCCHAIN的网络ID
3. **SOCCHAIN_PRIVATE_KEY**: 用于分发token的私钥
4. 可选：如果要分发ERC20代币而非原生代币，需要提供合约地址

## 向后兼容

原有的环境变量仍然支持，会自动映射到BSC链配置，确保现有部署不受影响。