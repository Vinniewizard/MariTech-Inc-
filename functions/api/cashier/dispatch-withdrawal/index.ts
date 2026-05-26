import { signedBinanceRequest, normalizeCoin, normalizeNetwork } from '../../../_shared/binance';
import { jsonResponse, parseAmount, readJson } from '../../../_shared/http';
import { recordWithdrawal } from '../../../_shared/ledger';
import type { Env, PagesFunction } from '../../../_shared/types';

function randomHex(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (env.BINANCE_WITHDRAWALS_ENABLED !== 'true') {
      return jsonResponse({
        success: false,
        message: 'Live withdrawals are disabled. Set BINANCE_WITHDRAWALS_ENABLED=true after enabling withdrawal permission and IP restrictions on the Binance API key.'
      }, { status: 403 });
    }

    const body = await readJson<any>(request);
    const coin = normalizeCoin(env, body.coin);
    const network = normalizeNetwork(env, body.network);
    const amount = parseAmount(body.amount);
    const address = String(body.targetAddress || '').trim();
    const addressTag = String(body.addressTag || '').trim();
    const userId = String(body.userId || 'anonymous');

    if (!address) {
      return jsonResponse({ success: false, message: 'Withdrawal address is required.' }, { status: 400 });
    }

    const withdrawOrderId = `mt-${Date.now()}-${randomHex(4)}`;
    const withdrawal = await signedBinanceRequest(env, 'POST', '/sapi/v1/capital/withdraw/apply', {
      coin,
      network,
      address,
      addressTag: addressTag || undefined,
      amount,
      withdrawOrderId
    });

    await recordWithdrawal(env, {
      withdrawOrderId,
      amount,
      coin,
      network,
      address,
      userId,
      binanceId: withdrawal?.id
    });

    return jsonResponse({
      success: true,
      message: 'Withdrawal submitted to Binance.',
      batchId: withdrawOrderId,
      binanceId: withdrawal?.id
    });
  } catch (error: any) {
    return jsonResponse({ success: false, message: error.message }, { status: 500 });
  }
};

