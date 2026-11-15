// Server-only PayPal helpers (Orders v2 API).
const BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

export const PRICE = process.env.NEXT_PUBLIC_PRICE || '1.99';
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'USD';

async function accessToken() {
  const basic = Buffer.from(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  const r = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!r.ok) throw new Error('PayPal authentication failed (' + r.status + ')');
  return (await r.json()).access_token;
}

export async function paypal(path, method, body) {
  const token = await accessToken();
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('PayPal request failed (' + r.status + ')');
    err.detail = json;
    throw err;
  }
  return json;
}
