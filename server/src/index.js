import crypto from 'node:crypto';
import express from 'express';
import {computeChecks, normaliseProfile} from './rules.js';
import {analyze} from './analyze.js';
import {makeStore, tryConsume, release} from './store.js';
import {activateLicense, planFor} from './billing.js';
import {makePaddle, handlePaddleEvent, licenseFromTransaction} from './paddle.js';
import {privacyPage, supportPage, termsPage, refundsPage, checkoutPage, thanksPage} from './pages.js';
import {landingPage} from './landing.js';

const LIMITS = {
  free: Number(process.env.FREE_DAILY_LIMIT || 5),
  pro: Number(process.env.PRO_DAILY_LIMIT || 60),
  freePerIp: Number(process.env.FREE_DAILY_LIMIT_PER_IP || 25)
};
const MODELS = {
  free: process.env.MODEL_FREE || 'gemini-3.5-flash-lite',
  pro: process.env.MODEL_PRO || 'gemini-3.8-flash'
};
const MAX_FILES = 6;
const MAX_FILE_BYTES = 7 * 1024 * 1024; // Gemini inline-file ceiling
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MIME_OK = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTICE_ID = /^[0-9a-f]{32}$/i;

export function createApp({store = makeStore(), paddle = makePaddle()} = {}) {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  const allowed = (process.env.ALLOWED_EXTENSION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const devAnyOrigin = process.env.DEV_ALLOW_ANY_ORIGIN === '1';
  const ipHash = req => crypto.createHash('sha256').update(String(req.ip) + (process.env.IP_SALT || 'bidverdict')).digest('hex').slice(0, 20);
  const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const log = (msg, extra = {}) => console.log(JSON.stringify({severity: 'INFO', message: msg, ...extra}));

  // Paddle signs the raw body, so this route comes before express.json().
  app.post('/paddle/webhook', express.raw({type: '*/*', limit: '1mb'}), async (req, res) => {
    if (!paddle) return res.status(404).end();
    if (!paddle.verify(req.body, req.get('paddle-signature'))) return res.status(400).send('Bad signature');
    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Bad JSON'); }
    try {
      const outcome = await handlePaddleEvent(store, paddle, event);
      log('paddle event', {type: event.event_type, id: event.event_id, outcome});
      res.json({received: true});
    } catch (e) {
      console.error(JSON.stringify({severity: 'ERROR', message: 'paddle event failed', type: event.event_type, error: String(e && e.message || e)}));
      res.status(500).json({received: false}); // Paddle retries
    }
  });

  app.use('/assets', express.static(new URL('../public', import.meta.url).pathname, {maxAge: '1d', fallthrough: false}));
  app.get('/', (req, res) => res.type('html').send(landingPage()));
  app.get('/privacy', (req, res) => res.type('html').send(privacyPage()));
  app.get('/support', (req, res) => res.type('html').send(supportPage()));
  app.get('/health', (req, res) => res.json({ok: true, store: store.kind, mock: process.env.MOCK_AI === '1'}));
  app.get('/terms', (req, res) => res.type('html').send(termsPage()));
  app.get('/refunds', (req, res) => res.type('html').send(refundsPage()));
  app.get('/checkout', (req, res) => {
    const installId = String(req.query.installId || '');
    if (!paddle) return res.status(404).type('html').send(thanksPage({error: 'Pro isn’t available yet.'}));
    if (!UUID.test(installId)) return res.status(400).type('html').send(thanksPage({error: 'Open checkout from the Account tab in the BidVerdict extension.'}));
    res.type('html').send(checkoutPage({installId: installId.toLowerCase(), clientToken: paddle.clientToken, priceId: paddle.priceId, sandbox: paddle.mode === 'sandbox'}));
  });
  app.get('/thanks', async (req, res) => {
    const id = String(req.query.txn || '');
    if (!paddle || !/^txn_[a-z0-9]+$/i.test(id)) return res.status(400).type('html').send(thanksPage({error: 'This link is missing its payment reference.'}));
    try {
      const txn = await paddle.getTransaction(id);
      const key = await licenseFromTransaction(store, paddle, txn);
      res.type('html').send(thanksPage({key, pending: !key}));
    } catch (e) {
      res.status(500).type('html').send(thanksPage({error: 'We couldn’t look up that payment yet.', pending: true}));
    }
  });

  // API for the extension: CORS limited to chrome-extension:// origins (optionally to our published ID).
  app.use('/v1', (req, res, next) => {
    const origin = req.get('origin') || '';
    const m = origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
    const ok = devAnyOrigin || (m && (!allowed.length || allowed.includes(m[1])));
    if (!ok) return res.status(403).json({error: 'forbidden', message: 'This API only serves the BidVerdict extension.'});
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
    res.set('Access-Control-Allow-Headers', 'content-type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use('/v1', express.json({limit: '20mb'}));

  const baseUrl = req => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  async function account(installId, base) {
    const plan = await planFor(store, installId);
    const usage = await store.get('usage', `in_${installId}_${day()}`);
    return {
      plan,
      used: usage ? usage.count : 0,
      limit: LIMITS[plan],
      checkoutUrl: paddle && plan === 'free' ? `${base}/checkout?installId=${installId}` : null,
      portalUrl: paddle ? paddle.portalUrl : null,
      priceLabel: process.env.PRO_PRICE_LABEL || '$14 a month',
      proLimit: LIMITS.pro
    };
  }

  app.get('/v1/me', async (req, res) => {
    const installId = String(req.query.installId || '');
    if (!UUID.test(installId)) return res.status(400).json({error: 'bad_request', message: 'Missing install ID.'});
    res.json(await account(installId, baseUrl(req)));
  });

  app.post('/v1/license', async (req, res) => {
    const {installId, key} = req.body || {};
    if (!UUID.test(String(installId)) || !/^BV(-[A-Z0-9]{4}){4}$/.test(String(key || '').trim().toUpperCase())) {
      return res.status(400).json({error: 'bad_request', message: 'That doesn’t look like a BidVerdict licence key.'});
    }
    const r = await activateLicense(store, installId, String(key).trim().toUpperCase());
    if (!r.ok) return res.status(400).json({error: 'license', message: r.error});
    res.json(await account(installId, baseUrl(req)));
  });

  app.post('/v1/analyze', async (req, res) => {
    const started = Date.now();
    const {installId, notice, profile: rawProfile, files = [], pasted = ''} = req.body || {};
    if (!UUID.test(String(installId)) || !notice || !NOTICE_ID.test(String(notice.id))) {
      return res.status(400).json({error: 'bad_request', message: 'Open a SAM.gov contract opportunity first.'});
    }
    if (!Array.isArray(files) || files.length > MAX_FILES) return res.status(400).json({error: 'bad_request', message: `Choose at most ${MAX_FILES} attachments.`});

    let total = 0;
    const decoded = [];
    for (const f of files) {
      if (!f || !MIME_OK.has(f.mime) || typeof f.data !== 'string') return res.status(400).json({error: 'bad_request', message: `Unsupported file: ${String(f && f.name).slice(0, 80)}`});
      const buf = Buffer.from(f.data, 'base64');
      if (buf.length > MAX_FILE_BYTES) return res.status(413).json({error: 'too_large', message: `${String(f.name).slice(0, 80)} is over 7 MB.`});
      total += buf.length;
      decoded.push({name: String(f.name || 'attachment').slice(0, 160), mime: f.mime, data: buf});
    }
    if (total > MAX_TOTAL_BYTES) return res.status(413).json({error: 'too_large', message: 'Selected attachments are over 12 MB in total. Untick some.'});

    const plan = await planFor(store, installId);
    const usageId = `in_${installId}_${day()}`;
    const ipId = `ip_${ipHash(req)}_${day()}`;
    const mine = await tryConsume(store, usageId, LIMITS[plan]);
    if (!mine.ok) return res.status(429).json({error: 'quota', message: plan === 'pro' ? 'You’ve reached today’s Pro limit. It resets at midnight UTC.' : `You’ve used today’s ${LIMITS.free} free analyses. Upgrade to Pro, or come back tomorrow.`, account: await account(installId, baseUrl(req))});
    if (plan === 'free') {
      const ip = await tryConsume(store, ipId, LIMITS.freePerIp);
      if (!ip.ok) { await release(store, usageId); return res.status(429).json({error: 'quota', message: 'Too many free analyses from this network today.', account: await account(installId, baseUrl(req))}); }
    }

    const profile = normaliseProfile(rawProfile);
    const cleanNotice = {
      id: notice.id, url: String(notice.url || '').slice(0, 300), title: String(notice.title || '').slice(0, 300),
      solicitationNumber: String(notice.solicitationNumber || '').slice(0, 80), type: notice.type, typeLabel: notice.typeLabel,
      setAside: notice.setAside || null, setAsideLabel: notice.setAsideLabel || null,
      deadline: notice.deadline || null, deadlineTz: notice.deadlineTz || null,
      naics: (notice.naics || []).map(String).slice(0, 10), psc: String(notice.psc || '').slice(0, 20),
      place: notice.place || null, agency: String(notice.agency || '').slice(0, 300),
      description: String(notice.description || '').slice(0, 40000)
    };
    const checks = computeChecks(cleanNotice, profile);

    try {
      const {result, skipped, usage} = await analyze({notice: cleanNotice, profile, checks, files: decoded, pasted: String(pasted || ''), model: MODELS[plan]});
      log('analysis', {notice: notice.id, plan, files: decoded.length, bytes: total, ms: Date.now() - started, verdict: result.verdict, tokens: usage});
      res.json({result, checks, skipped, model: process.env.MOCK_AI === '1' ? 'mock' : MODELS[plan], account: await account(installId, baseUrl(req))});
    } catch (e) {
      await release(store, usageId);
      console.error(JSON.stringify({severity: 'ERROR', message: 'analysis failed', notice: notice.id, error: String(e && e.message || e).slice(0, 500)}));
      res.status(502).json({error: 'ai', message: 'The analysis service didn’t answer. This didn’t count against your limit; try again in a minute.'});
    }
  });

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({error: 'too_large', message: 'Request too large. Untick some attachments.'});
    const status = err && (err.status || err.statusCode);
    if (status >= 400 && status < 500) return res.status(status).type('text').send(status === 404 ? 'Not found' : 'Bad request');
    console.error(JSON.stringify({severity: 'ERROR', message: String(err && err.message || err)}));
    res.status(500).json({error: 'server', message: 'Something went wrong on our side.'});
  });

  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const port = Number(process.env.PORT || 8080);
  createApp().listen(port, () => console.log(`BidVerdict API on :${port} (store=${process.env.STORE || 'firestore'}, mock=${process.env.MOCK_AI === '1'})`));
}
