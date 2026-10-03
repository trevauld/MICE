// Runs MICE in headless Chromium with a fake microphone playing a WAV, presses the cue key around the voice bursts
// (like a user would), and checks which voice segments MICE detected.
//   voice cases: 6 bursts must be found, with the gaps between their starts matching the WAV (within 25 ms)
//   no-voice cases: nothing may be detected, even with the cue playing and leaking into the microphone
// Usage: node detect_check.js            (all cases)      PAGE=path to use another page
const { chromium } = require('playwright');
const path = require('path');
const PAGE = process.env.PAGE || path.join(__dirname, '..', 'index.html');
const ONSETS = [6.0, 7.0, 7.9, 9.1, 10.3, 11.2];
const CASES = [
  { name: 'clean', wav: 'test_voice.wav', query: '', voice: true },
  { name: 'bleed', wav: 'test_voice.wav', query: '?simbleed=0.08&simdelay=17.3', voice: true },
  { name: 'bleed_strong', wav: 'test_voice.wav', query: '?simbleed=0.35&simdelay=23.1', voice: true },
  { name: 'bleed_weak', wav: 'test_voice.wav', query: '?simbleed=0.02&simdelay=12.7', voice: true },
  { name: 'dynamic_voice_cue', wav: 'test_voice.wav', query: '?simbleed=0.08&simdelay=17.3', voice: true, timbre: 'dynamic' },
  { name: 'silence_with_cue', wav: 'test_silence.wav', query: '?simbleed=0.08&simdelay=17.3', voice: false },
  { name: 'dynamic_cue_leak_no_voice', wav: 'test_silence.wav', query: '?simbleed=0.08&simdelay=17.3', voice: false, timbre: 'dynamic' },
  { name: 'rising_hiss', wav: 'test_noise_rise.wav', query: '', voice: false },
  { name: 'low_hum', wav: 'test_hum.wav', query: '', voice: false },
];
async function run(c) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=' + path.join(__dirname, c.wav) + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  if (c.timbre) await page.addInitScript((t) => { try { localStorage.setItem('mice.timbre', JSON.stringify(t)); } catch (e) { /* ignore */ } }, c.timbre);
  await page.goto('file://' + path.resolve(PAGE) + c.query);
  await page.click('#sesBtn');
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  await page.evaluate(() => {
    const cap = window.__mice.capture, base = cap.an.timeOf(0);
    const targets = [6.0, 7.0, 7.9, 9.1, 10.3, 11.2].map((o) => base + o - 0.08).concat([base + 12.4]);
    const fire = (type) => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    const now = cap.an.timeOf(cap.an.total);
    for (const t of targets) { const d = Math.max(0, (t - now) * 1000); setTimeout(() => fire('keydown'), d); setTimeout(() => fire('keyup'), d + 250); }
  });
  await page.waitForFunction(() => { const x = window.__mice.capture; return x && x.an.timeOf(x.an.total) - x.an.timeOf(0) > 13.3; }, null, { timeout: 35000 });
  const segs = await page.evaluate(() => { const c = window.__mice.capture; const r = window.__mice.segs.map((s) => [s.on, s.off]); if (c.segOpen != null) r.push([c.segOpen, null]); return r; });   // a detection still running at the end counts too
  await browser.close();
  const gaps = segs.slice(1).map((s, i) => (s[0] - segs[i][0]) * 1000);
  const truth = ONSETS.slice(1).map((o, i) => (o - ONSETS[i]) * 1000);
  const err = gaps.map((g, i) => Math.round(g - truth[i]));
  const ok = c.voice ? segs.length === 6 && err.every((e) => Math.abs(e) <= 25) : segs.length === 0;
  console.log((ok ? 'ok   ' : 'FAIL ') + c.name.padEnd(26) + 'segments ' + segs.length + (c.voice ? '  gap error ms ' + JSON.stringify(err) : '') + (errs.length ? '  ERRORS ' + errs : ''));
  return ok && !errs.length;
}
(async () => {
  let all = true;
  for (const c of CASES) all = (await run(c)) && all;
  console.log(all ? 'DETECTION OK' : 'DETECTION FAIL');
  process.exit(all ? 0 : 1);
})();
