// The experimental auto cue: starts the cue when speech starts, never on noise, and the meter records the real delay.
//   voice with bursts at known times: one start per burst, measured delay small, no false starts, nothing when switched off
//   no voice (quiet room, rising hiss, hum, cue leaking into a silent room): no starts at all
//   a room that gets 20 dB noisier after start-up, with rustles: no starts without voice, one start per burst with voice
//   loud sounds that are not voice (a clap, a thump): the cue may start but must be dropped again and counted as a false start
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
  await p.waitForFunction(() => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 13.4; }, null, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const m = window.__mice.meter;
    const cp = window.__mice.capture, base = cp.an.timeOf(0);
    return { at: window.__mice.autoLog.map((x) => +(x - base).toFixed(2)), starts: m.starts, n: m.n, mean: m.n ? +(m.sum / m.n).toFixed(1) : null, min: m.n ? +m.min.toFixed(1) : null, max: m.n ? +m.max.toFixed(1) : null, falseStarts: m.falseStarts,
      text: document.getElementById('meterStart').textContent, hear: document.getElementById('meterHear').textContent, shown: !document.getElementById('autoMeter').hidden };
  });
  let afterReset = null;
  if (resetMid) { await p.click('#meterReset'); afterReset = await p.evaluate(() => ({ n: window.__mice.meter.n, starts: window.__mice.meter.starts })); }
  await b.close(); return { ...r, afterReset, errs };
}
(async () => {
  const res = {};
  res.voice = await run('test_voice.wav', '', true, true);
  res.voiceBleed = await run('test_voice.wav', '?simbleed=0.08&simdelay=17.3', true, false);
  res.off = await run('test_voice.wav', '', false, false);
  res.silence = await run('test_silence.wav', '?simbleed=0.08&simdelay=17.3', true, false);
  res.hiss = await run('test_noise_rise.wav', '', true, false);
  res.hum = await run('test_hum.wav', '', true, false);
  res.slam = await run('test_slam.wav', '', true, false);
  res.rustle = await run('test_rustle.wav', '', true, false);
  res.noisyVoice = await run('test_noisy_voice.wav', '', true, false);
  for (const [k, v] of Object.entries(res)) console.log(k.padEnd(10), JSON.stringify({ at: v.at, starts: v.starts, n: v.n, mean: v.mean, min: v.min, max: v.max, falseStarts: v.falseStarts, errs: v.errs }));
  console.log(res.voice.text); console.log(res.voice.hear);
  const v = res.voice, vb = res.voiceBleed;
  const nv = res.noisyVoice, ru = res.rustle;
  console.log('noisy room: rustle only starts', ru.starts, '| with voice starts', nv.starts, 'false', nv.falseStarts, 'at', JSON.stringify(nv.at));
  const sl = res.slam;      // a clap and a thump may start the cue (nothing can tell yet), but both must be dropped as false starts
  console.log('slam: starts', sl.starts, 'false starts', sl.falseStarts);
  const noisyOk = ru.starts === 0 && nv.starts === 6 && nv.n >= 6 && nv.falseStarts <= 1 && nv.at.every((x) => x < 11.8 || x > 13.4 ? true : false);
  const ok = noisyOk && sl.falseStarts === sl.starts && sl.n === 0 && v.starts === 6 && v.n >= 5 && v.mean < 80 && v.falseStarts === 0 && v.shown && v.afterReset.n === 0 && v.afterReset.starts === 0
    && vb.starts === 6 && vb.n >= 5 && vb.falseStarts === 0
    && res.off.starts === 0 && res.silence.starts === 0 && res.hiss.starts === 0 && res.hum.starts === 0
    && Object.values(res).every((x) => !x.errs.length);
  console.log(ok ? 'AUTO OK' : 'AUTO FAIL'); process.exit(ok ? 0 : 1);
})();
