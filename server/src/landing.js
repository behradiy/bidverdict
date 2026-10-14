// The marketing landing page: hero with the demo video, the Chrome Web Store
// screenshots and listing copy, pricing, privacy summary and FAQ.
import {cfg, esc} from './pages.js';

const FEATURES = [
  {n: 1, h: 'Bid or no-bid, in about a minute.', p: 'Open any contract opportunity on SAM.gov. GovVerdict reads the notice and its attachments and checks them against your company.',
    li: ['A clear verdict with a fit score', 'Set-aside, NAICS, deadline and location checked against SAM.gov data', 'Reasons you can act on']},
  {n: 2, h: 'Know exactly what the offer needs.', p: 'A compliance checklist pulled from the solicitation, the statement of work and the latest amendments.',
    li: ['Forms, page limits, references, pricing sheets', 'How offers will be judged', 'Questions to send the contracting officer']},
  {n: 3, h: 'Stop chasing contracts you can’t win.', p: 'Hard eligibility rules run before the AI does, so a set-aside you don’t qualify for is a no-bid every time.',
    li: ['8(a), HUBZone, SDVOSB, WOSB and more', 'Sole-source and closed notices flagged', 'Deadlines counted in the agency’s time zone']},
  {n: 4, h: 'Reads the attachments, not just the summary.', p: 'Picks the newest version of each document and the latest amendments. You can change the selection.',
    li: ['PDF and Word documents', 'Old versions and superseded amendments skipped', 'Paste in anything else, like Q&A answers']},
  {n: 5, h: 'Set up your company once.', p: 'NAICS codes, certifications, service area and past performance. Stored in your Chrome profile, not on our servers.',
    li: ['Every analysis is checked against your profile', 'Free: 5 analyses a day', 'No account needed']}
];

const ANALYSIS = [
  ['Verdict', 'Bid, Consider, No-bid, or Respond for sources sought and presolicitations.'],
  ['Fit score', 'From 0 to 100, with the reasons behind it.'],
  ['Eligibility checks', 'Set-aside, NAICS match, response deadline and place of performance, from SAM.gov data.'],
  ['Key facts', 'Contract type, period of performance, incumbent, site visit, wage determination.'],
  ['Offer checklist', 'What the offer must include, with the document each item came from.'],
  ['Evaluation and risks', 'How offers will be judged, red flags, and questions for the contracting officer.'],
  ['One-click summary', 'Paste it into an email or your pipeline tracker.']
];

const FAQ = [
  ['Which pages does it work on?', 'Contract opportunity pages on SAM.gov, the ones whose address looks like sam.gov/opp/…/view. On any other page the panel asks you to open one.'],
  ['Which attachments can it read?', 'PDF and Word files up to 7 MB each and 12 MB in total. Spreadsheets aren’t read yet; paste the part you need into “Add text from elsewhere”.'],
  ['Is my company profile uploaded?', 'It’s stored in your Chrome profile and sent with each analysis, then discarded. We don’t keep it on our servers.'],
  ['Can I trust the verdict?', 'Eligibility rules (set-aside, deadline, sole source) are checked deterministically and always win. The rest is AI analysis of the documents, so treat it as decision support and confirm in the solicitation.'],
  ['Is this an official government tool?', 'No. GovVerdict is independent and isn’t affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency.']
];

const CSS = `
:root{--bg:#F6F7F9;--card:#FFFFFF;--ink:#0F1B2D;--muted:#566275;--line:#DDE2E9;--soft:#EEF1F5;--brand:#13294B;--brand-ink:#FFFFFF;--accent:#2563EB;--go:#15803D;--warn:#B45309;--stop:#B91C1C;--info:#1D4ED8;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0B1220;--card:#111A2B;--ink:#E6EBF2;--muted:#9AA6B8;--line:#24324A;--soft:#16213A;--brand:#9DB8FF;--brand-ink:#0B1220;--accent:#8FB3FF;--go:#4ADE80;--warn:#FBBF24;--stop:#F87171;--info:#93B4FF;color-scheme:dark}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:72px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}img,video{max-width:100%;display:block}img{height:auto}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.wrap{max-width:1120px;margin:0 auto;padding-inline:20px}
h1,h2,h3{line-height:1.12;margin:0;letter-spacing:-.02em;text-wrap:balance}
.eyebrow{font:600 12.5px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:8px;font-weight:650;font-size:16px;text-decoration:none;padding:12px 20px;border-radius:10px;border:1px solid transparent;cursor:pointer}
.btn.primary{background:var(--brand);color:var(--brand-ink)}.btn.primary:hover{filter:brightness(1.1)}
.btn.ghost{border-color:var(--line);color:var(--ink);background:var(--card)}.btn.ghost:hover{border-color:var(--brand)}
.btn.pending{background:var(--soft);color:var(--muted);cursor:default}
nav.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
nav.top .wrap{display:flex;align-items:center;gap:22px;height:62px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.logo img{width:30px;height:30px}
.links{display:flex;gap:20px;margin-left:auto;font-size:15px}.links a{color:var(--muted);text-decoration:none}.links a:hover{color:var(--ink)}
nav.top .btn{padding:8px 14px;font-size:14.5px}
@media (max-width:760px){.links{display:none}nav.top .btn{margin-left:auto}}
.hero{padding-block:64px 28px;text-align:center}
.hero h1{font-size:clamp(38px,6.4vw,66px);font-weight:850;max-width:16ch;margin:14px auto 0}
.hero .lede{font-size:clamp(18px,2.2vw,21px);color:var(--muted);max-width:60ch;margin:18px auto 0}
.cta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:28px}
.trust{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;margin-top:18px;font-size:14px;color:var(--muted)}
.trust span::before{content:"✓ ";color:var(--go);font-weight:700}
.video{position:relative;margin:40px auto 0;max-width:1040px;border-radius:16px;overflow:hidden;border:1px solid var(--line);box-shadow:0 30px 70px rgba(15,27,45,.18);background:#13294B;aspect-ratio:16/9}
.video video{width:100%;height:100%;object-fit:cover}
.vbtn{position:absolute;right:14px;bottom:14px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(15,27,45,.72);color:#fff;display:grid;place-items:center;cursor:pointer}
.vbtn svg{width:16px;height:16px}
section.band{padding-block:72px}
.head{max-width:62ch;margin-bottom:34px}.head h2{font-size:clamp(28px,3.6vw,40px);font-weight:800;margin-top:10px}.head p{color:var(--muted);margin:12px 0 0}
.verdicts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.verdicts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.verdicts{grid-template-columns:minmax(0,1fr)}}
.v{background:var(--card);border:1px solid var(--line);border-top:4px solid;border-radius:12px;padding:18px}
.v b{font-size:20px;display:block}.v p{margin:6px 0 0;font-size:15px;color:var(--muted)}
.v.go{border-top-color:var(--go)}.v.go b{color:var(--go)}.v.warn{border-top-color:var(--warn)}.v.warn b{color:var(--warn)}
.v.stop{border-top-color:var(--stop)}.v.stop b{color:var(--stop)}.v.info{border-top-color:var(--info)}.v.info b{color:var(--info)}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;counter-reset:s}
@media (max-width:800px){.steps{grid-template-columns:minmax(0,1fr)}}
.step{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px;counter-increment:s}
.step::before{content:counter(s);display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--brand);color:var(--brand-ink);font-weight:800;margin-bottom:12px}
.step h3{font-size:19px}.step p{margin:8px 0 0;color:var(--muted);font-size:15.5px}
.feature{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:44px;align-items:center;padding-block:34px}
.feature:nth-child(even){grid-template-columns:minmax(0,7fr) minmax(0,5fr)}.feature:nth-child(even) .copy{order:2}
@media (max-width:860px){.feature,.feature:nth-child(even){grid-template-columns:minmax(0,1fr);gap:20px}.feature:nth-child(even) .copy{order:0}}
.feature h3{font-size:clamp(24px,2.8vw,32px);font-weight:800}.feature p{color:var(--muted);margin:12px 0 0}
.feature ul{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:8px}.feature li{display:flex;gap:10px;font-size:16px}
.feature li::before{content:"";flex:none;width:9px;height:9px;border-radius:50%;background:var(--go);margin-top:9px}
.shot{border-radius:12px;overflow:hidden;border:1px solid var(--line);box-shadow:0 18px 44px rgba(15,27,45,.14);background:var(--card)}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media (max-width:700px){.grid2{grid-template-columns:minmax(0,1fr)}}
.item{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}.item b{display:block}.item span{color:var(--muted);font-size:15px}
.pricing{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;max-width:820px}@media (max-width:700px){.pricing{grid-template-columns:minmax(0,1fr)}}
.plan{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px;display:flex;flex-direction:column;gap:10px}
.plan.pro{border:2px solid var(--brand)}.plan .price{font-size:40px;font-weight:850;letter-spacing:-.02em}.plan .price small{font-size:16px;font-weight:500;color:var(--muted)}
.plan ul{list-style:none;padding:0;margin:4px 0 0;display:grid;gap:8px;font-size:15.5px}.plan li::before{content:"✓  ";color:var(--go);font-weight:700}
.plan .note{font-size:13.5px;color:var(--muted);margin-top:auto}
.privacy{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}@media (max-width:900px){.privacy{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.privacy{grid-template-columns:minmax(0,1fr)}}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}details+details{margin-top:10px}
summary{cursor:pointer;font-weight:650}details p{margin:10px 0 0;color:var(--muted)}
.final{background:var(--brand);color:var(--brand-ink);border-radius:20px;padding:48px 28px;text-align:center}
.final h2{font-size:clamp(28px,3.6vw,40px);font-weight:850}.final p{opacity:.85;margin:12px auto 0;max-width:52ch}
.final .btn{background:var(--brand-ink);color:var(--brand);margin-top:24px}
footer{padding-block:36px 56px;color:var(--muted);font-size:14px}footer .wrap{display:flex;flex-wrap:wrap;gap:10px 24px;align-items:center}
footer nav{display:flex;flex-wrap:wrap;gap:16px}footer nav a{color:var(--muted)}footer p{flex-basis:100%;margin:6px 0 0;max-width:90ch}`;

export function landingPage(base = '') {
  const c = cfg();
  const store = c.store;
  const cta = store
    ? `<a class="btn primary" href="${esc(store)}">Add to Chrome, it’s free</a>`
    : `<span class="btn pending" aria-disabled="true">In review on the Chrome Web Store</span>`;
  const smallCta = store ? `<a class="btn primary" href="${esc(store)}">Add to Chrome</a>` : `<a class="btn primary" href="#pricing">Free during launch</a>`;
  const title = 'GovVerdict: bid or no-bid on SAM.gov opportunities';
  const desc = 'A Chrome extension that reads SAM.gov contract opportunities and their attachments, checks your eligibility and fit, and gives a clear bid/no-bid verdict in about a minute.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}/"><meta property="og:url" content="${esc(base)}/">
<meta property="og:image" content="${esc(base)}/assets/img/og.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/assets/img/icon32.png">
<style>${CSS}</style></head><body>
<nav class="top" aria-label="Main"><div class="wrap">
  <a class="logo" href="/"><img src="/assets/img/icon128.png" alt="">GovVerdict</a>
  <div class="links"><a href="#how">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
  ${smallCta}
</div></nav>

<header class="hero wrap">
  <span class="eyebrow">Chrome extension for small federal contractors</span>
  <h1>Bid or no-bid, in about a minute.</h1>
  <p class="lede">Open any contract opportunity on SAM.gov. GovVerdict reads the notice and its attachments, checks them against your company profile, and gives you a clear verdict with the reasons.</p>
  <div class="cta">${cta}<a class="btn ghost" href="#how">See how it works</a></div>
  <div class="trust"><span>${esc(c.freeLimit)} free analyses a day</span><span>No account needed</span><span>Reads PDFs and Word files</span></div>
  <div class="video">
    <video id="demo" autoplay muted loop playsinline preload="metadata" poster="/assets/media/demo-poster.jpg" aria-label="Demo: GovVerdict analysing a SAM.gov notice, showing a Bid verdict, the offer checklist, and a No-bid for an ineligible set-aside">
      <source src="/assets/media/demo.webm" type="video/webm">
      <source src="/assets/media/demo.mp4" type="video/mp4">
    </video>
    <button class="vbtn" id="vbtn" type="button" aria-label="Pause demo"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg></button>
  </div>
</header>

<section class="band wrap" aria-labelledby="verdicts-h">
  <div class="head"><span class="eyebrow">Four possible answers</span><h2 id="verdicts-h">A verdict you can act on</h2></div>
  <div class="verdicts">
    <div class="v go"><b>Bid</b><p>Eligible, strong fit, and enough time to respond.</p></div>
    <div class="v warn"><b>Consider</b><p>Eligible, but with gaps or risks to resolve first.</p></div>
    <div class="v stop"><b>No-bid</b><p>Ineligible, missing a mandatory qualification, or a poor fit.</p></div>
    <div class="v info"><b>Respond</b><p>Sources sought or presolicitation: send a capability statement, not a proposal.</p></div>
  </div>
</section>

<section class="band wrap" id="how" aria-labelledby="how-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">How it works</span><h2 id="how-h">Three steps, about a minute</h2></div>
  <div class="steps">
    <div class="step"><h3>Set up your company once</h3><p>NAICS codes, certifications, the states you work in, capabilities and past performance. Stored in your Chrome profile.</p></div>
    <div class="step"><h3>Open a SAM.gov opportunity</h3><p>GovVerdict picks up the notice in the side panel and pre-selects the attachments worth reading.</p></div>
    <div class="step"><h3>Click Analyze</h3><p>Get the verdict, a fit score, the offer checklist, red flags and questions for the contracting officer.</p></div>
  </div>
</section>

<section class="band wrap" id="features" aria-labelledby="features-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">Features</span><h2 id="features-h">Built for the bid/no-bid call</h2></div>
  <div>${FEATURES.map(f => `
    <article class="feature">
      <div class="copy"><h3>${esc(f.h)}</h3><p>${esc(f.p)}</p><ul>${f.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="shot"><img src="/assets/img/screenshot-${f.n}.webp" srcset="/assets/img/screenshot-${f.n}-640.webp 640w, /assets/img/screenshot-${f.n}.webp 1280w" sizes="(max-width: 860px) 100vw, 640px" width="1280" height="800" loading="lazy" alt="${esc(f.h)} GovVerdict side panel screenshot"></div>
    </article>`).join('')}
  </div>
</section>

<section class="band wrap" aria-labelledby="analysis-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">In every analysis</span><h2 id="analysis-h">Everything you need to decide</h2></div>
  <div class="grid2">${ANALYSIS.map(([b, t]) => `<div class="item"><b>${esc(b)}</b><span>${esc(t)}</span></div>`).join('')}</div>
</section>

<section class="band wrap" id="pricing" aria-labelledby="pricing-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">Pricing</span><h2 id="pricing-h">Start free</h2></div>
  <div class="pricing">
    <div class="plan"><span class="eyebrow">Free</span><div class="price">$0</div>
      <ul><li>${esc(c.freeLimit)} analyses a day</li><li>All checks and the full analysis</li><li>No account or card needed</li></ul></div>
    <div class="plan pro"><span class="eyebrow">Pro</span><div class="price">${esc(c.price.replace(' a month', ''))} <small>a month</small></div>
      <ul><li>Up to ${esc(c.proLimit)} analyses a day</li><li>Deeper model for long solicitations</li><li>Use on up to three browsers</li><li>Cancel any time</li></ul>
      <p class="note">${c.paddleOn ? 'Upgrade from the Account tab in the extension. Payments are handled by Paddle, our reseller.' : 'Coming soon. Upgrades will be available from the Account tab in the extension.'}</p></div>
  </div>
</section>

<section class="band wrap" aria-labelledby="privacy-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">Privacy</span><h2 id="privacy-h">Only what the analysis needs</h2><p>GovVerdict only runs on sam.gov. Here is everything we collect; the <a href="/privacy">privacy policy</a> has the details.</p></div>
  <div class="privacy">
    <div class="item"><b>Website content</b><span>The notice and attachments you analyse. Not stored after the analysis.</span></div>
    <div class="item"><b>Location</b><span>A one-way hash of your IP address for the daily limit. Deleted after about 3 days.</span></div>
    <div class="item"><b>Personal information</b><span>Pro only: your checkout email, to link your licence.</span></div>
    <div class="item"><b>Payment information</b><span>Pro only: subscription status. We never see card numbers.</span></div>
  </div>
</section>

<section class="band wrap" id="faq" aria-labelledby="faq-h" style="padding-top:0">
  <div class="head"><span class="eyebrow">FAQ</span><h2 id="faq-h">Questions</h2></div>
  ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
  <p style="margin-top:18px;color:var(--muted)">More answers on the <a href="/support">support page</a>.</p>
</section>

<section class="wrap" style="padding-bottom:24px">
  <div class="final"><h2>Stop reading solicitations you can’t win.</h2><p>Let GovVerdict read the notice and attachments first, and spend your time on the bids worth writing.</p>
  ${store ? `<a class="btn" href="${esc(store)}">Add to Chrome, it’s free</a>` : `<span class="btn" aria-disabled="true">Coming soon to the Chrome Web Store</span>`}</div>
</section>

<footer><div class="wrap">
  <a class="logo" href="/"><img src="/assets/img/icon128.png" alt="" style="width:24px;height:24px">GovVerdict</a>
  <nav aria-label="Legal"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a><a href="/support">Support</a></nav>
  <p>GovVerdict is an independent tool, not affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency. It gives decision support, not legal or contracting advice. Always confirm requirements in the solicitation itself.</p>
</div></footer>
<script>
(function () {
  var v = document.getElementById('demo'), b = document.getElementById('vbtn');
  var pause = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';
  var play = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); b.innerHTML = play; b.setAttribute('aria-label', 'Play demo'); }
  b.addEventListener('click', function () {
    if (v.paused) { v.play(); b.innerHTML = pause; b.setAttribute('aria-label', 'Pause demo'); }
    else { v.pause(); b.innerHTML = play; b.setAttribute('aria-label', 'Play demo'); }
  });
})();
</script>
</body></html>`;
}
