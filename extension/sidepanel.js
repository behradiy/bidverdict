import {h, icon, scoreRing} from './dom.js';
import {CERTS, SET_ASIDES, NOTICE_TYPES} from './labels.js';
import {noticeIdFromUrl, loadNotice, loadAttachments, pickAttachments, downloadAttachment, BUDGET} from './sam.js';
import * as api from './api.js';

const SEARCH_URL = 'https://sam.gov/search/?index=opp&sfm%5Bstatus%5D%5Bis_active%5D=true';
const VERDICT_TONE = {Bid: 'go', Consider: 'warn', 'No-bid': 'stop', Respond: 'info'};
const VERDICT_TEXT = {
  Bid: 'Bid',
  Consider: 'Consider',
  'No-bid': 'No-bid',
  Respond: 'Respond, don’t bid yet'
};

const state = {
  view: 'analyze',
  installId: null,
  profile: {},
  account: null,
  accountError: null,
  noticeId: null,
  notice: null,
  attachments: [],
  phase: 'idle', // idle | loading | ready | running | done
  progress: '',
  result: null,
  error: null,
  pasted: '',
  pasteOpen: false,
  checkedReqs: [],
  flash: null // {view, text, tone}
};
let loadToken = 0;
const app = document.getElementById('app');

/* ---------- storage ---------- */
const local = chrome.storage.local, sync = chrome.storage.sync;
async function ensureInstallId() {
  let {installId} = await local.get('installId');
  if (!installId) { installId = crypto.randomUUID(); await local.set({installId}); }
  return installId;
}
const profileComplete = p => p && Array.isArray(p.naics) && p.naics.length > 0 && Array.isArray(p.certs);

/* ---------- formatting ---------- */
const fmtBytes = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
function deadlineInfo(iso, tz) {
  if (!iso) return {text: 'No response date', tone: 'muted'};
  const t = Date.parse(iso);
  const hours = (t - Date.now()) / 3600000;
  let when;
  try { when = new Date(t).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || undefined, timeZoneName: 'short'}); } catch { when = new Date(t).toLocaleString(); }
  if (hours < 0) return {text: `Closed ${when}`, tone: 'stop'};
  if (hours < 48) return {text: `Due in ${Math.max(1, Math.round(hours))} h · ${when}`, tone: 'stop'};
  const days = Math.floor(hours / 24);
  return {text: `Due in ${days} days · ${when}`, tone: days < 7 ? 'warn' : 'muted'};
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} days ago`;
}

/* ---------- data loading ---------- */
async function refreshAccount() {
  try { state.account = await api.me(state.installId); state.accountError = null; }
  catch (e) { state.accountError = e.message; }
  render();
}

async function onTab(url) {
  const id = noticeIdFromUrl(url || '');
  if (id === state.noticeId && state.phase !== 'idle') return;
  const token = ++loadToken;
  Object.assign(state, {noticeId: id, notice: null, attachments: [], result: null, error: null, pasted: '', checkedReqs: [], progress: ''});
  if (!id) { state.phase = 'idle'; render(); return; }
  state.phase = 'loading';
  render();
  try {
    const [notice, attachments, cached] = await Promise.all([loadNotice(id), loadAttachments(id), local.get([`result:${id}`, `reqs:${id}`])]);
    if (token !== loadToken) return;
    state.notice = notice;
    state.attachments = pickAttachments(attachments);
    state.checkedReqs = cached[`reqs:${id}`] || [];
    if (cached[`result:${id}`]) { state.result = cached[`result:${id}`]; state.phase = 'done'; }
    else state.phase = 'ready';
  } catch (e) {
    if (token !== loadToken) return;
    state.phase = 'ready';
    state.error = {message: 'Couldn’t load this notice from SAM.gov. Reload the page and try again.'};
  }
  render();
}

async function currentTabUrl() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab ? tab.url : '';
}

/* ---------- analysis ---------- */
async function runAnalysis() {
  const token = loadToken;
  const chosen = state.attachments.filter(a => a.selected);
  state.phase = 'running';
  state.error = null;
  try {
    const files = [];
    for (let i = 0; i < chosen.length; i++) {
      state.progress = `Downloading documents (${i + 1} of ${chosen.length})`;
      render();
      files.push(await downloadAttachment(chosen[i]));
    }
    state.progress = chosen.length ? `Reading ${chosen.length} document${chosen.length > 1 ? 's' : ''} and checking your fit` : 'Reading the notice and checking your fit';
    render();
    const {cancelled, archived, ...notice} = state.notice;
    const res = await api.analyze({installId: state.installId, notice, profile: state.profile, files, pasted: state.pasted});
    if (token !== loadToken) return;
    state.result = {result: res.result, checks: res.checks, skipped: res.skipped || [], model: res.model, at: Date.now()};
    state.account = res.account || state.account;
    state.phase = 'done';
    await local.set({[`result:${state.noticeId}`]: state.result});
    pruneCache();
  } catch (e) {
    if (token !== loadToken) return;
    state.phase = 'ready';
    state.error = {message: e.message, quota: e.body && e.body.error === 'quota'};
    if (e.body && e.body.account) state.account = e.body.account;
  }
  render();
}

async function pruneCache() {
  const all = await local.get(null);
  const results = Object.entries(all).filter(([k]) => k.startsWith('result:')).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const drop = results.slice(30).flatMap(([k]) => [k, k.replace('result:', 'reqs:')]);
  if (drop.length) await local.remove(drop);
}

/* ---------- views ---------- */
function header() {
  const a = state.account;
  let pill = null;
  if (a) {
    const left = Math.max(0, a.limit - a.used);
    pill = h('span', {class: `plan ${a.plan}`}, a.plan === 'pro' ? `Pro · ${left} left today` : `Free · ${left} of ${a.limit} left today`);
  }
  const tab = (id, label, dot) => h('button', {class: 'tab', role: 'tab', 'aria-selected': String(state.view === id), onclick: () => { state.view = id; state.flash = null; render(); }}, label, dot && h('span', {class: 'dot', title: 'Needs setup'}));
  return h('header', {class: 'top'},
    h('div', {class: 'brand'}, h('img', {src: 'icons/icon32.png', alt: '', width: 20, height: 20}), h('span', null, 'BidVerdict'), pill),
    h('nav', {class: 'tabs', role: 'tablist'}, tab('analyze', 'Analyze'), tab('profile', 'Profile', !profileComplete(state.profile)), tab('account', 'Account')));
}

function emptyState() {
  return h('section', {class: 'empty'},
    h('div', {class: 'empty-mark'}, icon('doc')),
    h('h2', null, 'Open a contract opportunity'),
    h('p', null, 'Go to SAM.gov and open any contract opportunity. BidVerdict picks it up here and tells you whether to bid.'),
    h('button', {class: 'btn primary', onclick: () => chrome.tabs.create({url: SEARCH_URL})}, 'Search SAM.gov'),
    !profileComplete(state.profile) && h('p', {class: 'hint'}, 'First time? ', h('button', {class: 'link', onclick: () => { state.view = 'profile'; render(); }}, 'Set up your company profile'), ' so the fit check knows your NAICS codes and certifications.'));
}

function noticeCard(n) {
  const d = deadlineInfo(n.deadline, n.deadlineTz);
  const chips = [
    h('span', {class: `chip ${d.tone}`}, d.text),
    h('span', {class: 'chip'}, n.setAside ? (SET_ASIDES[n.setAside] || n.setAside) : 'No set-aside'),
    ...n.naics.map(c => h('span', {class: 'chip mono'}, `NAICS ${c}`)),
    n.place && n.place.state && h('span', {class: 'chip'}, [n.place.city, n.place.state].filter(Boolean).join(', '))
  ];
  return h('section', {class: 'notice'},
    h('div', {class: 'eyebrow'}, [NOTICE_TYPES[n.type] || 'Notice', n.solicitationNumber].filter(Boolean).join(' · ')),
    h('h2', {class: 'notice-title'}, n.title),
    h('div', {class: 'chips'}, chips),
    (n.cancelled || n.archived) && h('div', {class: 'banner stop'}, icon('warn'), n.cancelled ? 'This notice was cancelled.' : 'This notice is archived.'));
}

function documentPicker() {
  const list = state.attachments;
  const chosen = list.filter(a => a.selected);
  const bytes = chosen.reduce((t, a) => t + a.size, 0);
  const over = chosen.length > BUDGET.files || bytes > BUDGET.bytes;
  if (!list.length) return h('section', {class: 'docs'}, h('h3', null, 'Documents'), h('p', {class: 'muted small'}, 'No attachments on this notice. BidVerdict will use the description, plus anything you paste below.'));
  return h('section', {class: 'docs'},
    h('div', {class: 'row-between'}, h('h3', null, 'Documents to read'), h('span', {class: `small ${over ? 'stop-text' : 'muted'}`}, `${chosen.length} of ${BUDGET.files} · ${fmtBytes(bytes)} of 12 MB`)),
    h('ul', {class: 'doclist'}, list.map((a, i) => h('li', {class: a.readable ? '' : 'off'},
      h('label', null,
        h('input', {type: 'checkbox', checked: a.selected, disabled: !a.readable, onchange: e => { state.attachments[i].selected = e.target.checked; render(); }}),
        h('span', {class: 'docname'}, a.name),
        h('span', {class: 'docmeta'}, a.readable ? `${a.ext.toUpperCase()} · ${fmtBytes(a.size)}` : a.why))))),
    h('p', {class: 'muted small'}, 'Pre-selected: the newest version of each document and the two latest amendments.'));
}

function readyView() {
  const n = state.notice;
  const a = state.account;
  const chosen = state.attachments.filter(x => x.selected);
  const bytes = chosen.reduce((t, x) => t + x.size, 0);
  const blocked = chosen.length > BUDGET.files || bytes > BUDGET.bytes;
  return [
    n && noticeCard(n),
    !profileComplete(state.profile) && h('div', {class: 'banner warn'}, icon('warn'), h('span', null, 'Add your NAICS codes and certifications for an accurate fit check. ', h('button', {class: 'link', onclick: () => { state.view = 'profile'; render(); }}, 'Open profile'))),
    n && documentPicker(),
    n && h('details', {class: 'paste', open: state.pasteOpen, ontoggle: e => { state.pasteOpen = e.target.open; }}, h('summary', null, 'Add text from elsewhere (optional)'),
      h('textarea', {rows: 5, placeholder: 'Paste Q&A answers, a section from a spreadsheet, or notes from the site visit.', value: state.pasted, oninput: e => { state.pasted = e.target.value; }})),
    state.error && h('div', {class: `banner ${state.error.quota ? 'warn' : 'stop'}`}, icon('warn'), h('span', null, state.error.message),
      state.error.quota && a && a.checkoutUrl && h('button', {class: 'btn small', onclick: () => chrome.tabs.create({url: a.checkoutUrl})}, 'Upgrade')),
    n && h('button', {class: 'btn primary wide', disabled: blocked || n.cancelled, onclick: runAnalysis}, 'Analyze notice'),
    n && a && h('p', {class: 'muted small center'}, a.plan === 'pro' ? 'Pro analysis with the deeper model.' : `Uses 1 of your ${a.limit} free analyses today.`)
  ];
}

function runningView() {
  return [
    state.notice && noticeCard(state.notice),
    h('section', {class: 'progress', 'aria-live': 'polite'},
      h('div', {class: 'spinner', 'aria-hidden': 'true'}),
      h('div', null, h('b', null, state.progress), h('p', {class: 'muted small'}, 'Usually 20 to 60 seconds. You can keep browsing; this panel will update.')))
  ];
}

function checkRow(label, ok, text) {
  const tone = ok === true ? 'go' : ok === false ? 'stop' : 'muted';
  return h('li', {class: `check ${tone}`}, icon(ok === true ? 'check' : ok === false ? 'cross' : 'dot'), h('span', {class: 'check-label'}, label), h('span', {class: 'check-val'}, text));
}

function checksBlock(c) {
  const sa = c.setAside || {};
  const naics = c.naics || {};
  const dl = c.deadline || {};
  const pl = c.place || {};
  return h('ul', {class: 'checks'},
    checkRow('Set-aside', sa.eligible, sa.eligible === true ? 'Eligible' : sa.eligible === false ? `Needs ${(sa.needs || []).join(' or ')}` : 'Check yourself'),
    checkRow('NAICS', naics.match === 'exact' ? true : naics.match === 'none' ? false : null, naics.match === 'exact' ? `Match ${naics.matched.join(', ')}` : naics.match === 'related' ? `Related (${naics.matched.join(', ')})` : naics.match === 'none' ? 'Not in your profile' : 'Not set'),
    checkRow('Deadline', dl.passed ? false : dl.daysLeft == null ? null : dl.daysLeft >= 7, dl.passed ? 'Passed' : dl.daysLeft == null ? 'Not stated' : `${dl.daysLeft} days left`),
    checkRow('Location', pl.match, pl.state ? (pl.match === false ? `${pl.state} not in your states` : pl.state) : 'Not stated'));
}

function listBlock(title, items, cls, ic) {
  if (!items || !items.length) return null;
  return h('section', {class: `block ${cls || ''}`}, h('h3', null, title), h('ul', {class: 'items'}, items.map(t => h('li', null, ic && icon(ic), h('span', null, t)))));
}

function copyText(text, btn) {
  const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1500); };
  navigator.clipboard.writeText(text).then(done, () => { btn.textContent = 'Copy failed'; });
}

function summaryText() {
  const {result: r, checks} = state.result;
  const n = state.notice || {};
  const lines = [
    `${n.title || ''}${n.solicitationNumber ? ` (${n.solicitationNumber})` : ''}`,
    n.url || '',
    '',
    `Verdict: ${r.verdict} · fit ${r.score}/100`,
    r.verdictReason,
    '',
    r.summary,
    '',
    'Key facts:', ...r.keyFacts.map(f => `- ${f.label}: ${f.value}`),
    '',
    'Requirements:', ...r.requirements.map(x => `- ${x.item} [${x.source}]`),
    '',
    'Red flags:', ...(r.redFlags.length ? r.redFlags.map(x => `- ${x}`) : ['- None noted']),
    '',
    'Questions for the contracting officer:', ...r.questions.map(x => `- ${x}`),
    '',
    `Checks: set-aside ${checks.setAside.eligible === true ? 'eligible' : checks.setAside.eligible === false ? 'not eligible' : 'unverified'}; NAICS ${checks.naics.match}; ${checks.deadline.daysLeft ?? '?'} days to deadline.`,
    'Generated by BidVerdict. Decision support, not legal or contracting advice.'
  ];
  return lines.join('\n');
}

function resultView() {
  const {result: r, checks, skipped, at} = state.result;
  const tone = VERDICT_TONE[r.verdict] || 'warn';
  const reqKey = `reqs:${state.noticeId}`;
  const toggleReq = async (i, on) => {
    state.checkedReqs = on ? [...new Set([...state.checkedReqs, i])] : state.checkedReqs.filter(x => x !== i);
    await local.set({[reqKey]: state.checkedReqs});
  };
  return [
    state.notice && noticeCard(state.notice),
    h('section', {class: `verdict tone-${tone}`},
      scoreRing(r.score, tone),
      h('div', {class: 'verdict-text'},
        h('div', {class: 'eyebrow'}, 'Verdict'),
        h('div', {class: 'verdict-word'}, VERDICT_TEXT[r.verdict] || r.verdict),
        h('p', null, r.verdictReason))),
    checks.hardStop && checks.hardStop.reason !== r.verdictReason && h('div', {class: 'banner stop'}, icon('cross'), h('span', null, h('b', null, 'Hard stop. '), checks.hardStop.reason)),
    h('p', {class: 'summary'}, r.summary),
    checksBlock(checks),
    h('div', {class: 'fit'},
      listBlock('Where you fit', r.matches, 'good', 'check'),
      listBlock('Gaps to resolve', r.gaps, 'gap', 'warn')),
    r.keyFacts.length && h('section', {class: 'block'}, h('h3', null, 'Key facts'),
      h('dl', {class: 'facts'}, r.keyFacts.map(f => [h('dt', null, f.label), h('dd', {class: /not stated/i.test(f.value) ? 'muted' : ''}, f.value)]))),
    r.requirements.length && h('section', {class: 'block'},
      h('div', {class: 'row-between'}, h('h3', null, 'What the offer needs'), h('span', {class: 'muted small'}, `${state.checkedReqs.length} of ${r.requirements.length} done`)),
      h('ul', {class: 'reqs'}, r.requirements.map((x, i) => h('li', null, h('label', null,
        h('input', {type: 'checkbox', checked: state.checkedReqs.includes(i), onchange: async e => { await toggleReq(i, e.target.checked); render(); }}),
        h('span', null, x.item, ' ', h('span', {class: 'src'}, x.source))))))),
    r.evaluation.length && h('section', {class: 'block'}, h('h3', null, 'How offers are judged'), h('ol', {class: 'items numbered'}, r.evaluation.map(t => h('li', null, t)))),
    listBlock('Red flags', r.redFlags, 'flag', 'warn'),
    r.questions.length && h('section', {class: 'block'},
      h('div', {class: 'row-between'}, h('h3', null, 'Ask the contracting officer'),
        h('button', {class: 'btn ghost small', onclick: e => copyText(r.questions.map(q => `- ${q}`).join('\n'), e.currentTarget)}, icon('copy'), 'Copy')),
      h('ul', {class: 'items'}, r.questions.map(q => h('li', null, h('span', null, q))))),
    h('section', {class: 'block docs-read'}, h('h3', null, 'Read for this analysis'),
      h('ul', {class: 'items small'}, r.documentsRead.map(d => h('li', null, icon('doc'), h('span', null, d))),
        (skipped || []).map(sk => h('li', {class: 'muted'}, icon('cross'), h('span', null, `${sk.name}: ${sk.why}`))))),
    h('div', {class: 'actions'},
      h('button', {class: 'btn primary', onclick: e => copyText(summaryText(), e.currentTarget)}, icon('copy'), 'Copy summary'),
      h('button', {class: 'btn', onclick: () => { state.phase = 'ready'; state.result = null; render(); }}, icon('refresh'), 'Re-run')),
    h('p', {class: 'muted small center'}, `Analyzed ${ago(at)}. Decision support, not legal or contracting advice. Always check the solicitation itself.`)
  ];
}

function analyzeView() {
  if (state.phase === 'idle') return emptyState();
  if (state.phase === 'loading') return h('section', {class: 'progress'}, h('div', {class: 'spinner', 'aria-hidden': 'true'}), h('b', null, 'Loading the notice from SAM.gov'));
  if (state.phase === 'running') return runningView();
  if (state.phase === 'done' && state.result) return resultView();
  return readyView();
}

function profileView() {
  const p = state.profile || {};
  const field = (id, label, input, hint) => h('div', {class: 'field'}, h('label', {for: id}, label), input, hint && h('p', {class: 'hint'}, hint));
  const flash = state.flash && state.flash.view === 'profile' ? state.flash : null;
  const status = h('span', {class: flash ? `${flash.tone}-text small` : 'muted small', 'aria-live': 'polite'}, flash ? flash.text : '');
  const form = h('form', {class: 'profile', onsubmit: async e => {
    e.preventDefault();
    const f = new FormData(form);
    const naics = String(f.get('naics') || '').split(/[\s,;]+/).filter(Boolean);
    const bad = naics.filter(c => !/^\d{6}$/.test(c));
    if (bad.length) { status.textContent = `NAICS codes must be 6 digits. Check: ${bad.join(', ')}`; status.className = 'stop-text small'; return; }
    state.profile = {
      company: String(f.get('company') || '').trim(),
      naics,
      certs: f.getAll('certs'),
      states: String(f.get('states') || '').split(/[\s,;]+/).map(x => x.toUpperCase()).filter(Boolean),
      capabilities: String(f.get('capabilities') || '').trim(),
      pastPerformance: String(f.get('pastPerformance') || '').trim(),
      clearance: f.get('clearance'),
      minValue: f.get('minValue') ? Number(f.get('minValue')) : null,
      maxValue: f.get('maxValue') ? Number(f.get('maxValue')) : null
    };
    await sync.set({profile: state.profile});
    state.flash = {view: 'profile', text: 'Saved. Re-run an analysis to use the new profile.', tone: 'go'};
    render();
  }},
    h('p', {class: 'muted small'}, 'Stored in your Chrome profile. It is sent with each analysis and not kept on our servers.'),
    field('company', 'Company name', h('input', {id: 'company', name: 'company', value: p.company || '', maxlength: 120, autocomplete: 'organization'})),
    field('naics', 'NAICS codes', h('input', {id: 'naics', name: 'naics', value: (p.naics || []).join(', '), placeholder: 'e.g. 561720, 812320', inputmode: 'numeric'}), 'Six-digit codes from your SAM registration, separated by commas.'),
    h('fieldset', {class: 'field'}, h('legend', null, 'Certifications'),
      h('div', {class: 'certs'}, CERTS.map(([k, label]) => h('label', {class: 'cert'}, h('input', {type: 'checkbox', name: 'certs', value: k, checked: (p.certs || []).includes(k)}), h('span', null, label))))),
    field('states', 'States you can perform in', h('input', {id: 'states', name: 'states', value: (p.states || []).join(', '), placeholder: 'e.g. AZ, NM, TX or ALL'}), 'Two-letter codes, or ALL for nationwide.'),
    field('capabilities', 'What you do', h('textarea', {id: 'capabilities', name: 'capabilities', rows: 4, maxlength: 2000, value: p.capabilities || '', placeholder: 'Commercial laundry with two plants in Phoenix; 24/7 pickup; healthcare linen handling.'})),
    field('pastPerformance', 'Past performance', h('textarea', {id: 'pastPerformance', name: 'pastPerformance', rows: 3, maxlength: 1500, value: p.pastPerformance || '', placeholder: 'Agencies and contract sizes you have delivered, e.g. VA subcontract $400k/yr since 2023.'})),
    h('div', {class: 'two'},
      field('clearance', 'Facility clearance', h('select', {id: 'clearance', name: 'clearance'}, [['none', 'None'], ['secret', 'Secret'], ['top-secret', 'Top Secret']].map(([v, t]) => h('option', {value: v, selected: (p.clearance || 'none') === v}, t)))),
      field('minValue', 'Smallest job ($)', h('input', {id: 'minValue', name: 'minValue', type: 'number', min: 0, step: 1000, value: p.minValue ?? ''})),
      field('maxValue', 'Largest job ($)', h('input', {id: 'maxValue', name: 'maxValue', type: 'number', min: 0, step: 1000, value: p.maxValue ?? ''}))),
    h('div', {class: 'actions'}, h('button', {class: 'btn primary', type: 'submit'}, 'Save profile'), status),
    h('button', {class: 'link danger', type: 'button', onclick: async () => { await sync.remove('profile'); state.profile = {}; render(); }}, 'Clear profile'));
  return h('section', {class: 'panel-body'}, h('h2', null, 'Company profile'), form);
}

function accountView() {
  const a = state.account;
  const keyInput = h('input', {id: 'licence', placeholder: 'BV-XXXX-XXXX-XXXX-XXXX', autocomplete: 'off', spellcheck: 'false'});
  const flash = state.flash && state.flash.view === 'account' ? state.flash : null;
  const msg = h('p', {class: flash ? `${flash.tone}-text small` : 'small', 'aria-live': 'polite'}, flash ? flash.text : '');
  const activate = async e => {
    e.preventDefault();
    msg.textContent = 'Checking…';
    msg.className = 'muted small';
    try { state.account = await api.activate(state.installId, keyInput.value.trim()); state.flash = {view: 'account', text: 'Pro is active in this browser.', tone: 'go'}; render(); }
    catch (err) { msg.textContent = err.message; msg.className = 'stop-text small'; }
  };
  return h('section', {class: 'panel-body'},
    h('h2', null, 'Account'),
    state.accountError && h('div', {class: 'banner stop'}, icon('warn'), h('span', null, state.accountError)),
    a && h('div', {class: 'card'},
      h('div', {class: 'eyebrow'}, a.plan === 'pro' ? 'Pro plan' : 'Free plan'),
      h('div', {class: 'big'}, `${Math.max(0, a.limit - a.used)} of ${a.limit}`),
      h('p', {class: 'muted small'}, 'analyses left today. Resets at midnight UTC.'),
      h('button', {class: 'btn small', onclick: refreshAccount}, icon('refresh'), 'Refresh')),
    a && a.plan === 'free' && a.checkoutUrl && h('div', {class: 'card upsell'},
      h('h3', null, `Pro · ${a.priceLabel || '$14 a month'}`),
      h('ul', {class: 'items'}, h('li', null, icon('check'), h('span', null, `Up to ${a.proLimit || 60} analyses a day`)), h('li', null, icon('check'), h('span', null, 'Deeper model for long solicitations')), h('li', null, icon('check'), h('span', null, 'Cancel any time'))),
      h('button', {class: 'btn primary wide', onclick: () => chrome.tabs.create({url: a.checkoutUrl})}, 'Upgrade to Pro'),
      h('p', {class: 'muted small'}, 'Checkout opens in a new tab. Come back and press Refresh when you’re done.')),
    a && a.plan === 'pro' && a.portalUrl && h('p', null, h('a', {href: a.portalUrl, target: '_blank', rel: 'noopener'}, 'Manage or cancel your subscription')),
    h('form', {class: 'card', onsubmit: activate},
      h('label', {for: 'licence'}, 'Have a licence key?'),
      h('div', {class: 'inline'}, keyInput, h('button', {class: 'btn', type: 'submit'}, 'Activate')),
      msg),
    h('p', {class: 'muted small'}, h('a', {href: api.privacyUrl(), target: '_blank', rel: 'noopener'}, 'Privacy policy'), ` · Version ${chrome.runtime.getManifest().version}`),
    h('p', {class: 'muted small'}, 'BidVerdict is an independent tool, not affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency.'));
}

function render() {
  const main = state.view === 'profile' ? profileView() : state.view === 'account' ? accountView() : analyzeView();
  app.replaceChildren(header(), h('main', {class: `view view-${state.view}`}, main));
}

/* ---------- boot ---------- */
async function boot() {
  state.installId = await ensureInstallId();
  state.profile = (await sync.get('profile')).profile || {};
  if (!profileComplete(state.profile)) state.view = 'analyze';
  render();
  refreshAccount();
  await onTab(await currentTabUrl());
  chrome.tabs.onActivated.addListener(async () => onTab(await currentTabUrl()));
  chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => { if (tab.active && (info.url || info.status === 'complete')) onTab(await currentTabUrl()); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && changes.profile) state.profile = changes.profile.newValue || {}; });
}
boot();
