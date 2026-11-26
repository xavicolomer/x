const { chromium } = require('playwright');
(async () => {
  const path = require('path'), fs = require('fs');
  const file = 'file://' + path.resolve(__dirname, '..', 'dist', 'nido.html');
  const out = path.join(__dirname, 'output'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const run = async (label, fn, userDir) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
    let blocked = 0;
    await ctx.route('**/*', r => { if (r.request().url().startsWith('file:') || r.request().url().startsWith('blob:') || r.request().url().startsWith('data:')) return r.continue(); blocked++; return r.abort(); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(label, 'pageerror:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log(label, 'console:', m.text()); });
    await fn(page, ctx);
    console.log(label, 'network requests blocked:', blocked);
    return ctx;
  };
  const c = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error('missing ' + s); e.click(); }, sel);
  const w = (page, ms = 600) => page.waitForTimeout(ms);
  let saved;
  const ctx1 = await run('A', async (page) => {
    await page.goto(file + '#rooms'); await w(page, 2500);
    console.log('who:', await page.textContent('#who'), '| font:', await page.evaluate(() => document.fonts.check('800 22px "Bricolage Grotesque"')));
    await c(page, '[data-new-room]'); await w(page, 300); await c(page, '[data-tpl="flat"]'); await page.fill('#nr-name', 'Piso offline');
    await c(page, '#nr button[type=submit]'); await w(page, 4500);
    await page.selectOption('#st-room', await page.evaluate(() => [...document.querySelectorAll('#st-room option')].find(o => o.textContent === 'Nursery').value)); await w(page, 1500);
    await c(page, '[data-act="addfurn"]'); await w(page, 500);        // the Room tab's tree: + Add furniture
    await page.fill('#pick-q', 'gulliver'); await page.dispatchEvent('#pick-q', 'input'); await w(page, 300);
    await c(page, '#pick-grid [data-add^="shop:ikea-es"]'); await c(page, '#dlg [data-close]'); await w(page, 1200);
    await page.screenshot({ path: path.join(out, 'o1-editor.png') });
    await c(page, '#st-pub'); await page.waitForFunction(() => document.querySelector('#st-pub') && document.querySelector('#st-pub').textContent.includes('Update'), null, { timeout: 60000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), c(page, '#st-dl')]);
    saved = path.join(out, dl.suggestedFilename());
    await dl.saveAs(saved);
    console.log('downloaded', dl.suggestedFilename());
    await c(page, '#st-back'); await w(page, 500);
    // reload: is it still there?
    await page.reload(); await w(page, 2500);
    await page.evaluate(() => { location.hash = 'explore'; }); await w(page, 1500);
    console.log('explore after reload:', (await page.textContent('#gallery')).replace(/\s+/g, ' ').slice(0, 120));
    await page.screenshot({ path: path.join(out, 'o2-explore.png') });
    await page.evaluate(() => { location.hash = 'catalogue'; }); await w(page, 800);
    console.log('catalogue cards:', await page.evaluate(() => document.querySelectorAll('#catalogue .card').length));
  });
  // a different browser profile opens the downloaded file

  const j = JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log('file:', j.app, j.home.rooms.length, 'rooms,', Object.keys(j.assets).length, 'pictures,', Math.round(fs.statSync(saved).size / 1024), 'KB');
  await run('B', async (page) => {
    await page.goto(file + '#rooms'); await w(page, 2500);
    await page.setInputFiles('#import-file', saved); await w(page, 4500);
    console.log('B opened:', await page.textContent('#st-title'), '|', await page.textContent('#peek-s'));
    await c(page, '#st-back'); await w(page, 800);
    console.log('B card has picture:', await page.evaluate(() => !!document.querySelector('#my-rooms img[src^="blob:"]')));
    await page.screenshot({ path: path.join(out, 'o3-imported.png') });
  });
  await browser.close();
})();
