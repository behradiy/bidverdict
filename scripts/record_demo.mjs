// Records store/shots/demo.html into the landing-page video (no audio).
// Needs the harness server:  python3 -m http.server 8090 --bind 127.0.0.1   (from the bidverdict folder)
// Usage:                     node scripts/record_demo.mjs
// Writes server/public/media/demo.mp4, demo.webm and demo-poster.jpg
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'server', 'public', 'media');
const URL_ = process.env.DEMO_URL || 'http://localhost:8090/store/shots/demo.html';
const FPS = 30, W = 1280, H = 720, SCALE = 1.5;

const profile = mkdtempSync('/tmp/bv-rec-');
const work = mkdtempSync('/tmp/bv-frames-');
const chrome = spawn('google-chrome', ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-pipe', '--hide-scrollbars',
  '--no-first-run', `--window-size=${W},${H}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']});
const out = chrome.stdio[3], inp = chrome.stdio[4];
let buf = '', nextId = 0;
const pending = new Map(), listeners = [];
inp.on('data', d => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(l => l(m));
  }
});
const send = (method, params = {}, sessionId) => new Promise(r => { const id = ++nextId; pending.set(id, r); out.write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + '\0'); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await sleep(600);
  const {result: {targetId}} = await send('Target.createTarget', {url: 'about:blank'});
  const {result: {sessionId: s}} = await send('Target.attachToTarget', {targetId, flatten: true});
  await send('Page.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: SCALE, mobile: false}, s);
  await send('Page.navigate', {url: URL_}, s);
  const evaluate = async expr => (await send('Runtime.evaluate', {expression: expr, returnByValue: true}, s)).result.result.value;
  for (let i = 0; i < 150 && !(await evaluate('window.__demoReady === true')); i++) await sleep(200);
  if (!(await evaluate('window.__demoReady === true'))) throw new Error('Demo page never became ready. Is the harness server on :8090 running?');
  await sleep(800);

  const frames = [];
  listeners.push(m => {
    if (m.method === 'Page.screencastFrame' && m.sessionId === s) {
      frames.push({t: m.params.metadata.timestamp, data: m.params.data});
      send('Page.screencastFrameAck', {sessionId: m.params.sessionId}, s);
    }
  });
  await send('Page.startScreencast', {format: 'jpeg', quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1}, s);
  await sleep(500);
  const tStart = Date.now() / 1000;
  await send('Runtime.evaluate', {expression: 'window.__startDemo()'}, s);
  for (let i = 0; i < 300 && !(await evaluate('window.__demoDone === true')); i++) await sleep(100);
  await sleep(300);
  const tEnd = Date.now() / 1000;
  await send('Page.stopScreencast', {}, s);
  if (!frames.length) throw new Error('No frames captured.');
  console.log(`captured ${frames.length} frames over ${(tEnd - tStart).toFixed(1)} s`);

  // Resample to a constant frame rate: each output frame shows the latest captured frame.
  frames.sort((a, b) => a.t - b.t);
  const n = Math.round((tEnd - tStart) * FPS);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = tStart + k / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    writeFileSync(join(work, `f_${String(k).padStart(5, '0')}.jpg`), Buffer.from(frames[j].data, 'base64'));
  }

  mkdirSync(OUT, {recursive: true});
  const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(work, 'f_%05d.jpg')];
  execFileSync('ffmpeg', [...input, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(OUT, 'demo.mp4')]);
  execFileSync('ffmpeg', [...input, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-deadline', 'good', '-an', join(OUT, 'demo.webm')]);
  const posterFrame = join(work, `f_${String(Math.min(n - 1, Math.round(8 * FPS))).padStart(5, '0')}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', posterFrame, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '4', join(OUT, 'demo-poster.jpg')]);
  for (const f of ['demo.mp4', 'demo.webm', 'demo-poster.jpg']) console.log(`${f}  ${(statSync(join(OUT, f)).size / 1024).toFixed(0)} KB`);
  console.log(`duration ${(n / FPS).toFixed(1)} s, ${n} frames at ${FPS} fps`);
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  await Promise.race([new Promise(r => chrome.once('exit', r)), sleep(5000)]);
  rmSync(work, {recursive: true, force: true});
  try { rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200}); } catch { /* temp profile; the OS cleans /tmp */ }
}
