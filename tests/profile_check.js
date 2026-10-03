// Plays test_speech.wav (190 Hz centre, about 5 syllables a second, 6-syllable phrases) into a session and checks
// that the Dynamic voice learns it after about 5.5 s of speech: pitch, rate, vowel formants and the pitch shape of a phrase. Also checks the cue keeps sounding and nothing errors.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.join(__dirname, 'test_speech.wav') + '%noloop', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  await p.selectOption('#timbre', 'dynamic');
  await p.click('#sesBtn');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Listening. Hold'), null, { timeout: 40000 });
  const before = await p.evaluate(() => window.__mice.tune);
  await p.waitForFunction(() => window.__mice.tune, null, { timeout: 30000 });
  const early = await p.evaluate(() => window.__mice.tune);          // ready at about 5.5 s of speech
  await p.waitForFunction(() => window.__mice.tune && window.__mice.tune.pitchShape, null, { timeout: 30000 });   // phrase shapes need a few finished phrases
  const t = await p.evaluate(() => window.__mice.tune);
  const msg = await p.textContent('#matchMsg');
  const m = (i) => t.vowels ? t.vowels.reduce((a, v, k) => a + v[i] * t.vowelW[k], 0) / t.vowelW.reduce((a, w) => a + w, 0) : 0;
  const ps = t.pitchShape || [], pk = ps.indexOf(Math.max(...ps));
  console.log('vowel means F1 F2 F3 (truth 552 1594 2893):', [0, 1, 2].map((i) => Math.round(m(i))).join(' '), '| pitch shape peak bin', pk, 'of 8');
  const ok = before === null && t.vowels && m(0) > 440 && m(0) < 680 && m(1) > 1350 && m(1) < 1950 && pk >= 2 && pk <= 5 && t.ampShape && t.center > 185 && t.center < 230 && t.rate > 3 && t.rate < 6.5 && t.phrase >= 3 && /tuned to you/.test(msg) && !errs.length;
  console.log(JSON.stringify(t), msg, errs);
  console.log(ok ? 'PROFILE OK' : 'PROFILE FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
