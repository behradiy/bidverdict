// Public pages served by the API: landing page, privacy policy, post-checkout page.
// The Chrome Web Store listing links to /privacy.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function cfg() {
  return {
    name: 'GovVerdict',
    operator: process.env.OPERATOR_NAME || 'The GovVerdict team',
    email: process.env.SUPPORT_EMAIL || 'support@example.com',
    store: process.env.CHROME_STORE_URL || '',
    price: process.env.PRO_PRICE_LABEL || '$14 a month',
    freeLimit: process.env.FREE_DAILY_LIMIT || '5',
    proLimit: process.env.PRO_DAILY_LIMIT || '60',
    paddleOn: !!(process.env.PADDLE_API_KEY && process.env.PADDLE_CLIENT_TOKEN && process.env.PADDLE_PRICE_ID)
  };
}

const CSS = `
:root{--bg:#F6F7F9;--card:#FFFFFF;--ink:#0F1B2D;--muted:#5A6577;--line:#DDE2E9;--brand:#13294B;--go:#15803D;--warn:#B45309;--stop:#B91C1C}
@media (prefers-color-scheme:dark){:root{--bg:#0B1220;--card:#121B2C;--ink:#E6EBF2;--muted:#9AA6B8;--line:#24324A;--brand:#8FB3FF;--go:#4ADE80;--warn:#FBBF24;--stop:#F87171;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:48px 20px 64px}a{color:var(--brand)}
h1{font-size:clamp(30px,6vw,44px);line-height:1.1;margin:0 0 14px;letter-spacing:-.02em}h2{font-size:22px;margin:36px 0 10px}h3{font-size:17px;margin:22px 0 6px}
.lede{font-size:19px;color:var(--muted);max-width:60ch}.tag{display:inline-block;font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.btn{display:inline-block;background:var(--brand);color:var(--bg);text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px;margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.card b{display:block;margin-bottom:4px}.muted{color:var(--muted)}.small{font-size:14px}
.v{display:inline-block;font-weight:700;padding:2px 10px;border-radius:999px;font-size:14px}
.v.go{background:color-mix(in srgb,var(--go) 15%,transparent);color:var(--go)}.v.warn{background:color-mix(in srgb,var(--warn) 15%,transparent);color:var(--warn)}.v.stop{background:color-mix(in srgb,var(--stop) 15%,transparent);color:var(--stop)}
.key{font:600 22px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.04em;background:var(--card);border:1px dashed var(--brand);border-radius:10px;padding:14px 16px;margin:14px 0;word-break:break-all}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
ul{padding-left:20px}li{margin:4px 0}
.tbl{overflow-x:auto;margin:12px 0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:14.5px;min-width:620px}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
th{font:600 12px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}tr:last-child td{border-bottom:0}`;

function page(title, body) {
  const c = cfg();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head><body><div class="wrap">${body}
<footer>${esc(c.name)} is an independent tool, not affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency. It gives decision support, not legal or contracting advice. · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refunds">Refunds</a> · <a href="/support">Support</a></footer>
</div></body></html>`;
}

export function privacyPage() {
  const c = cfg();
  return page('GovVerdict privacy policy', `
<span class="tag">Effective 11 October 2026</span>
<h1>Privacy policy</h1>
<p class="lede">GovVerdict helps you decide whether to bid on U.S. federal contract opportunities. This policy explains what the extension and its server collect, why, and for how long.</p>
<p>GovVerdict is operated by ${esc(c.operator)}. Contact: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>.</p>

<h2>Data we collect</h2>
<p>These are the same categories declared in our Chrome Web Store listing.</p>
<div class="tbl"><table>
<thead><tr><th>Category</th><th>What exactly</th><th>Why</th><th>How long we keep it</th></tr></thead>
<tbody>
<tr><td><b>Website content</b></td><td>The public data of the SAM.gov contract opportunity you analyse, the attachments you select, and any text you paste. Your company profile is sent along with it.</td><td>To produce the bid/no-bid analysis you asked for.</td><td>Not stored. Discarded as soon as the analysis is returned.</td></tr>
<tr><td><b>Location</b></td><td>Your IP address, which our server sees with every request. We store only a one-way hash of it, never the address itself.</td><td>To enforce the daily free limit and prevent abuse.</td><td>Deleted automatically after about 3 days.</td></tr>
<tr><td><b>Personally identifiable information</b></td><td>Pro only: the email address you enter at checkout, which Paddle passes to us.</td><td>To link your licence to you, support your account and handle refunds.</td><td>While your subscription is active, and afterwards until you ask us to delete it.</td></tr>
<tr><td><b>Financial and payment information</b></td><td>Pro only: your Paddle customer and subscription IDs and your subscription status. Paddle processes the payment; we never see or store card numbers.</td><td>To know whether Pro is active.</td><td>As for your email, except where law requires us to keep transaction records longer.</td></tr>
</tbody></table></div>
<p>We also create a random <b>install ID</b> in your browser. It identifies the installation, not you, and is used to count daily usage and to link a Pro licence to the browsers you activate.</p>
<p>We do not collect health information, authentication information such as passwords, personal communications, web history or user activity.</p>

<h2>What stays in your browser</h2>
<ul>
<li><b>Your company profile</b> (NAICS codes, certifications, service states, capabilities, past performance) is stored in Chrome’s sync storage. It is sent with each analysis and not stored on our servers.</li>
<li><b>Your recent analyses and checklist ticks</b> are stored locally in Chrome and never leave your device except as part of a new analysis.</li>
</ul>

<h2>When the extension reads pages</h2>
<p>GovVerdict only reads from sam.gov and SAM.gov’s public attachment storage, and only when you open the side panel on a contract opportunity. It does not read or record any other website.</p>

<h2>Who processes your data</h2>
<ul>
<li><b>Google Cloud</b> hosts our server and database. Analyses run on Google’s Gemini models through Google Cloud’s paid service; under Google Cloud’s terms, this content is not used to train Google’s models.</li>
<li><b>Paddle.com</b> is the merchant of record for Pro: it processes payments, handles sales tax and VAT, and acts under its own privacy policy.</li>
</ul>
<p>We don’t sell or rent your data, and we don’t share it with anyone else.</p>

<h2>Limited Use</h2>
<p>The use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. We don’t use or transfer your data for purposes unrelated to GovVerdict’s single purpose of analysing contract opportunities for bid/no-bid decisions, we don’t use it for advertising, and we don’t use it to determine creditworthiness or for lending.</p>

<h2>Your choices</h2>
<ul>
<li>Clear your profile any time from the extension’s Profile tab, or remove the extension to delete everything stored in your browser.</li>
<li>To delete your licence and payment records, email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> from the address you paid with. We delete them within 30 days, except records the law requires us to keep.</li>
</ul>

<h2>Changes</h2>
<p>If this policy changes in a way that affects what we collect, we’ll update this page and the date above, and show a notice in the extension.</p>`);
}

export function supportPage() {
  const c = cfg();
  const subject = encodeURIComponent('GovVerdict support');
  return page('GovVerdict support', `
<span class="tag">Support</span>
<h1>Get help with GovVerdict</h1>
<p class="lede">Email us and a real person replies, usually within one business day.</p>
<div class="card" style="margin-top:18px">
  <b>Email</b>
  <div class="key" style="font-size:19px;margin:8px 0">${esc(c.email)}</div>
  <a class="btn" style="margin-top:4px" href="mailto:${esc(c.email)}?subject=${subject}">Email us</a>
  <p class="muted small" style="margin-top:10px">If the button doesn’t open your email app, copy the address above. To help us help you, include the SAM.gov notice link and what you expected to see.</p>
</div>

<h2>Common questions</h2>
<h3>The panel says “Open a contract opportunity”.</h3>
<p>GovVerdict works on contract opportunity pages, the ones whose address looks like <span class="muted">sam.gov/opp/…/view</span>. Open one from SAM.gov search and click the GovVerdict icon.</p>
<h3>An attachment wasn’t read.</h3>
<p>GovVerdict reads PDF and Word files up to 7 MB each, 12 MB in total. Spreadsheets aren’t read yet: open them yourself, or paste the relevant part into “Add text from elsewhere”.</p>
<h3>I hit the daily limit.</h3>
<p>The free plan includes ${esc(c.freeLimit)} analyses a day. It resets at midnight UTC. Analyses that fail don’t count.</p>
<h3>The verdict looks wrong.</h3>
<p>Check your Profile tab first: NAICS codes, certifications and states drive the eligibility checks. If it still looks wrong, email us the notice link. GovVerdict gives decision support; always confirm against the solicitation.</p>
<h3>How do I delete my data?</h3>
<p>Your company profile lives in your browser; use “Clear profile” or remove the extension. For licence and payment records, email us from the address you paid with. See the <a href="/privacy">privacy policy</a>.</p>`);
}

export function thanksPage({key, error, pending}) {
  if (!key) {
    const refresh = pending ? '<script>setTimeout(function () { location.reload(); }, 6000);</script>' : '';
    return page('GovVerdict Pro', `${refresh}<h1>${pending ? 'Confirming your payment…' : 'Something’s missing'}</h1>
<p class="lede">${esc(error || (pending ? 'This usually takes a few seconds. This page refreshes on its own.' : 'We couldn’t confirm your payment.'))}</p>
<p>If it doesn’t resolve within a few minutes, email us with the receipt Paddle sent you and we’ll sort it out.</p>`);
  }
  return page('GovVerdict Pro is active', `
<span class="tag">Payment received</span>
<h1>You’re on Pro.</h1>
<p class="lede">Pro is already active in the browser you upgraded from. Close this tab and click <b>Refresh</b> in the GovVerdict Account tab.</p>
<p>Save this licence key. Paste it into the Account tab to use Pro in up to three browsers, or after reinstalling:</p>
<div class="key">${esc(key)}</div>
<p class="muted small">Paddle, our reseller, emailed you a receipt. You can cancel or update your subscription at any time from the link in that email.</p>`);
}

export function checkoutPage({installId, clientToken, priceId, sandbox}) {
  const c = cfg();
  const cfgJson = JSON.stringify({installId, clientToken, priceId, sandbox}).replace(/</g, '\\u003c');
  return page('Upgrade to GovVerdict Pro', `
<span class="tag">GovVerdict Pro${sandbox ? ' · test mode' : ''}</span>
<h1>Upgrade to Pro</h1>
<p class="lede">${esc(c.price)}: up to ${esc(c.proLimit)} analyses a day and the deeper model. Cancel any time.</p>
<p>Checkout is handled by Paddle, our reseller and merchant of record. It works out sales tax or VAT for your country.</p>
<button class="btn" id="go" type="button" style="border:0;cursor:pointer;font:inherit;font-weight:600">Open checkout</button>
<p class="muted small" id="status" style="margin-top:14px">Loading secure checkout…</p>
<p class="muted small">By upgrading you agree to the <a href="/terms">terms</a> and <a href="/refunds">refund policy</a>.</p>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
(function () {
  var C = ${cfgJson};
  var status = document.getElementById('status');
  function open() {
    Paddle.Checkout.open({items: [{priceId: C.priceId, quantity: 1}], customData: {installId: C.installId}, settings: {displayMode: 'overlay', theme: 'light'}});
  }
  try {
    if (C.sandbox) Paddle.Environment.set('sandbox');
    Paddle.Initialize({token: C.clientToken, eventCallback: function (e) {
      if (e && e.name === 'checkout.completed' && e.data && e.data.transaction_id) {
        status.textContent = 'Payment received. Activating Pro…';
        location.href = '/thanks?txn=' + encodeURIComponent(e.data.transaction_id);
      }
    }});
    status.textContent = '';
    document.getElementById('go').addEventListener('click', open);
    open();
  } catch (err) {
    status.textContent = 'Checkout couldn’t load. Turn off ad blockers for this page and reload.';
  }
})();
</script>`);
}

export function termsPage() {
  const c = cfg();
  return page('GovVerdict terms of service', `
<span class="tag">Effective 11 October 2026</span>
<h1>Terms of service</h1>
<p class="lede">These terms cover your use of the GovVerdict Chrome extension and website, operated by ${esc(c.operator)}.</p>

<h2>The service</h2>
<p>GovVerdict analyses U.S. federal contract opportunities published on SAM.gov against the company profile you enter, and gives a bid/no-bid recommendation. It is decision support. It is not legal, contracting or financial advice, and it doesn’t guarantee eligibility or an award. Always confirm requirements in the solicitation itself and with the contracting officer.</p>
<p>GovVerdict is independent and is not affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency.</p>

<h2>Plans</h2>
<ul>
<li><b>Free:</b> ${esc(c.freeLimit)} analyses a day. No account needed.</li>
<li><b>Pro:</b> ${esc(c.price)}, billed monthly until you cancel. Up to ${esc(c.proLimit)} analyses a day. A licence key can be used in up to three browsers.</li>
</ul>
<p>Daily limits reset at midnight UTC. We may change plans or prices; existing subscribers get at least 30 days’ notice before a price change applies to them.</p>

<h2>Payments</h2>
<p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</p>
<p>You can cancel at any time from the link in your Paddle receipt. Pro stays active until the end of the period you’ve paid for. Refunds follow our <a href="/refunds">refund policy</a>.</p>

<h2>Acceptable use</h2>
<ul>
<li>Don’t share licence keys beyond your own three browsers, resell access, or try to get around usage limits.</li>
<li>Don’t use automated scripts to call our service, or try to probe, overload or reverse-engineer it.</li>
<li>Use GovVerdict only on notices and documents you’re entitled to access.</li>
</ul>
<p>We may suspend access that breaks these rules.</p>

<h2>Disclaimer and liability</h2>
<p>GovVerdict is provided “as is”. Analyses are produced by AI from public documents and can be wrong or incomplete. To the extent the law allows, we aren’t liable for indirect or consequential losses, including lost contracts or profits, and our total liability is limited to the amount you paid us in the 12 months before the claim.</p>

<h2>Changes and contact</h2>
<p>We may update these terms and will change the date above when we do. Questions: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>.</p>`);
}

export function refundsPage() {
  const c = cfg();
  return page('GovVerdict refund policy', `
<span class="tag">Effective 11 October 2026</span>
<h1>Refund policy</h1>
<p class="lede">If GovVerdict Pro isn’t right for you, ask within 14 days of a payment and you’ll get that payment back in full.</p>
<ul>
<li>This applies to your first payment and to any monthly renewal, as long as you ask within 14 days of that payment.</li>
<li>Refunds go back to your original payment method. They are processed by Paddle, our reseller and merchant of record, and usually arrive within 5–10 business days.</li>
<li>A refund also cancels the subscription, so Pro switches off and you won’t be charged again.</li>
</ul>
<h2>How to ask</h2>
<p>Reply to your Paddle receipt, or email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> from the address you paid with. No reason needed.</p>
<h2>Cancelling</h2>
<p>To stop future payments, cancel from the link in your Paddle receipt. Pro stays active until the end of the period you’ve paid for.</p>`);
}
