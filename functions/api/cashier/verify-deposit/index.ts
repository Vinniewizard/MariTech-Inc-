import { nowPaymentsRequest } from '../../../_shared/nowpayments';
import { jsonResponse } from '../../../_shared/http';
import { findCreditedDeposit, recordCreditedDeposit } from '../../../_shared/ledger';
import type { Env, PagesFunction } from '../../../_shared/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const paymentId = url.searchParams.get('paymentId');
    const userId = url.searchParams.get('userId') || 'anonymous';

    if (!paymentId) {
      return jsonResponse({ success: false, message: 'Payment ID is required.' }, { status: 400 });
    }

    const alreadyCredited = await findCreditedDeposit(env, paymentId);
    if (alreadyCredited) {
      return jsonResponse({ success: true, message: 'Deposit already credited.' });
    }

    const status = await nowPaymentsRequest(env, 'GET', `/payment/${paymentId}`);

    if (status.payment_status === 'finished' || status.payment_status === 'confirmed' || status.payment_status === 'partially_paid') {
      const txHash = status.payin_hash || String(paymentId);
      
      await recordCreditedDeposit(env, {
        txHash,
        amount: Number(status.actually_paid),
        coin: status.pay_currency?.toUpperCase() || 'BTC',
        network: 'CRYPTO',
        userId
      });

      return jsonResponse({
        success: true,
        message: 'Payment confirmed. Funds credited.',
        amount: status.actually_paid
      });
    }

    return jsonResponse({
      success: false,
      message: `Current status: ${status.payment_status}. Please wait for confirmation.`,
      status: status.payment_status
    });
  } catch (error: any) {
    return jsonResponse({ success: false, message: error.message }, { status: 500 });
  }
};
