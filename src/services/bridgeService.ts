import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { defineChain } from 'viem/utils';
import { config } from '../config.js';

// 使用配置文件中的桥配置
const BSC_CONFIG = config.bridge.bsc;
const SOCX_CONFIG = config.bridge.socchain;

// 定义 SOCX 链
const socxChain = defineChain({
  id: SOCX_CONFIG.chainId,
  name: 'SOCX',
  nativeCurrency: {
    decimals: 18,
    name: 'SOC',
    symbol: 'SOC',
  },
  rpcUrls: {
    default: {
      http: [SOCX_CONFIG.rpcUrl],
    },
  },
});

// ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// 桥合约 ABI
const BRIDGE_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'targetAddress', type: 'string' }
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'targetAddress', type: 'string' }
    ],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

export class CrossChainBridge {
  private bscPublicClient: any;
  private socxPublicClient: any;

  constructor() {
    this.bscPublicClient = createPublicClient({
      chain: bsc,
      transport: http(BSC_CONFIG.rpcUrls[0], {
        timeout: 10000, // 10秒超时
      })
    });

    this.socxPublicClient = createPublicClient({
      chain: socxChain,
      transport: http(SOCX_CONFIG.rpcUrl, {
        timeout: 10000, // 10秒超时
      })
    });
  }

  // 创建备用的 BSC 客户端
  private createBscClientWithRpc(rpcIndex: number) {
    return createPublicClient({
      chain: bsc,
      transport: http(BSC_CONFIG.rpcUrls[rpcIndex], {
        timeout: 10000, // 10秒超时
      })
    });
  }

  // 重试逻辑
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    const maxRetries = BSC_CONFIG.rpcUrls.length;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          // 使用不同的 RPC
          this.bscPublicClient = this.createBscClientWithRpc(i);
          console.log(`尝试使用RPC ${i}: ${BSC_CONFIG.rpcUrls[i]}`);
        }
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.error(`RPC ${i} (${BSC_CONFIG.rpcUrls[i]}) 失败:`, error.message);
        if (i < maxRetries - 1) {
          // 递增延迟
          const delay = Math.min(1000 * (i + 1), 5000);
          console.log(`等待 ${delay}ms 后尝试下一个RPC...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`所有 ${maxRetries} 个RPC都失败了`);
    throw lastError!;
  }

  // 获取账户地址
  private getAccountFromPrivateKey(privateKey: string) {
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }
    return privateKeyToAccount(privateKey as `0x${string}`);
  }

  // 获取余额信息
  async getBalances(privateKey: string) {
    try {
      const account = this.getAccountFromPrivateKey(privateKey);
      const userAddress = account.address;

      // 使用重试逻辑获取 BSC 余额
      let bscUsdtBalance: bigint, bscBnbBalance: bigint, usdtAllowance: bigint;
      
      try {
        const results = await this.withRetry(async () => {
          return await Promise.all([
            this.bscPublicClient.readContract({
              address: BSC_CONFIG.usdt,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [userAddress]
            }),
            this.bscPublicClient.getBalance({ address: userAddress }),
            this.bscPublicClient.readContract({
              address: BSC_CONFIG.usdt,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [userAddress, BSC_CONFIG.bridge]
            })
          ]);
        });
        
        [bscUsdtBalance, bscBnbBalance, usdtAllowance] = results;
      } catch (bscError) {
        console.error('BSC网络连接失败:', bscError);
        // 如果BSC网络失败，返回0值，但仍然尝试获取SOCCHAIN余额
        bscUsdtBalance = 0n;
        bscBnbBalance = 0n;
        usdtAllowance = 0n;
      }

      // 获取 SOCCHAIN 余额
      let socxBusdtBalance: bigint = 0n;
      let socxSocBalance: bigint = 0n;

      debugger
      
      try {
        const [busdtBalance, socBalance] = await Promise.all([
          this.socxPublicClient.readContract({
            address: SOCX_CONFIG.bridge,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [userAddress]
          }).catch(() => 0n), // bUSDT 余额，如果失败返回 0
          this.socxPublicClient.getBalance({ address: userAddress })
        ]);
        
        debugger
        
        socxBusdtBalance = busdtBalance as bigint;
        socxSocBalance = socBalance;
      } catch (socError) {
        console.error('SOCCHAIN网络连接失败:', socError);
        // SOCCHAIN失败时保持默认0值
      }

      const result = {
        bsc: {
          usdtBalance: parseFloat(formatUnits(bscUsdtBalance, 18)).toFixed(6),
          bnbBalance: parseFloat(formatUnits(bscBnbBalance, 18)).toFixed(6),
          allowance: parseFloat(formatUnits(usdtAllowance, 18)).toFixed(6)
        },
        socchain: {
          busdtBalance: parseFloat(formatUnits(socxBusdtBalance, 18)).toFixed(6),
          socBalance: parseFloat(formatUnits(socxSocBalance, 18)).toFixed(6)
        }
      };
      
      // todo: console.log('余额查询结果:', result);
      return result;
      
    } catch (error: any) {
      console.error('Get balances failed:', error);
      throw new Error(`获取余额失败: ${error.message}`);
    }
  }

  // 执行跨链操作 (BSC -> SOCX)
  async executeBridge(privateKey: string, amount: string, targetAddress: string) {
    try {
      const account = this.getAccountFromPrivateKey(privateKey);
      const userAddress = account.address;
      const amountWei = parseUnits(amount, 18);

      console.log('开始跨链操作:', {
        from: userAddress,
        amount,
        targetAddress,
        amountWei: amountWei.toString(),
        bridgeContract: BSC_CONFIG.bridge,
        usdtContract: BSC_CONFIG.usdt
      });

      // 验证桥合约是否存在
      console.log('验证桥合约存在性...');
      try {
        const bridgeCode = await this.bscPublicClient.getBytecode({
          address: BSC_CONFIG.bridge
        });
        if (!bridgeCode || bridgeCode === '0x') {
          throw new Error(`桥合约不存在于地址 ${BSC_CONFIG.bridge}`);
        }
        console.log('桥合约验证通过');
      } catch (error: any) {
        console.error('桥合约验证失败:', error);
        throw new Error(`无法验证桥合约: ${error.message}`);
      }

      // 创建 BSC wallet client
      const bscWalletClient = createWalletClient({
        chain: bsc,
        transport: http(BSC_CONFIG.rpcUrls[0]),
        account
      });

      // 1. 检查 USDT 余额
      console.log('检查 USDT 余额...');
      const usdtBalance = await this.withRetry(async () => {
        return await this.bscPublicClient.readContract({
          address: BSC_CONFIG.usdt,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress]
        }) as bigint;
      });

      if (usdtBalance < amountWei) {
        throw new Error(`USDT余额不足: 需要${amount} USDT，当前余额${formatUnits(usdtBalance, 18)} USDT`);
      }

      // 2. 检查授权额度
      console.log('检查授权额度...');
      const allowance = await this.withRetry(async () => {
        return await this.bscPublicClient.readContract({
          address: BSC_CONFIG.usdt,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, BSC_CONFIG.bridge]
        }) as bigint;
      });

      // 3. 如果授权不够，先进行授权
      if (allowance < amountWei) {
        console.log('授权不足，执行授权操作...');
        
        const approveTx = await bscWalletClient.writeContract({
          address: BSC_CONFIG.usdt,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [BSC_CONFIG.bridge, amountWei],
          gas: 100000n
        });

        console.log('授权交易已提交:', approveTx);

        // 等待授权交易确认
        const approveReceipt = await this.bscPublicClient.waitForTransactionReceipt({
          hash: approveTx,
          timeout: 60000
        });

        if (approveReceipt.status !== 'success') {
          throw new Error('授权交易失败');
        }

        console.log('授权交易确认:', approveReceipt.transactionHash);
      }

      // 4. 执行跨链质押
      console.log('执行跨链质押...');
      
      const depositTx = await bscWalletClient.writeContract({
        address: BSC_CONFIG.bridge,
        abi: BRIDGE_ABI,
        functionName: 'deposit',
        args: [amountWei, targetAddress.toLowerCase()],
        gas: 200000n
      });

      console.log('跨链交易已提交:', depositTx);

      // 等待交易确认
      console.log('等待交易确认...');
      const depositReceipt = await this.bscPublicClient.waitForTransactionReceipt({
        hash: depositTx,
        timeout: 120000 // 2分钟超时
      });

      console.log('交易收据:', {
        status: depositReceipt.status,
        blockNumber: depositReceipt.blockNumber,
        gasUsed: depositReceipt.gasUsed,
        effectiveGasPrice: depositReceipt.effectiveGasPrice,
        logs: depositReceipt.logs
      });

      if (depositReceipt.status !== 'success') {
        // 提供更详细的失败信息
        const failureReason = depositReceipt.status === 'reverted' 
          ? '交易被回滚，可能的原因：1) 合约不存在 2) 函数调用失败 3) Gas不足' 
          : `交易状态: ${depositReceipt.status}`;
        throw new Error(`跨链交易失败: ${failureReason}`);
      }

      console.log('跨链成功:', {
        txHash: depositReceipt.transactionHash,
        blockNumber: depositReceipt.blockNumber,
        gasUsed: depositReceipt.gasUsed
      });

      return {
        success: true,
        txHash: depositReceipt.transactionHash,
        blockNumber: depositReceipt.blockNumber.toString(),
        gasUsed: depositReceipt.gasUsed.toString(),
        amount,
        targetAddress
      };

    } catch (error: any) {
      console.error('跨链操作失败:', error);
      throw new Error(`跨链失败: ${error.message}`);
    }
  }

  // 验证地址格式
  static validateAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }

  // 验证私钥格式
  static validatePrivateKey(privateKey: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(privateKey);
  }

  // 验证跨链金额
  static validateAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0.0000001 && num <= 1000000;
  }
}