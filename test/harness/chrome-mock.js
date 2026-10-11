// Harness-only stand-ins for chrome.* and SAM.gov, so sidepanel.js runs unmodified in a tab.
// Query params:
//   notice=linen|sample|sdvosb|none   which SAM.gov notice the "active tab" shows
//   profile=filled|empty               preload a company profile
//   api=mock                           answer /v1/* here instead of the local server
//   view=profile|account               open a tab after boot
//   reset=1                            clear harness storage first
(function () {
  const q = new URLSearchParams(location.search);
  if (q.get('reset') === '1') { localStorage.clear(); }
  if (q.get('theme') === 'dark') document.documentElement.style.colorScheme = 'dark';

  const NOTICES = {
    linen: 'ded9f2f94a8443518dd5951c5152da3d',
    sample: '5a1e0c9b7d3f4e21a8b6c4d2e0f19a37',
    sdvosb: '9c3b5d7e1f2a4b6c8d0e2f4a6b8c0d1e'
  };
  const which = q.get('notice') || 'linen';
  const tabUrl = which === 'none' ? 'https://sam.gov/search/?index=opp' : `https://sam.gov/opp/${NOTICES[which]}/view`;

  function area(name) {
    const key = `harness:${name}`;
    const load = () => JSON.parse(localStorage.getItem(key) || '{}');
    const save = o => localStorage.setItem(key, JSON.stringify(o));
    return {
      async get(keys) {
        const all = load();
        if (keys == null) return all;
        const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        return Object.fromEntries(list.filter(k => k in all).map(k => [k, all[k]]));
      },
      async set(obj) { save({...load(), ...obj}); },
      async remove(keys) { const all = load(); [].concat(keys).forEach(k => delete all[k]); save(all); }
    };
  }

  const PROFILE = {
    company: 'Desert Facility Services',
    naics: ['812320', '812332', '561720'],
    certs: ['sb', 'wosb'],
    states: ['AZ', 'NM', 'NV'],
    capabilities: 'Healthcare janitorial and commercial laundry across Phoenix and Tucson. 140 trained staff, infection-control cleaning, 24/7 response.',
    pastPerformance: 'Regional hospital network: janitorial and laundry since 2021 ($1.2M a year). VA subcontract in Prescott, 2024–2026.',
    clearance: 'none', minValue: 50000, maxValue: 2000000
  };
  if (q.get('profile') === 'filled' && !localStorage.getItem('harness:sync')) localStorage.setItem('harness:sync', JSON.stringify({profile: PROFILE}));
  if (q.get('profile') === 'empty') localStorage.setItem('harness:sync', '{}');
  if (!JSON.parse(localStorage.getItem('harness:local') || '{}').installId) localStorage.setItem('harness:local', JSON.stringify({installId: '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60'}));

  window.chrome = {
    storage: {local: area('local'), sync: area('sync'), onChanged: {addListener() {}}},
    tabs: {
      query: async () => [{id: 1, active: true, url: tabUrl}],
      create: ({url}) => { console.log('[harness] open tab', url); },
      onActivated: {addListener() {}},
      onUpdated: {addListener() {}}
    },
    runtime: {getManifest: () => ({version: '1.0.0'})}
  };
  if (q.get('auto') === '1') setTimeout(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Analyze notice');
    if (b) b.click();
  }, 1200);
  if (q.get('scroll')) setTimeout(() => {
    const t = [...document.querySelectorAll('h3')].find(x => x.textContent.startsWith(q.get('scroll')));
    if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 104);
  }, 2600);
  if (q.get('view')) setTimeout(() => { const b = [...document.querySelectorAll('.tab')].find(t => t.textContent.toLowerCase().startsWith(q.get('view'))); if (b) b.click(); }, 1200);

  // ---- SAM.gov fixtures ----
  const inDays = d => new Date(Date.now() + d * 86400000).toISOString();
  const SYNTH = {
    [NOTICES.sample]: {
      data2: {title: 'Janitorial and Custodial Services, Phoenix VA Health Care System', solicitationNumber: '36C26226Q0918', type: 'k',
        naics: [{code: ['561720'], type: 'primary'}], classificationCode: 'S201',
        solicitation: {setAside: 'SBA', deadlines: {response: inDays(16.3), responseTz: 'America/Phoenix'}},
        placeOfPerformance: {city: {name: 'Phoenix'}, state: {code: 'AZ'}, zip: '85012'}},
      description: [{body: '<p>Custodial services for the main campus and two community clinics. See the attached performance work statement.</p>'}],
      attachments: [
        ['36C26226Q0918 Combined Synopsis Solicitation.pdf', '.pdf', 918000, 4],
        ['Attachment A - Performance Work Statement.pdf', '.pdf', 642000, 3],
        ['Attachment B - Price Schedule.xlsx', '.xlsx', 41000, 2],
        ['Wage Determination 2015-5465 Rev 27.pdf', '.pdf', 120000, 1]
      ]
    },
    [NOTICES.sdvosb]: {
      data2: {title: 'Grounds Maintenance and Snow Removal, Albuquerque VA Medical Center', solicitationNumber: '36C26226Q0877', type: 'o',
        naics: [{code: ['561730'], type: 'primary'}], classificationCode: 'S208',
        solicitation: {setAside: 'SDVOSBC', deadlines: {response: inDays(9.2), responseTz: 'America/Denver'}},
        placeOfPerformance: {city: {name: 'Albuquerque'}, state: {code: 'NM'}, zip: '87108'}},
      description: [{body: '<p>Grounds maintenance and snow removal, base year plus four option years.</p>'}],
      attachments: [['36C26226Q0877 Solicitation.pdf', '.pdf', 760000, 1]]
    }
  };
  const resourcesFor = id => ({_embedded: {opportunityAttachmentList: [{opportunityId: id, attachments: SYNTH[id].attachments.map(([name, ext, size, order], i) => ({
    attachmentId: `a${i}`, resourceId: `${id.slice(0, 24)}${String(i).padStart(8, '0')}`, attachmentOrder: order, fileExists: '1', name, type: 'file',
    postedDate: '2026-10-01T00:00:00Z', accessLevel: 'public', exportControlled: '0', mimeType: ext, size, deletedFlag: '0'
  }))}]}});

  const realFetch = window.fetch.bind(window);
  const json = o => new Response(JSON.stringify(o), {status: 200, headers: {'content-type': 'application/json'}});
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    let m;
    if ((m = url.match(/sam\.gov\/api\/prod\/opps\/v2\/opportunities\/([0-9a-f]{32})/))) {
      if (m[1] === NOTICES.linen) return realFetch('/test/fixtures/notice-linen.json');
      return json({...SYNTH[m[1]], cancelled: false, archived: false});
    }
    if ((m = url.match(/sam\.gov\/api\/prod\/opps\/v3\/opportunities\/([0-9a-f]{32})\/resources$/))) {
      if (m[1] === NOTICES.linen) return realFetch('/test/fixtures/resources-linen.json');
      return json(resourcesFor(m[1]));
    }
    if (/sam\.gov\/api\/prod\/opps\/v3\/opportunities\/resources\/files\/[0-9a-f]+\/download/.test(url)) {
      return realFetch(url.includes('b5931e6a07d545eaabad461f8d05ab37') ? '/test/fixtures/solicitation-v5.docx' : '/test/fixtures/amendment-0004.pdf');
    }
    if (q.get('api') === 'mock' && /\/v1\//.test(url)) return mockApi(url, init);
    return realFetch(input, init);
  };

  let used = Number(q.get('used') || 1);
  const account = () => ({plan: q.get('plan') || 'free', used, limit: q.get('plan') === 'pro' ? 60 : 5, checkoutUrl: q.get('plan') === 'pro' ? null : 'https://buy.stripe.com/test_example', portalUrl: null, priceLabel: '$14 a month', proLimit: 60});
  async function mockApi(url, init) {
    await new Promise(r => setTimeout(r, 300));
    if (url.includes('/v1/me')) return json(account());
    if (url.includes('/v1/analyze')) {
      await new Promise(r => setTimeout(r, Number(q.get('delay') || 0)));
      used++;
      const body = JSON.parse(init.body);
      const r = await realFetch(`/test/harness/results/${body.notice.id}.json`);
      const o = await r.json();
      o.account = account();
      return json(o);
    }
    return json({});
  }
})();
