import { signedBinanceRequest, normalizeCoin, normalizeNetwork } from '../../../_shared/binance';
import { jsonResponse, parseAmount, readJson } from '../../../_shared/http';
import { findCreditedDeposit, recordCreditedDeposit } from '../../../_shared/ledger';
import type { Env, PagesFunction } from '../../../_shared/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await readJson<any>(request);
    const coin = normalizeCoin(env, body.coin);
    const network = normalizeNetwork(env, body.network);
    const expectedAmount = parseAmount(body.amount);
    const txHash = String(body.txHash || '').trim();
    const userId = String(body.userId || 'anonymous');

    if (!txHash) {
      return jsonResponse({ success: false, message: 'Transaction hash is required.' }, { status: 400 });
    }

    const alreadyCredited = await findCreditedDeposit(env, txHash);
    if (alreadyCredited) {
      return jsonResponse({ success: false, message: 'This transaction has already been credited.' }, { status: 409 });
    }

    const deposits = await signedBinanceRequest(env, 'GET', '/sapi/v1/capital/deposit/hisrec', {
      coin,
      status: 1,
      txId: txHash
    });

    const confirmedDeposit = Array.isArray(deposits)
      ? deposits.find((deposit: any) => {
          const txMatches = String(deposit.txId || '').toLowerCase() === txHash.toLowerCase();
          const coinMatches = String(deposit.coin || '').toUpperCase() === coin;
          const networkMatches = String(deposit.network || '').toUpperCase() === network;
          const amountMatches = Number(deposit.amount) >= expectedAmount;
          return txMatches && coinMatches && networkMatches && amountMatches && deposit.status === 1;
        })
      : null;

    if (!confirmedDeposit) {
      return jsonResponse({
        success: false,
        message: `No successful ${coin}/${network} Binance deposit matched that hash and amount yet.`
      }, { status: 404 });
    }

    await recordCreditedDeposit(env, {
      txHash,
      amount: Number(confirmedDeposit.amount),
      coin,
      network,
      userId
    });

    return jsonResponse({
      success: true,
      message: 'Transaction confirmed by Binance. Funds credited.',
      creditedAmountUsd: expectedAmount,
      txDetails: confirmedDeposit
    });
  } catch (error: any) {
    return jsonResponse({ success: false, message: error.message }, { status: 500 });
  }
};

