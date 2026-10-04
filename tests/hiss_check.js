// The Hiss setting really turns the Dynamic voice's consonant noise on and off. Measures the cue's own output for 8 s:
// with the hiss on at its loudest setting some short windows must carry extra energy above 2.5 kHz (about 5 dB or more over anything without it), with it off none may.
const { chromium } = require('playwright');
const path = require('path');
async function measure(browser, hiss, db) {
  const p = await browser.newPage();
  await p.addInitScript(([h, d]) => {
    localStorage.setItem('mice.timbre', JSON.stringify('dynamic')); localStorage.setItem('mice.hiss', JSON.stringify(h)); localStorage.setItem('mice.hissDb', JSON.stringify(d));
    const oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dst, ...r) { if (typeof AudioDestinationNode !== 'undefined' && dst instanceof AudioDestinationNode && !window.__src) window.__src = this; return oc.call(this, dst, ...r); };
  }, [hiss, db]);
  await p.goto('file://' + path.resolve(process.env.PAGE || path.join(__dirname, '..', 'index.html')));
  const r = await p.evaluate(async () => {
    document.getElementById('pad').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
    const ctx = window.__src.context, an = ctx.createAnalyser(); an.fftSize = 2048; window.__src.connect(an);
    const fb = new Float32Array(an.frequencyBinCount), bin = (f) => Math.round(f * 2048 / ctx.sampleRate); let n = 0;
    for (let i = 0; i < 160; i++) {
      await new Promise((r) => setTimeout(r, 50)); an.getFloatFrequencyData(fb);
      let lo = 0, hi = 0; for (let j = bin(100); j < bin(2000); j++) lo += Math.pow(10, fb[j] / 10); for (let j = bin(2500); j < bin(5500); j++) hi += Math.pow(10, fb[j] / 10);
      if (10 * Math.log10((hi + 1e-12) / (lo + 1e-12)) > -32) n++;
    }
    document.getElementById('pad').dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    return { n, boxHidden: document.getElementById('hissBox').hidden };
  });
  await p.close(); return r;
}
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const on = await measure(b, true, -4), off = await measure(b, false, -4);
  await b.close();
  const ok = on.n > 0 && off.n === 0 && !on.boxHidden;
  console.log('windows with hiss: on (loudest)', on.n, '| off', off.n, '| hiss controls visible for Dynamic voice:', !on.boxHidden);
  console.log(ok ? 'HISS OK' : 'HISS FAIL'); process.exit(ok ? 0 : 1);
})();
