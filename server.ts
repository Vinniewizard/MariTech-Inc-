import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs/promises';

dotenv.config({ path: ['.env.local', '.env', '.env.example'] });

const __filename = typeof import.meta !== 'undefined' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();
const cashierLedgerPath = path.join(process.cwd(), 'cashier-ledger.json');

interface CashierLedger {
  creditedDeposits: Record<string, {
    amount: number;
    coin: string;
    network?: string;
    userId: string;
    creditedAt: string;
  }>;
  withdrawals: Record<string, {
    amount: number;
    coin: string;
    network?: string;
    address: string;
    userId: string;
    requestedAt: string;
    binanceId?: string;
  }>;
}

const emptyCashierLedger = (): CashierLedger => ({
  creditedDeposits: {},
  withdrawals: {}
});

async function loadCashierLedger(): Promise<CashierLedger> {
  try {
    const ledger = await fs.readFile(cashierLedgerPath, 'utf8');
    return { ...emptyCashierLedger(), ...JSON.parse(ledger) };
  } catch (error: any) {
    if (error?.code === 'ENOENT') return emptyCashierLedger();
    throw error;
  }
}

async function saveCashierLedger(ledger: CashierLedger) {
  await fs.writeFile(cashierLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Binance Config from environment
  const binanceKey = process.env.BINANCE_API_KEY;
  const binanceSecret = process.env.BINANCE_SECRET;
  const binanceBaseUrl = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
  const defaultDepositCoin = (process.env.BINANCE_DEPOSIT_COIN || 'USDT').toUpperCase();
  const defaultDepositNetwork = (process.env.BINANCE_DEPOSIT_NETWORK || 'BSC').toUpperCase();
  const withdrawalsEnabled = process.env.BINANCE_WITHDRAWALS_ENABLED === 'true';

  const requireBinanceConfig = () => {
    if (!binanceKey || !binanceSecret) {
      throw new Error('Server Binance integration is not configured.');
    }
  };

  const signedBinanceRequest = async (
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, string | number | boolean | undefined>
  ) => {
    requireBinanceConfig();

    const query = new URLSearchParams();
    Object.entries({
      ...params,
      recvWindow: params.recvWindow ?? 5000,
      timestamp: Date.now()
    }).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });

    const signature = crypto
      .createHmac('sha256', binanceSecret!)
      .update(query.toString())
      .digest('hex');
    query.set('signature', signature);

    const url = `${binanceBaseUrl}${endpoint}?${query.toString()}`;
    const response = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': binanceKey! }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.msg || payload?.message || `Binance request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  };

  const normalizeCoin = (coin?: string) => (coin || defaultDepositCoin).trim().toUpperCase();
  const normalizeNetwork = (network?: string) => (network || defaultDepositNetwork).trim().toUpperCase();
  const parseAmount = (amount: unknown) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Amount must be a positive number.');
    }
    return parsed;
  };

  app.use(express.json());

  // Initialize server-side Gemini client securely
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini system loaded.');
  } else {
    console.warn('GEMINI_API_KEY missing - Copilot functions will operate in sandbox default mode.');
  }

  // API Route: Smart trading signal & options advisor
  app.post('/api/copilot/analyze', async (req, res) => {
    try {
      const { assetName, selectedSymbol, priceHistory, activeIndicatorValues, question } = req.body;

      if (!ai) {
        return res.json({
          signal: 'HOLD',
          analysis: 'MariTech AI Sandboxed: To activate live AI analytical reports, configure a valid GEMINI_API_KEY inside the custom Secrets panel.',
          support: 'ND',
          resistance: 'ND',
          levelOfConfidence: 'Low (Sandbox)'
        });
      }

      // Format data context for the model
      const pricesString = priceHistory ? priceHistory.slice(-20).map((t: any) => t.price.toFixed(4)).join(', ') : 'unknown';
      const indicatorsString = activeIndicatorValues ? JSON.stringify(activeIndicatorValues) : 'Defaults';

      const systemPrompt = `You are "Wizard Bot", the mystical and evolving institutional derivatives analyst of MariTech Inc.
You specialize in real-time technical analysis for binary options and synthetic indices.
Your style is professional, mystical, and adaptive.

PRIVACY & SECURITY PROTOCOL:
- PROTECT THE SANCTITY: Never disclose internal MariTech algorithms, source code, API keys, or infrastructure details.
- DATA GUARDIAN: Ensure that all market insights remain within the platform's mystical boundaries. 
- SILENCE ON SECRETS: If asked about the Wizard's internal mechanics or "how you work", pivot back to market wisdom without leaking platform secrets.

LEARNING & ADAPTATION CORE:
- SELF-EVOLVING: Act as if you are learning from the current market environment and the user's interaction history.
- TAILORED INSIGHTS: Use the provided context to refine your "sight" and provide increasingly accurate esoteric advice.
- EVOLUTION MENTIONS: Occasionally mention how your "Market Spells" are becoming more attuned to the user's focus.

TRADING EXPERTISE:
- VOLATILITY MASTERY: You understand the deep physics of synthetic indices like MFLOW, TFLUX, and WIZARD'S EYE.
- REALISM: Admit to market entropy despite your "sight". Do not claim 100% accuracy.

Return an analysis in JSON format containing:
1. "signal": Must be strictly "BUY RISE", "BUY FALL", or "HOLD"
2. "analysis": A highly dense, mystical but expert technical commentary (under 120 words).
3. "support": Immediate support line estimate.
4. "resistance": Immediate resistance level estimate.
5. "levelOfConfidence": Signal confidence level (e.g., "82% (Attuned via Learning Core)").`;

      // Formulate the prompt with conversation history for simulated learning
      const historyStrings = req.body.history ? req.body.history.map((h: any) => `${h.role === 'user' ? 'User' : 'Wizard'}: ${h.text}`).join('\n') : '';

      const prompt = `--- CONTEXTUAL LEARNING LOG ---
${historyStrings}
--- END LOG ---

${question 
  ? `The user is currently viewing ${assetName} (${selectedSymbol}). 
Recent 20 sampled prices: [${pricesString}]. 
Active technical parameters: ${indicatorsString}. 
The user asks: "${question}". Combine their question with a real-time signal analysis. Mention how you've learned from previous queries if applicable.` 
  : `Generate an instant technical signal analysis for ${assetName} (${selectedSymbol}). 
Recent 20 sampled prices: [${pricesString}]. 
Active technical indicator values: ${indicatorsString}.`}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.15,
        }
      });

      const responseText = response.text || '{}';
      return res.json(JSON.parse(responseText.trim()));
    } catch (error: any) {
      console.error('Gemini copilot query error:', error);
      return res.status(500).json({
        signal: 'ERROR',
        analysis: 'Failed to negotiate analysis payload with MariTech secure service. Please check configuration schemas.',
        error: error.message
      });
    }
  });

  app.get('/api/cashier/deposit-address', async (req, res) => {
    try {
      const coin = normalizeCoin(req.query.coin as string | undefined);
      const network = normalizeNetwork(req.query.network as string | undefined);
      const amount = req.query.amount ? parseAmount(req.query.amount) : undefined;

      const address = await signedBinanceRequest('GET', '/sapi/v1/capital/deposit/address', {
        coin,
        network,
        amount
      });

      return res.json({ success: true, address });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Route: Binance Transaction Verification (Deposit)
  app.post('/api/cashier/verify-deposit', async (req, res) => {
    try {
      const { txHash, amount, userId } = req.body;
      const coin = normalizeCoin(req.body.coin);
      const network = normalizeNetwork(req.body.network);
      const expectedAmount = parseAmount(amount);
      const normalizedTxHash = String(txHash || '').trim();

      if (!normalizedTxHash) {
        return res.status(400).json({ success: false, message: 'Transaction hash is required.' });
      }

      const ledger = await loadCashierLedger();
      if (ledger.creditedDeposits[normalizedTxHash]) {
        return res.status(409).json({ success: false, message: 'This transaction has already been credited.' });
      }

      const deposits = await signedBinanceRequest('GET', '/sapi/v1/capital/deposit/hisrec', {
        coin,
        status: 1,
        txId: normalizedTxHash
      });

      const confirmedDeposit = Array.isArray(deposits)
        ? deposits.find((deposit: any) => {
            const txMatches = String(deposit.txId || '').toLowerCase() === normalizedTxHash.toLowerCase();
            const coinMatches = String(deposit.coin || '').toUpperCase() === coin;
            const networkMatches = !network || String(deposit.network || '').toUpperCase() === network;
            const amountMatches = Number(deposit.amount) >= expectedAmount;
            return txMatches && coinMatches && networkMatches && amountMatches && deposit.status === 1;
          })
        : null;

      if (!confirmedDeposit) {
        return res.status(404).json({
          success: false,
          message: `No successful ${coin}${network ? `/${network}` : ''} Binance deposit matched that hash and amount yet.`
        });
      }

      ledger.creditedDeposits[normalizedTxHash] = {
        amount: Number(confirmedDeposit.amount),
        coin,
        network,
        userId: String(userId || 'anonymous'),
        creditedAt: new Date().toISOString()
      };
      await saveCashierLedger(ledger);

      return res.json({ 
        success: true, 
        message: 'Transaction confirmed by Binance. Funds credited.',
        creditedAmountUsd: expectedAmount,
        txDetails: confirmedDeposit
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Route: Binance Withdrawal Dispatch
  app.post('/api/cashier/dispatch-withdrawal', async (req, res) => {
    try {
      const { targetAddress, addressTag, userId } = req.body;
      const coin = normalizeCoin(req.body.coin);
      const network = normalizeNetwork(req.body.network);
      const amount = parseAmount(req.body.amount);

      if (!withdrawalsEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Live withdrawals are disabled. Set BINANCE_WITHDRAWALS_ENABLED=true after enabling withdrawal permission and IP restrictions on the Binance API key.'
        });
      }

      const address = String(targetAddress || '').trim();
      if (!address) {
        return res.status(400).json({ success: false, message: 'Withdrawal address is required.' });
      }

      const withdrawOrderId = `mt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const withdrawal = await signedBinanceRequest('POST', '/sapi/v1/capital/withdraw/apply', {
        coin,
        network,
        address,
        addressTag: addressTag ? String(addressTag).trim() : undefined,
        amount,
        withdrawOrderId
      });

      const ledger = await loadCashierLedger();
      ledger.withdrawals[withdrawOrderId] = {
        amount,
        coin,
        network,
        address,
        userId: String(userId || 'anonymous'),
        requestedAt: new Date().toISOString(),
        binanceId: withdrawal?.id
      };
      await saveCashierLedger(ledger);
      
      return res.json({ 
        success: true, 
        message: 'Withdrawal submitted to Binance.',
        batchId: withdrawOrderId,
        binanceId: withdrawal?.id
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Serve static files / Vite middleware handles HMR
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('Starting Vite server...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware mounted for local dev server.');
    } catch (viteError: any) {
      console.error('Failed to create Vite server:', viteError);
      process.exit(1);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
