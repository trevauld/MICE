// One MICE session in headless Chromium with a fake microphone. Presses the cue key 80 ms (PRE) before
// each voice burst in the WAV, plus once with no voice, then saves the session to out/<name>.zip.
// Usage: node run_session.js "<url query>" <name> ['<json changes>' | delay]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const query = process.argv[2] || '';
const name = process.argv[3] || 'run';
const extra = process.argv[4] || '';
const PAGE = process.env.PAGE || path.join(__dirname, '..', 'MICE.html');
const WAV = path.join(__dirname, process.env.WAV || 'test_voice.wav');
const OUT = path.join(__dirname, 'out');
const OFFSET = +(process.env.OFFSET || 0), PRE = +(process.env.PRE || 0.08);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=' + WAV + '%noloop', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  if (process.env.TIMBRE0) await context.addInitScript((t) => { try { localStorage.setItem('mice.timbre', JSON.stringify(t)); } catch (e) { /* ignore */ } }, process.env.TIMBRE0);
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.resolve(PAGE) + query);
  const t0 = Date.now();
  await page.click('#sesBtn');
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Recording'), null, { timeout: 35000 });
  const info = await page.evaluate(() => {
    const c = window.__mice.capture;
    const b = c.bleed ? Object.assign({}, c.bleed, { filter: c.bleed.filter ? c.bleed.filter.length + ' taps' : null }) : null;
    return { mode: c.mode, at: c.an.timeOf(c.an.total) - c.an.timeOf(0), bleed: b };
  });
  console.log('capture:', info.mode, '| session started', info.at.toFixed(2), 's into the audio | start took', Date.now() - t0, 'ms');
  if (extra.startsWith('{')) {
    const o = JSON.parse(extra);
    if (o.timbre) await page.selectOption('#timbre', o.timbre);
    if (o.note) await page.selectOption('#note', o.note);
    if (o.simgain) await page.evaluate((g) => { window.__mice.capture.sim.sg.gain.value = g; }, o.simgain);
    if (o.vol) await page.evaluate((v) => { const el = document.getElementById('vol'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, o.vol);
    console.log('changed:', JSON.stringify(o));
  }
  await page.evaluate(([off, pre]) => {
    const cap = window.__mice.capture;
    const base = cap.an.timeOf(0);
    const targets = [6.0, 7.0, 7.9, 9.1, 10.3, 11.2].map((o) => base + o + off - pre).concat([base + 12.4 + off]);
    const fire = (type) => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    const now = cap.an.timeOf(cap.an.total);
    for (const t of targets) {
      const delay = Math.max(0, (t - now) * 1000);
      setTimeout(() => fire('keydown'), delay);
      setTimeout(() => fire('keyup'), delay + 250);
    }
  }, [OFFSET, PRE]);
  await page.waitForFunction((off) => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 13.3 + off; }, OFFSET, { timeout: 35000 });
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#sesBtn');
  await (await dl).saveAs(path.join(OUT, name + '.zip'));
  console.log('bleed:', await page.textContent('#bleedMsg'));
  console.log('warning:', await page.evaluate(() => document.getElementById('envNote').hidden ? '(none)' : document.getElementById('envNote').textContent));
  console.log('stats:', await page.evaluate(() => ['sLead', 'sLeadSub', 'sCov', 'sCovSub', 'sNoV', 'sCount', 'sDur'].map((id) => document.getElementById(id).textContent).join(' | ')));
  if (extra === 'delay') {
    await page.click('#delayBtn');
    await page.waitForFunction(() => !document.getElementById('delayBtn').disabled, null, { timeout: 15000 });
    console.log('delay status:', await page.textContent('#status'));
  }
  console.log(logs.filter((l) => !/ScriptProcessorNode is deprecated/.test(l)).join('\n') || 'no console errors');
  await browser.close();
})().catch((e) => { console.error('TEST FAILED', e); process.exit(1); });
