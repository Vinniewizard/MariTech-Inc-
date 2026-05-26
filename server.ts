import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = typeof import.meta !== 'undefined' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
