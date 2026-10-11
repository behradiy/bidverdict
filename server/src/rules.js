// Deterministic eligibility checks. These run before the model and override it:
// the model explains, the rules decide hard stops.

export const CERTS = {
  sb: 'Small business',
  '8a': '8(a)',
  hubzone: 'HUBZone',
  sdvosb: 'Service-disabled veteran-owned (SDVOSB)',
  vosb: 'Veteran-owned (VOSB)',
  wosb: 'Women-owned (WOSB)',
  edwosb: 'Economically disadvantaged women-owned (EDWOSB)',
  iee: 'Indian Economic Enterprise'
};

// SAM.gov set-aside codes -> which certifications qualify.
export const SET_ASIDES = {
  SBA: {label: 'Total Small Business Set-Aside (FAR 19.5)', needs: ['sb']},
  SBP: {label: 'Partial Small Business Set-Aside (FAR 19.5)', needs: ['sb']},
  '8A': {label: '8(a) Set-Aside (FAR 19.8)', needs: ['8a']},
  '8AN': {label: '8(a) Sole Source (FAR 19.8)', needs: ['8a'], soleSource: true},
  HZC: {label: 'HUBZone Set-Aside (FAR 19.13)', needs: ['hubzone']},
  HZS: {label: 'HUBZone Sole Source (FAR 19.13)', needs: ['hubzone'], soleSource: true},
  SDVOSBC: {label: 'SDVOSB Set-Aside (FAR 19.14)', needs: ['sdvosb']},
  SDVOSBS: {label: 'SDVOSB Sole Source (FAR 19.14)', needs: ['sdvosb'], soleSource: true},
  WOSB: {label: 'WOSB Program Set-Aside (FAR 19.15)', needs: ['wosb', 'edwosb']},
  WOSBSS: {label: 'WOSB Program Sole Source (FAR 19.15)', needs: ['wosb', 'edwosb'], soleSource: true},
  EDWOSB: {label: 'EDWOSB Program Set-Aside (FAR 19.15)', needs: ['edwosb']},
  EDWOSBSS: {label: 'EDWOSB Program Sole Source (FAR 19.15)', needs: ['edwosb'], soleSource: true},
  VSA: {label: 'Veteran-Owned Small Business Set-Aside (VA)', needs: ['vosb', 'sdvosb']},
  VSS: {label: 'Veteran-Owned Small Business Sole Source (VA)', needs: ['vosb', 'sdvosb'], soleSource: true},
  IEE: {label: 'Indian Economic Enterprise Set-Aside', needs: ['iee']},
  ISBEE: {label: 'Indian Small Business Economic Enterprise Set-Aside', needs: ['iee']},
  BICiv: {label: 'Buy Indian Set-Aside', needs: ['iee']},
  LAS: {label: 'Local Area Set-Aside (FAR 26.2)', needs: [], note: 'Limited to firms that reside or primarily do business in the declared disaster or emergency area.'}
};

// SAM.gov notice type codes.
export const NOTICE_TYPES = {
  o: {label: 'Solicitation', biddable: true},
  k: {label: 'Combined Synopsis/Solicitation', biddable: true},
  g: {label: 'Sale of Surplus Property', biddable: true},
  p: {label: 'Presolicitation', early: true},
  r: {label: 'Sources Sought', early: true},
  s: {label: 'Special Notice', early: true},
  i: {label: 'Intent to Bundle Requirements', early: true},
  a: {label: 'Award Notice', closed: true},
  u: {label: 'Justification', closed: true},
  j: {label: 'Justification', closed: true}
};

const DAY = 86400000;

export function normaliseProfile(p = {}) {
  const list = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(s => String(s).trim()).filter(Boolean);
  return {
    company: String(p.company || '').slice(0, 120),
    naics: list(p.naics).filter(c => /^\d{6}$/.test(c)).slice(0, 40),
    certs: list(p.certs).map(c => c.toLowerCase()).filter(c => c in CERTS),
    states: list(p.states).map(s => s.toUpperCase()).filter(s => /^[A-Z]{2}$/.test(s) || s === 'ALL').slice(0, 60),
    capabilities: String(p.capabilities || '').slice(0, 2000),
    pastPerformance: String(p.pastPerformance || '').slice(0, 1500),
    clearance: ['none', 'secret', 'top-secret'].includes(p.clearance) ? p.clearance : 'none',
    minValue: Number(p.minValue) > 0 ? Number(p.minValue) : null,
    maxValue: Number(p.maxValue) > 0 ? Number(p.maxValue) : null
  };
}

// notice: the trimmed SAM.gov notice the extension sends ({type, setAside, deadline, naics[], place:{state}})
export function computeChecks(notice, profile, now = Date.now()) {
  const type = NOTICE_TYPES[notice.type] || {label: notice.typeLabel || 'Unknown notice type'};
  const out = {noticeType: {code: notice.type || null, ...type}};

  // Set-aside
  const code = notice.setAside || null;
  const sa = code ? SET_ASIDES[code] : null;
  if (!code || code === 'NONE') {
    out.setAside = {code: null, label: 'Full and open (no set-aside)', eligible: true};
  } else if (!sa) {
    out.setAside = {code, label: notice.setAsideLabel || code, eligible: null, note: 'Unrecognised set-aside code; check eligibility yourself.'};
  } else {
    const has = sa.needs.length === 0 ? null : sa.needs.some(c => profile.certs.includes(c));
    out.setAside = {code, label: sa.label, eligible: has, soleSource: !!sa.soleSource, needs: sa.needs.map(c => CERTS[c]), note: sa.note || null};
  }

  // Deadline
  const t = Date.parse(notice.deadline || '');
  if (Number.isFinite(t)) {
    const daysLeft = (t - now) / DAY;
    out.deadline = {iso: notice.deadline, tz: notice.deadlineTz || null, daysLeft: Math.round(daysLeft * 10) / 10, passed: daysLeft < 0};
  } else {
    out.deadline = {iso: null, daysLeft: null, passed: false};
  }

  // NAICS
  const codes = (notice.naics || []).filter(c => /^\d{6}$/.test(c));
  if (!codes.length || !profile.naics.length) {
    out.naics = {codes, match: 'unknown', matched: []};
  } else {
    const exact = codes.filter(c => profile.naics.includes(c));
    const related = codes.filter(c => profile.naics.some(p => p.slice(0, 4) === c.slice(0, 4)));
    out.naics = exact.length ? {codes, match: 'exact', matched: exact}
      : related.length ? {codes, match: 'related', matched: related}
      : {codes, match: 'none', matched: []};
  }

  // Place of performance
  const st = notice.place && notice.place.state ? String(notice.place.state).toUpperCase() : null;
  if (!st || !profile.states.length || profile.states.includes('ALL')) {
    out.place = {state: st, match: null};
  } else {
    out.place = {state: st, match: profile.states.includes(st)};
  }

  // Hard stops, in priority order
  out.hardStop = null;
  if (type.closed) out.hardStop = {verdict: 'No-bid', reason: `This is a ${type.label}, not an open opportunity.`};
  else if (out.deadline.passed) out.hardStop = {verdict: 'No-bid', reason: 'The response deadline has passed.'};
  else if (out.setAside.soleSource) out.hardStop = {verdict: 'No-bid', reason: `${out.setAside.label}: reserved for a firm the agency has already named.`};
  else if (out.setAside.eligible === false) out.hardStop = {verdict: 'No-bid', reason: `Set aside for ${out.setAside.needs.join(' or ')} firms, and your profile doesn’t list that certification.`};

  return out;
}
