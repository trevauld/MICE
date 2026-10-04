// The screen wake lock is requested when listening starts, asked for again after the page was hidden, and released when listening stops.
// Chromium headless has no real wake lock, so a fake one counts the calls.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    window.__wl = { requests: 0, released: 0, live: null };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
      window.__wl.requests++;
      const l = { released: false, release: async () => { l.released = true; window.__wl.released++; }, addEventListener() {} };
      window.__wl.live = l; return l; } } });
  });
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  const afterStart = await p.evaluate(() => ({ n: window.__wl.requests, msg: document.getElementById('status').textContent }));
  // the browser drops the lock when the page is hidden; coming back must ask again
  await p.evaluate(() => { window.__wl.live.released = true; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForFunction(() => window.__wl.requests >= 2, null, { timeout: 5000 });
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Stopped'), null, { timeout: 5000 });
  const end = await p.evaluate(() => ({ req: window.__wl.requests, rel: window.__wl.released }));
  // and without any wake lock support the user is told what to do
  const q = await b.newPage();
  await q.addInitScript(() => { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }); });
  await q.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  await q.click('#sesBtn');
  await q.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  const noSupport = await q.textContent('#status');
  await b.close();
  const ok = afterStart.n === 1 && /screen stays on/.test(afterStart.msg) && end.req === 2 && end.rel >= 1 && /Auto-Lock/.test(noSupport) && !errs.length;
  console.log({ afterStart: afterStart.n, reRequested: end.req, released: end.rel, withoutSupport: noSupport.slice(-80), errs });
  console.log(ok ? 'WAKE OK' : 'WAKE FAIL'); process.exit(ok ? 0 : 1);
})();
