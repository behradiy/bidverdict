import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createApp} from '../src/index.js';
import {makeStore} from '../src/store.js';
import {makePaddle, handlePaddleEvent} from '../src/paddle.js';
import {planFor} from '../src/billing.js';

process.env.MOCK_AI = '1';
const SECRET = 'pdl_ntfset_test_secret';
const INSTALL = '44444444-5555-4666-8777-888888888888';
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

// Fake Paddle API: one completed subscription checkout, its renewal, and the customer.
const TXNS = {
  txn_first: {id: 'txn_first', status: 'completed', customer_id: 'ctm_1', subscription_id: 'sub_1', custom_data: {installId: INSTALL}, origin: 'web'},
  txn_renew: {id: 'txn_renew', status: 'completed', customer_id: 'ctm_1', subscription_id: 'sub_1', custom_data: {installId: INSTALL}, origin: 'subscription_recurring'},
  txn_draft: {id: 'txn_draft', status: 'ready', customer_id: 'ctm_1', subscription_id: null, custom_data: {installId: INSTALL}}
};
const fakeFetch = async url => {
  const m = String(url).match(/\/(transactions|customers)\/([a-z_0-9]+)$/);
  const data = m && (m[1] === 'transactions' ? TXNS[m[2]] : {id: m[2], email: 'buyer@example.com'});
  return {ok: !!data, status: data ? 200 : 404, json: async () => ({data})};
};
const env = {PADDLE_API_KEY: 'pdl_sdbx_apikey', PADDLE_CLIENT_TOKEN: 'test_client', PADDLE_PRICE_ID: 'pri_123', PADDLE_WEBHOOK_SECRET: SECRET, PADDLE_PORTAL_URL: 'https://customer-portal.paddle.com/cpl_x'};
const paddle = makePaddle(env, fakeFetch);
const store = makeStore('memory');
let server, base;

before(async () => {
  server = createApp({store, paddle}).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function sign(body, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${crypto.createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')}`;
}
const hook = (event, sig) => {
  const body = JSON.stringify(event);
  return fetch(base + '/paddle/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'paddle-signature': sig ?? sign(body)}, body});
};
const me = async id => (await fetch(`${base}/v1/me?installId=${id}`, {headers: {origin: ORIGIN}})).json();

test('makePaddle is off without keys and picks sandbox by default', () => {
  assert.equal(makePaddle({}), null);
  assert.equal(paddle.mode, 'sandbox');
  assert.equal(makePaddle({...env, PADDLE_ENV: 'production'}).mode, 'production');
});

test('signature check: valid, tampered, stale and rotated secrets', () => {
  const body = '{"a":1}';
  assert.equal(paddle.verify(Buffer.from(body), sign(body)), true);
  assert.equal(paddle.verify(Buffer.from('{"a":2}'), sign(body)), false);
  assert.equal(paddle.verify(Buffer.from(body), sign(body, Math.floor(Date.now() / 1000) - 3600)), false);
  const ts = Math.floor(Date.now() / 1000);
  const good = crypto.createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  assert.equal(paddle.verify(Buffer.from(body), `ts=${ts};h1=${'0'.repeat(64)};h1=${good}`), true);
  assert.equal(paddle.verify(Buffer.from(body), undefined), false);
});

test('webhook rejects bad signatures', async () => {
  const r = await hook({event_type: 'transaction.completed', data: TXNS.txn_first}, 'ts=1;h1=deadbeef');
  assert.equal(r.status, 400);
  assert.equal((await me(INSTALL)).plan, 'free');
});

test('completed checkout turns Pro on in the buying browser; renewal reuses the licence', async () => {
  assert.equal((await me(INSTALL)).checkoutUrl, `${base}/checkout?installId=${INSTALL}`);
  assert.equal((await hook({event_id: 'evt_1', event_type: 'transaction.completed', data: TXNS.txn_first})).status, 200);
  let m = await me(INSTALL);
  assert.equal(m.plan, 'pro');
  assert.equal(m.checkoutUrl, null);
  assert.equal(m.portalUrl, 'https://customer-portal.paddle.com/cpl_x');
  await hook({event_type: 'transaction.completed', data: TXNS.txn_renew});
  const licences = [...store._dump().keys()].filter(k => k.startsWith('licenses/'));
  assert.equal(licences.length, 1, 'renewal must not create a second licence');
  const lic = store._dump().get(licences[0]);
  assert.equal(lic.email, 'buyer@example.com');
  assert.equal(lic.subscriptionId, 'sub_1');
});

test('thanks page shows the same key; a second browser can activate it', async () => {
  const html = await (await fetch(`${base}/thanks?txn=txn_first`)).text();
  const key = html.match(/GV(-[A-Z0-9]{4}){4}/)[0];
  const lic = [...store._dump().entries()].find(([k]) => k === `licenses/${key}`);
  assert.ok(lic, 'thanks page key matches the webhook licence');
  const other = '99999999-8888-4777-8666-555555555555';
  const r = await fetch(base + '/v1/license', {method: 'POST', headers: {'content-type': 'application/json', origin: ORIGIN}, body: JSON.stringify({installId: other, key})});
  assert.equal((await r.json()).plan, 'pro');
  const pending = await (await fetch(`${base}/thanks?txn=txn_draft`)).text();
  assert.match(pending, /Confirming your payment/);
});

test('past_due keeps Pro, canceled and paused end it', async () => {
  await hook({event_type: 'subscription.past_due', data: {id: 'sub_1', status: 'past_due'}});
  assert.equal(await planFor(store, INSTALL), 'pro');
  await hook({event_type: 'subscription.canceled', data: {id: 'sub_1', status: 'canceled'}});
  assert.equal(await planFor(store, INSTALL), 'free');
  await hook({event_type: 'subscription.updated', data: {id: 'sub_1', status: 'active'}});
  assert.equal(await planFor(store, INSTALL), 'pro');
  await hook({event_type: 'subscription.paused', data: {id: 'sub_1', status: 'paused'}});
  assert.equal(await planFor(store, INSTALL), 'free');
});

test('events for unknown subscriptions and other types are ignored safely', async () => {
  assert.equal(await handlePaddleEvent(store, paddle, {event_type: 'subscription.updated', data: {id: 'sub_unknown', status: 'active'}}), 'subscription not linked yet');
  assert.equal(await handlePaddleEvent(store, paddle, {event_type: 'customer.updated', data: {}}), 'ignored');
  assert.equal(await handlePaddleEvent(store, paddle, {event_type: 'transaction.completed', data: TXNS.txn_draft}), 'not a subscription payment');
});
