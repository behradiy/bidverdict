// Reads public notice data and attachments from SAM.gov. Runs in the side panel,
// which has host permission for sam.gov and SAM.gov's attachment bucket.

const SAM = 'https://sam.gov';
export const READABLE = {pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain'};
export const BUDGET = {files: 6, bytes: 12 * 1024 * 1024, fileBytes: 7 * 1024 * 1024};

export function noticeIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'sam.gov') return null;
    const m = u.pathname.match(/\/opp\/([0-9a-f]{32})(\/|$)/i);
    return m ? m[1].toLowerCase() : null;
  } catch { return null; }
}

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return (doc.body.textContent || '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function getJson(url, signal) {
  const r = await fetch(url, {signal, credentials: 'omit'});
  if (!r.ok) throw new Error(`SAM.gov returned ${r.status}`);
  return r.json();
}

export async function loadNotice(id, signal) {
  const j = await getJson(`${SAM}/api/prod/opps/v2/opportunities/${id}`, signal);
  const d = j.data2 || {};
  const pop = d.placeOfPerformance || {};
  const sol = d.solicitation || {};
  return {
    id,
    url: `${SAM}/opp/${id}/view`,
    title: d.title || 'Untitled notice',
    solicitationNumber: d.solicitationNumber || '',
    type: d.type || null,
    setAside: sol.setAside || null,
    deadline: (sol.deadlines && sol.deadlines.response) || null,
    deadlineTz: (sol.deadlines && sol.deadlines.responseTz) || null,
    naics: (d.naics || []).flatMap(n => [].concat(n.code || [])).map(String),
    psc: d.classificationCode || '',
    place: {city: pop.city && pop.city.name, state: pop.state && pop.state.code, zip: pop.zip},
    description: stripHtml(j.description && j.description[0] && j.description[0].body),
    cancelled: !!j.cancelled,
    archived: !!j.archived
  };
}

export async function loadAttachments(id, signal) {
  let j;
  try { j = await getJson(`${SAM}/api/prod/opps/v3/opportunities/${id}/resources`, signal); } catch (e) { if (e.name === 'AbortError') throw e; return []; }
  const list = (j._embedded && j._embedded.opportunityAttachmentList && j._embedded.opportunityAttachmentList[0] && j._embedded.opportunityAttachmentList[0].attachments) || [];
  return list
    .filter(a => a.deletedFlag !== '1' && a.type === 'file')
    .map(a => {
      const ext = String(a.mimeType || a.name || '').toLowerCase().replace(/^.*\./, '');
      const restricted = a.accessLevel !== 'public' || a.exportControlled === '1' || a.fileExists !== '1';
      const size = Number(a.size) || 0;
      let why = null;
      if (restricted) why = 'Restricted on SAM.gov';
      else if (!READABLE[ext]) why = `.${ext} files aren’t read yet`;
      else if (size > BUDGET.fileBytes) why = 'Over 7 MB';
      return {resourceId: a.resourceId, name: a.name, ext, size, order: Number(a.attachmentOrder) || 0, posted: a.postedDate || '', readable: !why, why, selected: false};
    })
    .sort((a, b) => b.order - a.order);
}

const KEY = /(rf[qp]|solicitation|combined|sf[\s_-]?(1449|33|30)|sow|pws|statement of work|performance work|specification|instructions|evaluation|section[\s_-]?[lm]\b|price|pricing|schedule|q\s?&\s?a|questions|wage)/i;

// Choose a sensible default set: newest version of each document, the two newest
// amendments, solicitation-like files first, within the size and count budget.
export function pickAttachments(list) {
  const groups = new Map();
  for (const a of list.filter(x => x.readable)) {
    const g = a.name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_-]*(v|rev|version)?\d{1,2}$/, '').trim();
    if (!groups.has(g) || groups.get(g).order < a.order) groups.set(g, a);
  }
  const latest = [...groups.values()];
  const amendments = latest.filter(a => /amend|modif/i.test(a.name)).sort((a, b) => b.order - a.order);
  const score = a => {
    let s = KEY.test(a.name) ? 5 : 0;
    if (/amend|modif/i.test(a.name)) s = amendments.indexOf(a) < 2 ? 4 : -5;
    if (a.ext === 'pdf') s += 1;
    return s + a.order / 1000;
  };
  latest.sort((a, b) => score(b) - score(a));
  const chosen = new Set();
  let bytes = 0;
  for (const a of latest) {
    if (chosen.size >= BUDGET.files) break;
    if (score(a) < 0) continue;
    if (bytes + a.size > BUDGET.bytes) continue;
    chosen.add(a.resourceId);
    bytes += a.size;
  }
  return list.map(a => ({...a, selected: chosen.has(a.resourceId)}));
}

export async function downloadAttachment(a, signal) {
  const r = await fetch(`${SAM}/api/prod/opps/v3/opportunities/resources/files/${a.resourceId}/download`, {signal, credentials: 'omit'});
  if (!r.ok) throw new Error(`Couldn’t download ${a.name} (${r.status})`);
  const buf = await r.arrayBuffer();
  return {name: a.name, mime: READABLE[a.ext], data: toBase64(buf)};
}

export function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
