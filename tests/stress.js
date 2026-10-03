// 40 quick taps (60 ms hold, 45 ms gap) and 5 slow ones; every press and release must be logged.
// Usage: node stress.js "<url query>"
const { chromium } = require('playwright');
const path = require('path');
const query = process.argv[2] || '';
const PAGE = process.env.PAGE || path.join(__dirname, '..', 'MICE.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=' + path.join(__dirname, 'test_voice.wav') + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.resolve(PAGE) + query);
  await page.click('#sesBtn');
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Recording'), null, { timeout: 35000 });
  const sent = await page.evaluate(async () => {
    const fire = (type) => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let n = 0;
    for (let i = 0; i < 40; i++) { fire('keydown'); await wait(60); fire('keyup'); await wait(45); n++; }
    for (let i = 0; i < 5; i++) { fire('keydown'); await wait(300); fire('keyup'); await wait(300); n++; }
    return n;
  });
  await page.waitForTimeout(500);
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#sesBtn');
  await dl;
  const r = await page.evaluate(() => { const s = window.__mice.last; const holds = s.presses.map((p) => p.up - p.down); return { capture: s.cap.mode, logged: s.presses.length, minHold: Math.min(...holds).toFixed(1), maxHold: Math.max(...holds).toFixed(1), pressReleaseEvents: s.events.filter((e) => e.type === 'press').length + '/' + s.events.filter((e) => e.type === 'release').length }; });
  console.log('sent', sent, JSON.stringify(r), errs.length ? 'ERRORS ' + errs.join('; ') : 'no errors');
  await browser.close();
  if (r.logged !== sent || errs.length) process.exit(1);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
