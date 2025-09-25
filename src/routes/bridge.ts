import { Router, Request, Response } from 'express';
import { CrossChainBridge } from '../services/bridgeService.js';

const router = Router();
const bridge = new CrossChainBridge();

// 获取余额信息
router.post('/balances', async (req: Request, res: Response) => {
  try {
    const { privateKey } = req.body;
    debugger;

    // 验证私钥格式
    if (!privateKey || !CrossChainBridge.validatePrivateKey(privateKey)) {
      return res.status(400).json({
        success: false,
        error: '无效的私钥格式'
      });
    }

    // 获取余额
    const balances = await bridge.getBalances(privateKey);

    res.json({
      success: true,
      data: balances
    });

  } catch (error: any) {
    console.error('Bridge balances error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取余额失败'
    });
  }
});

// 执行跨链操作
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { privateKey, amount, targetAddress } = req.body;

    // 验证参数
    if (!privateKey || !CrossChainBridge.validatePrivateKey(privateKey)) {
      return res.status(400).json({
        success: false,
        error: '无效的私钥格式'
      });
    }

    if (!amount || !CrossChainBridge.validateAmount(amount)) {
      return res.status(400).json({
        success: false,
        error: '无效的转账金额'
      });
    }

    if (!targetAddress || !CrossChainBridge.validateAddress(targetAddress)) {
      return res.status(400).json({
        success: false,
        error: '无效的目标地址格式'
      });
    }

    // 执行跨链操作
    const result = await bridge.executeBridge(privateKey, amount, targetAddress);

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Bridge execute error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '跨链操作失败'
    });
  }
});

export default router;