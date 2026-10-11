// Paddle Billing (merchant of record) for the Pro plan.
// Checkout runs on our /checkout page with Paddle.js; the extension's install ID travels
// as custom_data, so the first completed transaction turns Pro on in that browser.
import crypto from 'node:crypto';
import {ensureLicense, setSubscriptionStatus} from './billing.js';

const API_BASE = {sandbox: 'https://sandbox-api.paddle.com', production: 'https://api.paddle.com'};
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function makePaddle(env = process.env, fetchImpl = globalThis.fetch) {
  const {PADDLE_API_KEY, PADDLE_CLIENT_TOKEN, PADDLE_PRICE_ID, PADDLE_WEBHOOK_SECRET, PADDLE_PORTAL_URL} = env;
  if (!PADDLE_API_KEY || !PADDLE_CLIENT_TOKEN || !PADDLE_PRICE_ID) return null;
  const mode = env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';

  async function api(path) {
    const r = await fetchImpl(API_BASE[mode] + path, {headers: {Authorization: `Bearer ${PADDLE_API_KEY}`, 'Paddle-Version': '1'}});
    if (!r.ok) throw new Error(`Paddle API ${r.status} on ${path}`);
    return (await r.json()).data;
  }

  return {
    mode,
    clientToken: PADDLE_CLIENT_TOKEN,
    priceId: PADDLE_PRICE_ID,
    portalUrl: PADDLE_PORTAL_URL || null,
    // Paddle-Signature: "ts=1671552777;h1=<hex>" (several h1 values during secret rotation).
    verify(rawBody, header, now = Date.now()) {
      if (!PADDLE_WEBHOOK_SECRET || !header) return false;
      let ts = null;
      const sigs = [];
      for (const part of String(header).split(';')) {
        const [k, v] = part.split('=');
        if (k === 'ts') ts = v;
        if (k === 'h1' && v) sigs.push(v);
      }
      if (!ts || !sigs.length || Math.abs(now / 1000 - Number(ts)) > 300) return false;
      const expected = crypto.createHmac('sha256', PADDLE_WEBHOOK_SECRET).update(`${ts}:`).update(rawBody).digest('hex');
      return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
    },
    getTransaction: id => api(`/transactions/${encodeURIComponent(id)}`),
    getCustomer: id => api(`/customers/${encodeURIComponent(id)}`)
  };
}

export async function licenseFromTransaction(store, paddle, txn) {
  if (!txn || !['completed', 'paid'].includes(txn.status) || !txn.subscription_id) return null;
  let email = null;
  if (txn.customer_id) {
    try { email = (await paddle.getCustomer(txn.customer_id)).email || null; } catch { /* email is optional */ }
  }
  const raw = txn.custom_data && txn.custom_data.installId;
  return ensureLicense(store, {
    ref: txn.id,
    installId: INSTALL_ID.test(String(raw)) ? String(raw).toLowerCase() : null,
    email,
    customerId: txn.customer_id || null,
    subscriptionId: txn.subscription_id,
    provider: 'paddle'
  });
}

export async function handlePaddleEvent(store, paddle, event) {
  const d = (event && event.data) || {};
  const type = event && event.event_type;
  if (type === 'transaction.completed' || type === 'transaction.paid') {
    const key = await licenseFromTransaction(store, paddle, d);
    return key ? 'licence ensured' : 'not a subscription payment';
  }
  if (type && type.startsWith('subscription.') && d.id && d.status) {
    return (await setSubscriptionStatus(store, d.id, d.status)) ? `status ${d.status}` : 'subscription not linked yet';
  }
  return 'ignored';
}
