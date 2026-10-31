// Drives index.html in headless Chromium from file:// for the pytest cross-checks.
//   node run-browser.mjs run <json args>     -> prints one JSON result
//   node run-browser.mjs eval <json args>    -> evaluates parity vectors inside the page
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(resolve(here, '..', 'index.html')).href;
const [mode, raw] = process.argv.slice(2);
const args = JSON.parse(raw || '{}');

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const requests = [];
const errors = [];
page.on('request', (r) => { if (!r.url().startsWith('blob:') && !r.url().startsWith('data:') && r.url() !== pageUrl) requests.push(r.url()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pageUrl);

async function out(result) {
  console.log(JSON.stringify({ ...result, requests, errors }));
  await browser.close();
}

if (mode === 'eval') {
  const result = await page.evaluate(async (a) => {
    const K = window.KhoFp;
    const res = {};
    if (a.texts) res.shingles = await Promise.all(a.texts.map(async ([text, salt]) => [...(await K.shinglesAsync(text, salt))].sort()));
    if (a.words) res.words = a.words.map((t) => K.words(t));
    if (a.sha) {
      const enc = new TextEncoder();
      res.sha = a.sha.map((s) => K.sha256Hex(enc.encode(s)));
    }
    if (a.wordRanges) {
      res.wordCps = [];
      for (let cp = 0; cp <= 0x10ffff; cp++) {
        if (cp >= 0xd800 && cp <= 0xdfff) continue;
        if (K.isWordCp(cp)) res.wordCps.push(cp);
      }
    }
    if (a.checks) {
      res.checks = a.checks.map(({ manifest, parts }) => K.checkEgress(K.parseManifest(JSON.stringify(manifest)), 'remote', parts).reasons);
    }
    return res;
  }, args);
  await out(result);
} else {
  const set = async (selector, paths) => page.setInputFiles(selector, paths);
  if (args.folderAsFile) {
    // a plain file dropped into the folder box: no relative path, like a drag and drop
    const b64 = readFileSync(args.folderAsFile).toString('base64');
    await page.evaluate((data) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'dropped.xlsx'));
      const input = document.getElementById('folder');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
    }, b64);
  } else {
    await set('#folder', args.folder);
  }
  await set('#table', args.table);
  if (args.manifest) await set('#manifest', args.manifest);
  if (args.classes !== undefined) await page.fill('#classes', args.classes);
  if (args.salt) await page.fill('#salt', args.salt);
  await page.click('#go');
  await page.waitForFunction(() => /^(Xong|Dừng)/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
  const status = await page.textContent('#status');
  const result = { status, shown: await page.textContent('#out') };
  if (status.startsWith('Xong')) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dl-fp')]);
    await download.saveAs(args.saveTo);
    if (args.trap) {
      await page.click('#run-trap');
      result.trap = await page.textContent('#trap-out');
      const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#dl-trap')]);
      await d2.saveAs(args.trapTo);
    }
  } else {
    result.downloadVisible = await page.isVisible('#dl-fp');
  }
  result.csp = await page.getAttribute('meta[http-equiv=Content-Security-Policy]', 'content');
  await out(result);
}
