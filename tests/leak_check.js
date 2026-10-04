// Another voice leaking into the microphone (a call, a voice assistant) must not teach the Dynamic voice.
// test_two_voices.wav: a higher voice (230 Hz) speaks first without the cue held; the user (120 Hz) answers while holding the cue.
//   default mode "Speech while I hold the cue": must learn about 120 Hz (the user)
//   "All speech": locks onto the first voice it hears, the wrong one (about 230 Hz). This is the failure the default prevents.
//   "Nothing": learns nothing
const { chromium } = require('playwright');
const path = require('path');
const WIN = [0, 1, 2, 3, 4, 5].map((k) => [6.5 + 5 * k, 9.0 + 5 * k]);      // the user's windows, seconds into the recording
async function run(mode) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.join(__dirname, 'test_two_voices.wav') + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (mode) await p.addInitScript((m) => { localStorage.setItem('mice.learnMode', JSON.stringify(m)); localStorage.setItem('mice.timbre', JSON.stringify('dynamic')); }, mode);
  else await p.addInitScript(() => { localStorage.setItem('mice.timbre', JSON.stringify('dynamic')); });
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  await p.evaluate((win) => {
    const cap = window.__mice.capture, base = cap.an.timeOf(0), now = cap.an.timeOf(cap.an.total);
    const fire = (type) => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    for (const [a, z] of win) {
      if (base + a - 0.3 < now) continue;                      // already past
      setTimeout(() => fire('keydown'), Math.max(0, (base + a - 0.3 - now) * 1000));
      setTimeout(() => fire('keyup'), Math.max(0, (base + z + 0.2 - now) * 1000));
    }
  }, WIN);
  await p.waitForFunction(() => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 36; }, null, { timeout: 60000 });
  const r = await p.evaluate(() => { const t = window.__mice.tune, P = window.__mice.prof; return { center: t ? Math.round(t.center) : null, sec: +P.sec.toFixed(1), msg: document.getElementById('matchMsg').textContent }; });
  await b.close(); return { ...r, errs };
}
(async () => {
  const hold = await run(null), all = await run('all'), off = await run('off');
  console.log('hold  :', JSON.stringify(hold)); console.log('all   :', JSON.stringify(all)); console.log('off   :', JSON.stringify(off));
  const ok = hold.center > 105 && hold.center < 145 && all.center > 190 && off.center === null && off.sec === 0 && !hold.errs.length;
  console.log(ok ? 'LEAK OK' : 'LEAK FAIL'); process.exit(ok ? 0 : 1);
})();
