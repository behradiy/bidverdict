// Scripted 18-second walkthrough. window.__startDemo() runs it; window.__demoDone flips at the end.
// The recorder (scripts/record_demo.mjs) captures the screen while this plays.
(function () {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f1 = $('f1'), f2 = $('f2'), cursor = $('cursor'), ring = $('ring');
  const SCENES = [
    ['Step 1', 'Open any contract opportunity.', 'BidVerdict picks up the SAM.gov notice and pre-selects the documents worth reading.'],
    ['Step 2', 'One click to analyze.', 'It reads the solicitation, the work statement and the latest amendments.'],
    ['Step 3', 'A clear verdict, with reasons.', 'Eligibility, NAICS, deadline and location are checked against SAM.gov data.'],
    ['Step 4', 'Know what the offer needs.', 'A checklist from the documents, with the source of every item.'],
    ['Step 5', 'Skip what you can’t win.', 'Set-asides you don’t qualify for are a no-bid, every time.']
  ];

  async function scene(i) {
    $('text').classList.add('out');
    await sleep(300);
    const [step, h, p] = SCENES[i];
    $('step').textContent = step; $('h').textContent = h; $('p').textContent = p;
    [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k <= i));
    $('text').classList.remove('out');
  }

  // Position of an element inside an iframe, in page coordinates.
  function pointAt(frame, el, dx = 0.5, dy = 0.5) {
    const fr = frame.getBoundingClientRect(), r = el.getBoundingClientRect();
    return {x: fr.left + r.left + r.width * dx, y: fr.top + r.top + r.height * dy};
  }
  function moveTo(p) { cursor.style.opacity = '1'; cursor.style.transform = `translate(${p.x - 4}px, ${p.y - 2}px)`; }
  async function click(p, el) {
    ring.style.left = p.x + 'px'; ring.style.top = p.y + 'px';
    ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
    cursor.style.transition = 'transform .12s'; cursor.style.transform += ' scale(.85)';
    await sleep(120);
    cursor.style.transform = cursor.style.transform.replace(' scale(.85)', '');
    await sleep(80);
    cursor.style.transition = '';
    if (el) el.click();
  }
  const doc = frame => frame.contentDocument;
  const find = (frame, sel, text) => [...doc(frame).querySelectorAll(sel)].find(e => !text || e.textContent.trim().startsWith(text));
  function smoothScroll(frame, top, ms) {
    const w = frame.contentWindow, start = w.scrollY, t0 = performance.now();
    return new Promise(res => {
      const tick = now => {
        const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        w.scrollTo(0, start + (top - start) * e);
        k < 1 ? requestAnimationFrame(tick) : res();
      };
      requestAnimationFrame(tick);
    });
  }

  window.__demoReady = false;
  window.__demoDone = false;
  (async () => {
    // wait for both panels to render their content
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      const ready1 = f1.contentDocument && find(f1, 'button', 'Analyze notice');
      const ready2 = f2.contentDocument && f2.contentDocument.querySelector('.verdict-word');
      if (ready1 && ready2) break;
    }
    $('step').textContent = SCENES[0][0]; $('h').textContent = SCENES[0][1]; $('p').textContent = SCENES[0][2];
    $('dots').children[0].classList.add('on');
    window.__demoReady = true;
  })();

  window.__startDemo = async function () {
    const t0 = performance.now();
    const at = ms => sleep(Math.max(0, ms - (performance.now() - t0)));
    // Scene 1: notice and documents (0–3.2s)
    const firstDoc = find(f1, '.doclist li');
    moveTo({x: 900, y: 690});
    await at(900);
    if (firstDoc) moveTo(pointAt(f1, firstDoc, 0.12, 0.5));
    await at(3000);
    // Scene 2: analyze (3.2–6.6s)
    scene(1);
    const btn = find(f1, 'button', 'Analyze notice');
    moveTo(pointAt(f1, btn, 0.5, 0.55));
    await at(4100);
    await click(pointAt(f1, btn, 0.5, 0.55), btn);
    moveTo({x: 1180, y: 640});
    // Scene 3: verdict (≈7.0–9.8s)
    await at(7000);
    scene(2);
    await at(9800);
    // Scene 4: checklist (9.8–13.2s)
    scene(3);
    const h3 = find(f1, 'h3', 'What the offer needs');
    const target = h3.getBoundingClientRect().top + f1.contentWindow.scrollY - 100;
    await smoothScroll(f1, target, 900);
    // Ticking re-renders the panel, so look each checkbox up again right before using it.
    const box = i => doc(f1).querySelectorAll('.reqs input')[i];
    for (const [i, ms] of [[0, 11100], [1, 11900], [2, 12600]]) {
      if (!box(i)) break;
      moveTo(pointAt(f1, box(i)));
      await at(ms);
      await click(pointAt(f1, box(i)), box(i));
    }
    await at(13300);
    // Scene 5: hard-stop no-bid (13.3–16.3s)
    scene(4);
    cursor.style.opacity = '0';
    f2.style.opacity = '1';
    f1.style.opacity = '0';
    await at(16300);
    // End card (16.3–18.5s)
    $('end').classList.add('show');
    await at(18500);
    window.__demoDone = true;
  };
})();
