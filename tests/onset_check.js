// How well MICE finds where speech started, from the recording alone (this is the reference for the auto cue's latency meter).
// The truth is known: bursts begin at 6.0, 7.0, 7.9, 9.1, 10.3, 11.2 s of the file. Where the file sits in MICE's recording is found from a sync pulse at 5.2 s
// in each file (it differs a little on every run). Required accuracy:
//   clean room                                           every start within 5 ms
//   noisy room (20 dB more noise, with rustles)         within 15 ms: the room noise level at start-up must not matter
//   soft hiss before the voice ("s", "f" onsets)         the start must be the hiss, not the voiced part 90 ms later (within 15 ms)
const { chromium } = require('playwright');
const path = require('path');
const ONSETS = [6.0, 7.0, 7.9, 9.1, 10.3, 11.2];
async function onsets(wav) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.join(__dirname, wav) + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  await p.waitForFunction(() => { const c = window.__mice.capture; return c && c.an.timeOf(c.an.total) - c.an.timeOf(0) > 12.2; }, null, { timeout: 60000 });
  // where the file sits in MICE's recording: the sync pulse at 5.2 s is the loudest sample (the recording keeps the last 8 s, which still includes it)
  const r = await p.evaluate(() => {
    const c = window.__mice.capture, an = c.an;
    let kp = -1, mx = 0; for (let k = Math.max(0, an.total - 120000); k < an.total; k++) { const a = Math.abs(an.raw(k)); if (a > mx) { mx = a; kp = k; } }
    return { pulseAt: an.timeOf(kp), pulse: mx, onsets: window.__mice.segs.map((s) => s.on) };
  });
  await b.close(); return r;
}
(async () => {
  const run = async (wav) => { const r = await onsets(wav); const off = r.pulseAt - 5.2; return { pulse: r.pulse, errMs: r.onsets.map((t, i) => Math.round((t - off - ONSETS[i]) * 1000)) }; };
  const e = { clean: await run('onset_clean.wav'), noisy: await run('onset_noisy.wav'), fricative: await run('onset_fric.wav') };
  for (const [k, v] of Object.entries(e)) console.log(k.padEnd(10), 'pulse', v.pulse.toFixed(2), 'error ms', JSON.stringify(v.errMs));
  const good = (v, lim) => v.pulse > 0.15 && v.errMs.length === 6 && v.errMs.every((x) => Math.abs(x) <= lim);
  const ok = good(e.clean, 5) && good(e.noisy, 15) && good(e.fricative, 15);
  console.log(ok ? 'ONSET OK' : 'ONSET FAIL'); process.exit(ok ? 0 : 1);
})();
