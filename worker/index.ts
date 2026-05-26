import { onRequestGet as getDepositAddress } from '../functions/api/cashier/deposit-address';
import { onRequestPost as verifyDeposit } from '../functions/api/cashier/verify-deposit';
import { onRequestPost as dispatchWithdrawal } from '../functions/api/cashier/dispatch-withdrawal';
import { onRequestPost as analyzeCopilot } from '../functions/api/copilot/analyze';
import { jsonResponse } from '../functions/_shared/http';
import type { Env } from '../functions/_shared/types';

function createContext(request: Request, env: Env) {
  return {
    request,
    env,
    params: {},
    waitUntil: () => {},
    next: () => env.ASSETS?.fetch(request) || Promise.resolve(new Response('Not found', { status: 404 })),
    data: {}
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/cashier/deposit-address' && request.method === 'GET') {
      return getDepositAddress(createContext(request, env));
    }

    if (url.pathname === '/api/cashier/verify-deposit' && request.method === 'POST') {
      return verifyDeposit(createContext(request, env));
    }

    if (url.pathname === '/api/cashier/dispatch-withdrawal' && request.method === 'POST') {
      return dispatchWithdrawal(createContext(request, env));
    }

    if (url.pathname === '/api/copilot/analyze' && request.method === 'POST') {
      return analyzeCopilot(createContext(request, env));
    }

    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ success: false, message: 'API route not found.' }, { status: 404 });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding is not configured.', { status: 500 });
  }
};

