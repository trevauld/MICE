// The experimental auto cue with its setup (the room for 4 s, then about 2 s of the user's voice) and its latency meter.
// Files (see make_test_audio.py): quiet while the app starts and the room is measured, speech from 11 s, test content from 22 s.
//   cal_voice_quiet / cal_voice_noisy   setup completes, then one start per voice burst with a small measured delay and no false starts (also with the cue leaking into the microphone)
//   cal_rustle_noisy, cal_hiss_quiet    setup completes, then nothing starts on rustle, or on hiss that gets louder like a phone raising its gain
//   cal_slam_quiet                      a clap and a thump may start the cue, but each must be dropped again as a false start
//   cal_close                           noise as loud as the voice: the setup must refuse, and nothing may start
//   not switched on                     nothing starts, no setup is run
const { chromium } = require('playwright');
const path = require('path');
async function run(wav, query, auto, resetMid) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.join(__dirname, wav) + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')) + query);
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  if (auto) await p.check('#auto');
  await p.waitForFunction(() => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 21.5; }, null, { timeout: 90000 });
  const setup = await p.evaluate(() => { const c = window.__mice.cal; return { stage: c ? c.stage : null, res: c && c.res ? Object.fromEntries(Object.entries(c.res).map(([k, v]) => [k, +v.toFixed(1)])) : null, text: document.getElementById('autoCal').textContent }; });
  await p.waitForFunction(() => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 30.5; }, null, { timeout: 90000 });
  const r = await p.evaluate(() => {
    const m = window.__mice.meter, cp = window.__mice.capture, base = cp.an.timeOf(0);
    return { at: window.__mice.autoLog.map((x) => +(x - base).toFixed(1)), starts: m.starts, n: m.n, mean: m.n ? +(m.sum / m.n).toFixed(1) : null, min: m.n ? +m.min.toFixed(1) : null, max: m.n ? +m.max.toFixed(1) : null,
      falseStarts: m.falseStarts, ignored: m.ignored, text: document.getElementById('meterStart').textContent, hear: document.getElementById('meterHear').textContent, shown: !document.getElementById('autoMeter').hidden };
  });
  let afterReset = null;
  if (resetMid) { await p.click('#meterReset'); afterReset = await p.evaluate(() => ({ n: window.__mice.meter.n, starts: window.__mice.meter.starts })); }
  await b.close(); return { ...r, setup, afterReset, errs };
}
(async () => {
  const res = {};
  res.voice = await run('cal_voice_quiet.wav', '', true, true);
  res.voiceBleed = await run('cal_voice_quiet.wav', '?simbleed=0.08&simdelay=17.3', true, false);
  res.noisy = await run('cal_voice_noisy.wav', '', true, false);
  res.rustle = await run('cal_rustle_noisy.wav', '', true, false);
  res.hiss = await run('cal_hiss_quiet.wav', '', true, false);
  res.slam = await run('cal_slam_quiet.wav', '', true, false);
  res.close = await run('cal_close.wav', '', true, false);
  res.off = await run('cal_voice_quiet.wav', '', false, false);
  for (const [k, v] of Object.entries(res)) console.log(k.padEnd(10), JSON.stringify({ setup: v.setup.stage, at: v.at, starts: v.starts, n: v.n, mean: v.mean, range: [v.min, v.max], false: v.falseStarts, ignored: v.ignored, errs: v.errs }));
  console.log(JSON.stringify(res.voice.setup.res)); console.log(res.voice.setup.text); console.log(res.voice.text); console.log(res.voice.hear); console.log(res.close.setup.text);
  // starts from 11 to 21 s are the speech used for the setup (the cue is allowed to start on it once the setup is done); the test content is after 21 s
  const after = (r) => r.at.filter((t) => t > 21);
  const ready = (r) => r.setup.stage === 'ready' && r.setup.res.gap >= 6;
  const good = (r) => ready(r) && after(r).length === 6 && r.falseStarts === 0;
  const v = res.voice;
  const ok = good(v) && v.mean < 80 && v.shown && v.afterReset.n === 0 && v.afterReset.starts === 0
    && good(res.voiceBleed) && good(res.noisy)
    && ready(res.rustle) && after(res.rustle).length === 0 && res.rustle.falseStarts === 0 && ready(res.hiss) && after(res.hiss).length === 0 && res.hiss.falseStarts === 0
    && ready(res.slam) && res.slam.falseStarts >= 1 && after(res.slam).length === res.slam.falseStarts
    && res.close.setup.stage !== 'ready' && res.close.starts === 0
    && res.off.setup.stage === null && res.off.starts === 0
    && Object.values(res).every((x) => !x.errs.length);
  console.log(ok ? 'AUTO OK' : 'AUTO FAIL'); process.exit(ok ? 0 : 1);
})();
