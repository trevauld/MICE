// Checks the v2 interface: removed items, collapsible panels, hold keys, non-selectable pad, phone layout.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const url = 'file://' + path.resolve(process.env.PAGE || '../index.html');
  const res = {};
  let p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url);
  res.removed = await p.evaluate(() => ['cond', 'notes', 'howTitle'].every((id) => !document.getElementById(id)) && !document.querySelector('h1,.lede'));
  res.padFirst = await p.evaluate(() => document.querySelector('.wrap').firstElementChild.querySelector('#pad') !== null);
  res.userSelect = await p.evaluate(() => getComputedStyle(document.querySelector('#pad .big')).userSelect);
  res.folds = await p.evaluate(() => [...document.querySelectorAll('details.fold')].map((d) => d.open));
  await p.click('#sesFold > summary'); res.afterClick = await p.evaluate(() => document.getElementById('sesFold').open);
  res.options = await p.evaluate(() => [...document.querySelectorAll('#trigger option')].map((o) => o.value));
  for (const [k, code] of [['lctrl', 'ControlLeft'], ['lshift', 'ShiftLeft']]) {
    await p.selectOption('#trigger', k);
    res[k] = await p.evaluate((code) => { document.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, ctrlKey: code === 'ControlLeft', shiftKey: code === 'ShiftLeft', bubbles: true })); const on = document.getElementById('pad').classList.contains('on'); document.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); return on; }, code);
  }
  await p.selectOption('#trigger', 'space');
  res.spaceIgnoresCtrl = await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', key: 'Control', ctrlKey: true, bubbles: true })); return !document.getElementById('pad').classList.contains('on'); });
  await p.close();
  p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await p.goto(url);
  res.mobile = await p.evaluate(() => { const r = document.getElementById('pad').getBoundingClientRect(); return { padPct: Math.round(r.height / innerHeight * 100), padTop: Math.round(r.top), folds: [...document.querySelectorAll('details.fold')].map((d) => d.open) }; });
  console.log(JSON.stringify(res), errs);
  await b.close();
})();
