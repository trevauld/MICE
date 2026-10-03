// Checks the PWA shell: manifest, service worker install, offline reload. Needs a server on :8077 (python3 -m http.server 8077, run in the project root).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const url = process.env.URL || 'http://localhost:8077/';
  await p.goto(url);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();                       // now controlled by the worker
  const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await p.reload();
  const title = await p.title();
  const m = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  const icons = await Promise.all(m.icons.map((i) => p.evaluate((s) => fetch(s).then((r) => r.status), i.src)));
  console.log({ controlled, offlineTitle: title, manifest: m.short_name, icons });
  const ok = controlled && title === 'MICE' && icons.every((s) => s === 200);
  console.log(ok ? 'PWA OK' : 'PWA FAIL');
  await b.close(); process.exit(ok ? 0 : 1);
})();
