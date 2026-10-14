import {API_BASE} from './config.js';

export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body || {}; }
}

async function call(path, {method = 'GET', body, timeoutMs = 20000} = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(API_BASE + path, {method, headers: body ? {'content-type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal});
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'The analysis took too long. Try again with fewer attachments.' : 'Can’t reach GovVerdict. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw new ApiError(j.message || `Request failed (${r.status})`, r.status, j);
  return j;
}

export const me = installId => call(`/v1/me?installId=${encodeURIComponent(installId)}`);
export const activate = (installId, key) => call('/v1/license', {method: 'POST', body: {installId, key}});
export const analyze = payload => call('/v1/analyze', {method: 'POST', body: payload, timeoutMs: 180000});
export const privacyUrl = () => `${API_BASE}/privacy`;
