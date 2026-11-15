import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '../../../../lib/supabaseAdmin';
import { paypal, PRICE, CURRENCY } from '../../../../lib/paypal';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  let orderID;
  try { ({ orderID } = await req.json()); } catch { /* ignore */ }
  if (!orderID || typeof orderID !== 'string') return NextResponse.json({ error: 'Missing order.' }, { status: 400 });

  try {
    // 1. Check the order BEFORE taking the money: it must be ours, for this member, at our price.
    const order = await paypal('/v2/checkout/orders/' + encodeURIComponent(orderID), 'GET');
    const pu = order.purchase_units && order.purchase_units[0];
    if (!pu || pu.custom_id !== user.id || !pu.amount || pu.amount.value !== PRICE || pu.amount.currency_code !== CURRENCY) {
      return NextResponse.json({ error: 'This payment does not match your account.' }, { status: 400 });
    }

    // 2. Capture the payment.
    const cap = await paypal('/v2/checkout/orders/' + encodeURIComponent(orderID) + '/capture', 'POST', {});
    const capture = cap.purchase_units && cap.purchase_units[0] && cap.purchase_units[0].payments && cap.purchase_units[0].payments.captures && cap.purchase_units[0].payments.captures[0];
    if (cap.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'The payment is not completed yet. If you were charged, contact us with order ' + orderID + '.' }, { status: 402 });
    }

    // 3. Activate the membership. paypal_order_id is unique, so one order can activate only one member.
    const { error } = await supabaseAdmin.from('profiles')
      .update({ paid: true, paid_at: new Date().toISOString(), paypal_order_id: orderID })
      .eq('id', user.id);
    if (error) {
      console.error('activate', error.message);
      return NextResponse.json({ error: 'Payment received but activation failed. Contact us with order ' + orderID + '.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('capture-order', e.message, JSON.stringify(e.detail || {}));
    return NextResponse.json({ error: 'Could not complete the payment. Please try again.' }, { status: 502 });
  }
}
