import { nowPaymentsRequest } from '../../../_shared/nowpayments';
import { jsonResponse, readJson } from '../../../_shared/http';
import type { Env, PagesFunction } from '../../../_shared/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await readJson<any>(request);
    const { amount, coin, userId } = body;

    const payment = await nowPaymentsRequest(env, 'POST', '/payment', {
      price_amount: Number(amount),
      price_currency: 'usd',
      pay_currency: String(coin).toLowerCase(),
      order_id: `dep-${Date.now()}-${userId}`,
      order_description: 'User Balance Deposit'
    });

    return jsonResponse({
        success: true,
        address: payment.pay_address,
        paymentId: payment.payment_id,
        coin: payment.pay_currency,
        amount: payment.pay_amount
    });
  } catch (error: any) {
    return jsonResponse({ success: false, message: error.message }, { status: 500 });
  }
};
