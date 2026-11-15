import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '../../../../lib/supabaseAdmin';
import { paypal, PRICE, CURRENCY } from '../../../../lib/paypal';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('paid').eq('id', user.id).single();
  if (profile && profile.paid) return NextResponse.json({ error: 'Your membership is already active.' }, { status: 400 });

  try {
    const order = await paypal('/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: user.id, // ties the payment to this member
        description: 'Dealora lifetime membership (one-time)',
        amount: { currency_code: CURRENCY, value: PRICE },
      }],
    });
    return NextResponse.json({ id: order.id });
  } catch (e) {
    console.error('create-order', e.message, JSON.stringify(e.detail || {}));
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 502 });
  }
}
