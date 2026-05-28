import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs/promises';
import multer from 'multer';

dotenv.config({ path: ['.env.local', '.env', '.env.example'] });

const __filename = typeof import.meta !== 'undefined' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();
const cashierLedgerPath = path.join(process.cwd(), 'cashier-ledger.json');
const uploadDir = path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
  users?: Record<string, {
    id: string;
    email: string;
    passwordHash: string;
    fullName: string;
    accountType: string;
    demoBalance: number;
    realBalance: number;
    createdAt: string;
    updatedAt: string;
  }>;
  pendingDeposits?: Record<string, {
    id: string;
    userId: string;
    amount: number;
    receiptPath?: string;
    message?: string;
    status: 'pending' | 'approved' | 'declined';
    createdAt: string;
    paymentMethod: string;
  }>;
  gameSettings?: {
    globalTrendBias: number; // -1 to 1
    forceOutcome?: 'win' | 'loss';
    volatilityMultiplier: number;
  };
}

const emptyCashierLedger = (): CashierLedger => ({
  creditedDeposits: {},
  withdrawals: {},
  pendingDeposits: {},
  gameSettings: {
    globalTrendBias: 0,
    volatilityMultiplier: 1
  }
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

  // NOWPayments Config from environment
  const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY;
  const nowPaymentsIpnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const nowPaymentsBaseUrl = process.env.NOWPAYMENTS_BASE_URL || 'https://api.nowpayments.io/v1';
  const withdrawalsEnabled = process.env.NOWPAYMENTS_WITHDRAWALS_ENABLED === 'true';

  const nowPaymentsRequest = async (
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any,
    params?: Record<string, string | number | boolean | undefined>
  ) => {
    if (!nowPaymentsKey) {
      throw new Error('NOWPayments API key is not configured.');
    }

    const urlObj = new URL(`${nowPaymentsBaseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) urlObj.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(urlObj.toString(), {
      method,
      headers: {
        'x-api-key': nowPaymentsKey,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.message || payload?.msg || `NOWPayments request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  };

  const parseAmount = (amount: unknown) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Amount must be a positive number.');
    }
    return parsed;
  };

  app.use(express.json());
  app.use('/uploads', express.static(uploadDir));

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

  // API Route: Create NOWPayments Payment
  app.post('/api/cashier/create-payment', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { amount, userId } = req.body;
      const coin = (req.body.coin || 'btc').toLowerCase();
      const parsedAmount = parseAmount(amount);

      const payment = await nowPaymentsRequest('POST', '/payment', {
        price_amount: parsedAmount,
        price_currency: 'usd',
        pay_currency: coin,
        order_id: `dep-${Date.now()}-${userId}`,
        order_description: `Deposit to MariTech Wallet for ${userId}`,
        ipn_callback_url: process.env.IPN_CALLBACK_URL // Optional but good for automation
      });

      return res.json({ 
        success: true, 
        payment_id: payment.payment_id,
        address: payment.pay_address,
        amount: payment.pay_amount,
        coin: payment.pay_currency,
        status: payment.payment_status
      });
    } catch (error: any) {
      console.error('NOWPayments Create Payment Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Route: Verify NOWPayments Deposit (Status Check)
  app.get('/api/cashier/verify-deposit', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { paymentId, userId } = req.query;

      if (!paymentId) {
        return res.status(400).json({ success: false, message: 'Payment ID is required.' });
      }

      const status = await nowPaymentsRequest('GET', `/payment/${paymentId}`);

      if (status.payment_status === 'finished' || status.payment_status === 'confirmed' || status.payment_status === 'partially_paid') {
        const ledger = await loadCashierLedger();
        const txHash = status.payin_hash || String(paymentId);

        if (ledger.creditedDeposits[txHash]) {
          return res.json({ success: true, message: 'Already credited.', alreadyCredited: true });
        }

        const actualAmount = Number(status.actually_paid) || Number(status.price_amount);

        ledger.creditedDeposits[txHash] = {
          amount: actualAmount,
          coin: status.pay_currency?.toUpperCase() || 'BTC',
          userId: String(userId || 'anonymous'),
          creditedAt: new Date().toISOString()
        };

        // Update user balance
        const userEntry = Object.values(ledger.users || {}).find(u => u.id === userId || u.email === userId);
        if (userEntry) {
          userEntry.realBalance += actualAmount;
          userEntry.updatedAt = new Date().toISOString();
        }

        await saveCashierLedger(ledger);

        return res.json({ 
          success: true, 
          message: 'Payment confirmed and credited.',
          status: status.payment_status,
          creditedAmount: actualAmount
        });
      }

      return res.json({ 
        success: false, 
        message: `Payment status: ${status.payment_status}`, 
        status: status.payment_status 
      });
    } catch (error: any) {
      console.error('NOWPayments Status Check Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Route: NOWPayments Withdrawal Dispatch
  app.post('/api/cashier/dispatch-withdrawal', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { targetAddress, userId } = req.body;
      const coin = (req.body.coin || 'btc').toLowerCase();
      const amount = parseAmount(req.body.amount);

      if (!withdrawalsEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Live withdrawals are disabled. Set NOWPAYMENTS_WITHDRAWALS_ENABLED=true.'
        });
      }

      const address = String(targetAddress || '').trim();
      if (!address) {
        return res.status(400).json({ success: false, message: 'Withdrawal address is required.' });
      }

      // NOWPayments Payout API usually requires a specialized call or a separate setup.
      // For now, we'll implement it as a payout request.
      const payout = await nowPaymentsRequest('POST', '/payout', {
        withdrawals: [
          {
            address,
            currency: coin,
            amount: amount,
            ipn_callback_url: process.env.IPN_CALLBACK_URL
          }
        ]
      });

      const payoutId = payout.id || `po-${Date.now()}`;
      const ledger = await loadCashierLedger();
      ledger.withdrawals[payoutId] = {
        amount,
        coin: coin.toUpperCase(),
        address,
        userId: String(userId || 'anonymous'),
        requestedAt: new Date().toISOString()
      };
      
      // Withdraw from user balance immediately if it was from realBalance
      const userEntry = Object.values(ledger.users || {}).find(u => u.id === userId || u.email === userId);
      if (userEntry) {
        userEntry.realBalance -= amount;
        userEntry.updatedAt = new Date().toISOString();
      }

      await saveCashierLedger(ledger);
      
      return res.json({ 
        success: true, 
        message: 'Withdrawal submitted to NOWPayments.',
        payoutId
      });
    } catch (error: any) {
      console.error('NOWPayments Payout Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Route: NOWPayments IPN Webhook (Instant Payment Notification)
  // This allows the system to credit users even if they close the browser
  app.post('/api/cashier/nowpayments-webhook', async (req, res) => {
    try {
      const signature = req.headers['x-nowpayments-sig'];
      const secret = process.env.NOWPAYMENTS_IPN_SECRET;

      if (!signature || !secret) {
        console.warn('Webhook received without signature or secret configured.');
        return res.status(400).send('Missing signature or secret');
      }

      // 1. Verify the signature
      const hmac = crypto.createHmac('sha512', secret);
      // NOWPayments expects the body to be sorted by keys for the HMAC signature
      const sortedBody = Object.keys(req.body).sort().reduce((obj: any, key: string) => {
        obj[key] = req.body[key];
        return obj;
      }, {});
      
      const checkSignature = hmac.update(JSON.stringify(sortedBody)).digest('hex');

      if (signature !== checkSignature) {
        console.error('Invalid NOWPayments Webhook Signature');
        return res.status(401).send('Invalid signature');
      }

      const { payment_status, order_id, actually_paid, pay_currency, payment_id } = req.body;

      // 2. Process only finished/confirmed payments
      if (payment_status === 'finished' || payment_status === 'confirmed') {
        const ledger = await loadCashierLedger();
        const txHash = req.body.payin_hash || String(payment_id);

        if (ledger.creditedDeposits[txHash]) {
          return res.status(200).send('Already processed');
        }

        // order_id format: dep-timestamp-userId
        const parts = order_id.split('-');
        const userId = parts[parts.length - 1];

        const amount = Number(actually_paid);

        ledger.creditedDeposits[txHash] = {
          amount,
          coin: pay_currency?.toUpperCase() || 'BTC',
          userId: String(userId),
          creditedAt: new Date().toISOString()
        };

        const userEntry = Object.values(ledger.users || {}).find(u => u.id === userId || u.email === userId);
        if (userEntry) {
          userEntry.realBalance += amount;
          userEntry.updatedAt = new Date().toISOString();
          console.log(`[WEBHOOK] Successfully credited User ${userId} with $${amount}`);
        }

        await saveCashierLedger(ledger);
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API Route: Upload M-Pesa Receipt
  app.post('/api/cashier/upload-receipt', upload.single('receipt'), async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { userId, amount, paymentMethod, message } = req.body;
      
      const ledger = await loadCashierLedger();
      if (!ledger.pendingDeposits) ledger.pendingDeposits = {};

      const depositId = `dep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      ledger.pendingDeposits[depositId] = {
        id: depositId,
        userId: userId || 'anonymous',
        amount: Number(amount),
        receiptPath: req.file ? `/uploads/${req.file.filename}` : undefined,
        message: message || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paymentMethod: paymentMethod || 'paybill'
      };

      await saveCashierLedger(ledger);

      return res.json({
        success: true,
        message: 'Receipt uploaded successfully. Admin will verify your payment soon.',
        depositId
      });
    } catch (error: any) {
      console.error('Upload receipt error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== AUTH ENDPOINTS ====================
  
  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { email, password, fullName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const userId = `user-${crypto.randomBytes(8).toString('hex')}`;
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const now = new Date().toISOString();

      const ledger = await loadCashierLedger();
      if (!ledger.users) (ledger as any).users = {};
      
      if ((ledger as any).users[email]) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      }

      (ledger as any).users[email] = {
        id: userId,
        email,
        passwordHash,
        fullName: fullName || 'User',
        accountType: 'demo',
        demoBalance: 10000,
        realBalance: 0,
        createdAt: now,
        updatedAt: now
      };

      await saveCashierLedger(ledger);

      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      return res.json({
        success: true,
        message: 'Registration successful!',
        user: {
          id: userId,
          email,
          fullName: fullName || 'User'
        },
        token: sessionToken
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const ledger = await loadCashierLedger();
      const user = (ledger as any).users?.[email];

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (passwordHash !== user.passwordHash) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      return res.json({
        success: true,
        message: 'Login successful!',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          balance: user.accountType === 'demo' ? user.demoBalance : user.realBalance
        },
        token: sessionToken
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Login failed' });
    }
  });

  // Admin endpoint - Get all users
  app.get('/api/admin/users', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const ledger = await loadCashierLedger();
      const users = Object.values((ledger as any).users || {}).map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        demoBalance: u.demoBalance,
        realBalance: u.realBalance,
        createdAt: u.createdAt
      }));

      return res.json({
        success: true,
        users,
        totalUsers: users.length
      });
    } catch (error: any) {
      console.error('Admin users error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get users' });
    }
  });

  // Admin endpoint - Get system stats
  app.get('/api/admin/stats', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const ledger = await loadCashierLedger();
      const users = Object.values((ledger as any).users || {}) as any[];
      const deposits = Object.values(ledger.creditedDeposits || {}) as any[];

      const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalUsers = users.length;

      return res.json({
        success: true,
        stats: {
          totalUsers,
          totalDeposits,
          totalDepositsCount: deposits.length,
          totalWithdrawals: Object.keys(ledger.withdrawals || {}).length,
          topDepositAmount: deposits.length > 0 ? Math.max(...deposits.map(d => d.amount)) : 0
        }
      });
    } catch (error: any) {
      console.error('Admin stats error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get stats' });
    }
  });

  // Admin endpoint - Get pending deposits
  app.get('/api/admin/pending-deposits', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const ledger = await loadCashierLedger();
      const pending = Object.values(ledger.pendingDeposits || {}).filter(d => d.status === 'pending');

      return res.json({ success: true, deposits: pending });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Admin endpoint - Approve/Decline deposit
  app.post('/api/admin/process-deposit', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const { depositId, action } = req.body; // action: 'approve' | 'decline'
      const ledger = await loadCashierLedger();
      const deposit = ledger.pendingDeposits?.[depositId];

      if (!deposit) {
        return res.status(404).json({ success: false, message: 'Deposit not found.' });
      }

      if (action === 'approve') {
        deposit.status = 'approved';
        
        // Find user by ID or email
        const userEntry = Object.values(ledger.users || {}).find(u => u.id === deposit.userId || u.email === deposit.userId);
        if (userEntry) {
          userEntry.realBalance += deposit.amount;
          userEntry.updatedAt = new Date().toISOString();
        }

        // Add to credited deposits
        const txHash = `manual-${depositId}`;
        ledger.creditedDeposits[txHash] = {
          amount: deposit.amount,
          coin: 'USD',
          userId: deposit.userId,
          creditedAt: new Date().toISOString()
        };
      } else {
        deposit.status = 'declined';
      }

      await saveCashierLedger(ledger);
      return res.json({ success: true, message: `Deposit ${action}d successfully.` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Admin endpoint - Get game settings
  app.get('/api/admin/game-settings', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const ledger = await loadCashierLedger();
      return res.json({ success: true, settings: ledger.gameSettings });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Admin endpoint - Update game settings
  app.post('/api/admin/game-settings', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const { settings } = req.body;
      const ledger = await loadCashierLedger();
      ledger.gameSettings = { ...ledger.gameSettings, ...settings };

      await saveCashierLedger(ledger);
      return res.json({ success: true, message: 'Game settings updated.', settings: ledger.gameSettings });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Public endpoint for client to fetch game settings (sanitized)
  app.get('/api/settings/game', async (req, res) => {
    try {
      const ledger = await loadCashierLedger();
      // Only return what's necessary for the client to know
      return res.json({ 
        success: true, 
        settings: {
          globalTrendBias: ledger.gameSettings?.globalTrendBias || 0,
          volatilityMultiplier: ledger.gameSettings?.volatilityMultiplier || 1
          // We hide forceOutcome from non-admin users if we want to be sneaky
        }
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
