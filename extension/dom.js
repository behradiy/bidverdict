// Small element builder. Everything from the network goes in as text, never as HTML.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false && kid !== '') el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

export function icon(name) {
  const paths = {
    check: 'M4 10.5 8 14.5 16 5.5',
    warn: 'M10 3 18 17H2zM10 8v4M10 14.6v.2',
    cross: 'M5 5l10 10M15 5 5 15',
    dot: 'M10 6a4 4 0 1 0 0.01 0',
    copy: 'M7 7h9v9H7zM4 13V4h9',
    refresh: 'M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4',
    doc: 'M5 2h7l4 4v12H5zM12 2v4h4'
  };
  return s('svg', {viewBox: '0 0 20 20', class: `ic ic-${name}`, 'aria-hidden': 'true'},
    s('path', {d: paths[name] || paths.dot, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
}

export function scoreRing(score, tone) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return s('svg', {viewBox: '0 0 64 64', class: `ring tone-${tone}`, role: 'img', 'aria-label': `Fit score ${score} out of 100`},
    s('circle', {cx: 32, cy: 32, r, class: 'ring-track', fill: 'none', 'stroke-width': 6}),
    s('circle', {cx: 32, cy: 32, r, class: 'ring-fill', fill: 'none', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': off.toFixed(2), transform: 'rotate(-90 32 32)'}),
    s('text', {x: 32, y: 37, 'text-anchor': 'middle', class: 'ring-num'}, document.createTextNode(String(score))));
}
