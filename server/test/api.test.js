import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createApp} from '../src/index.js';
import {makeStore} from '../src/store.js';

process.env.MOCK_AI = '1';
process.env.FREE_DAILY_LIMIT = '5';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const INSTALL = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60';
const store = makeStore('memory');
const fakePaddle = {mode: 'sandbox', clientToken: 'test_token', priceId: 'pri_test', portalUrl: 'https://customer-portal.paddle.com/cpl_test', verify: () => false, getTransaction: async () => null, getCustomer: async () => ({email: 'a@b.co'})};
let server, base;

before(async () => {
  server = createApp({store, paddle: fakePaddle}).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (path, body, origin = ORIGIN) => fetch(base + path, {
  method: body ? 'POST' : 'GET',
  headers: {'content-type': 'application/json', ...(origin ? {origin} : {})},
  body: body ? JSON.stringify(body) : undefined
});

const notice = {
  id: 'ded9f2f94a8443518dd5951c5152da3d', title: 'S209--Linen and Laundry Services', type: 'k', setAside: 'SBA',
  deadline: new Date(Date.now() + 5 * 86400000).toISOString(), naics: ['812320'], place: {state: 'AZ'}
};
const pdf = readFileSync(new URL('../../test/fixtures/amendment-0004.pdf', import.meta.url)).toString('base64');

test('rejects requests that are not from an extension', async () => {
  const r = await call(`/v1/me?installId=${INSTALL}`, null, 'https://evil.example');
  assert.equal(r.status, 403);
});

test('preflight returns CORS headers for the extension origin', async () => {
  const r = await fetch(base + '/v1/analyze', {method: 'OPTIONS', headers: {origin: ORIGIN}});
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});

test('me returns the free plan and a checkout link', async () => {
  const r = await call(`/v1/me?installId=${INSTALL}`);
  const j = await r.json();
  assert.equal(j.plan, 'free');
  assert.equal(j.limit, 5);
  assert.match(j.checkoutUrl, /\/checkout\?installId=6f1c2a4e/);
  assert.equal(j.priceLabel, '$14 a month');
});

test('analyze returns a finalised result and counts usage', async () => {
  const r = await call('/v1/analyze', {installId: INSTALL, notice, profile: {naics: '812320', certs: ['sb'], states: 'AZ'}, files: [{name: 'Amendment 0004.pdf', mime: 'application/pdf', data: pdf}]});
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(['Bid', 'Consider', 'No-bid', 'Respond'].includes(j.result.verdict));
  assert.deepEqual(j.result.documentsRead, ['Amendment 0004.pdf']);
  assert.equal(j.checks.naics.match, 'exact');
  assert.equal(j.account.used, 1);
});

test('hard stop forces No-bid even when the model says otherwise', async () => {
  const r = await call('/v1/analyze', {installId: INSTALL, notice: {...notice, setAside: 'SDVOSBC'}, profile: {certs: ['sb']}});
  const j = await r.json();
  assert.equal(j.result.verdict, 'No-bid');
  assert.ok(j.result.score <= 15);
  assert.match(j.result.verdictReason, /SDVOSB/);
});

test('rejects unsupported files and bad notice IDs', async () => {
  assert.equal((await call('/v1/analyze', {installId: INSTALL, notice: {...notice, id: 'nope'}})).status, 400);
  assert.equal((await call('/v1/analyze', {installId: INSTALL, notice, files: [{name: 'x.exe', mime: 'application/octet-stream', data: 'AA=='}]})).status, 400);
});

test('free quota stops at the daily limit', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  for (let i = 0; i < 5; i++) assert.equal((await call('/v1/analyze', {installId: id, notice})).status, 200);
  const r = await call('/v1/analyze', {installId: id, notice});
  assert.equal(r.status, 429);
  assert.equal((await r.json()).account.used, 5);
});

test('landing page has the video, screenshots and store copy; assets are served', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<video[^>]+autoplay[^>]+muted/);
  assert.match(html, /\/assets\/media\/demo\.mp4/);
  for (let n = 1; n <= 5; n++) assert.match(html, new RegExp(`/assets/img/screenshot-${n}\\.webp`));
  assert.match(html, /Know exactly what the offer needs/);
  assert.match(html, /\$14/);
  for (const p of ['/assets/media/demo.mp4', '/assets/media/demo.webm', '/assets/media/demo-poster.jpg', '/assets/img/screenshot-3.webp', '/assets/img/og.jpg']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
    assert.ok(Number(r.headers.get('content-length')) > 1000, p);
  }
  assert.equal((await fetch(base + '/assets/nope.png')).status, 404);
});

test('robots, sitemap and absolute social tags', async () => {
  const robots = await (await fetch(base + '/robots.txt')).text();
  assert.match(robots, /Disallow: \/v1\//);
  assert.match(robots, new RegExp(`Sitemap: ${base}/sitemap.xml`));
  const r = await fetch(base + '/sitemap.xml');
  assert.match(r.headers.get('content-type'), /xml/);
  assert.match(await r.text(), new RegExp(`<loc>${base}/privacy</loc>`));
  const html = await (await fetch(base + '/')).text();
  assert.match(html, new RegExp(`<link rel="canonical" href="${base}/">`));
  assert.match(html, new RegExp(`og:image" content="${base}/assets/img/og.jpg"`));
});

test('with PUBLIC_URL set, pages on other hosts redirect there; the API does not', async () => {
  process.env.PUBLIC_URL = 'https://govverdict.example';
  const srv = createApp({store, paddle: fakePaddle}).listen(0);
  await new Promise(r => srv.once('listening', r));
  const b = `http://127.0.0.1:${srv.address().port}`;
  try {
    for (const p of ['/', '/privacy?x=1', '/robots.txt']) {
      const r = await fetch(b + p, {redirect: 'manual'});
      assert.equal(r.status, 301, p);
      assert.equal(r.headers.get('location'), 'https://govverdict.example' + p);
    }
    assert.equal((await fetch(b + `/v1/me?installId=${INSTALL}`, {headers: {origin: ORIGIN}})).status, 200);
    assert.equal((await fetch(b + '/assets/img/og.jpg')).status, 200);
    assert.equal((await fetch(b + '/health')).status, 200);
    const sameHost = await new Promise((resolve, reject) => http.get({port: srv.address().port, path: '/', headers: {host: 'govverdict.example'}}, r => { r.resume(); resolve(r.statusCode); }).on('error', reject));
    assert.equal(sameHost, 200);
  } finally {
    delete process.env.PUBLIC_URL;
    srv.close();
  }
});

test('public pages render', async () => {
  for (const p of ['/', '/privacy', '/support', '/terms', '/refunds']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /GovVerdict/);
    if (p === "/privacy") for (const cat of ["Website content", "Location", "Personally identifiable information", "Financial and payment information", "Limited Use"]) assert.ok((await (await fetch(base + p)).text()).includes(cat), cat);
  }
  assert.equal((await fetch(base + '/thanks?txn=bad')).status, 400);
  const co = await fetch(base + `/checkout?installId=${INSTALL}`);
  assert.equal(co.status, 200);
  const html = await co.text();
  assert.match(html, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
  assert.match(html, /pri_test/);
  assert.equal((await fetch(base + '/checkout?installId=nope')).status, 400);
});
