// Builds index.html: src/template.html + src/app.js + casefold-table.json + pinned pdf.js.
// usage: node build.mjs <path to node_modules/pdfjs-dist/build>
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pdfDir = process.argv[2];
if (!pdfDir) { console.error('usage: node build.mjs <pdfjs-dist/build dir>'); process.exit(2); }
const lib = readFileSync(join(pdfDir, 'pdf.min.mjs'));
const worker = readFileSync(join(pdfDir, 'pdf.worker.min.mjs'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const table = readFileSync(join(here, 'casefold-table.json'), 'utf8').trim();

let app = readFileSync(join(here, 'src/app.js'), 'utf8');
const swap = (marker, tail, value) => {
  const at = app.indexOf(marker);
  if (at < 0) throw new Error(`missing ${marker}`);
  app = app.replace(marker + tail, value);
};
swap('/*CASEFOLD_TABLE*/', ' {}', table);
swap('/*PDF_LIB_B64*/', " ''", `'${lib.toString('base64')}'`);
swap('/*PDF_WORKER_B64*/', " ''", `'${worker.toString('base64')}'`);
if (app.includes('</script')) throw new Error('script end tag inside app');

const banner = `<!--
Built by build.mjs. Embeds pdfjs-dist 4.10.38 (Apache License 2.0, https://github.com/mozilla/pdf.js)
  pdf.min.mjs        sha256 ${sha(lib)}
  pdf.worker.min.mjs sha256 ${sha(worker)}
-->
`;
const page = readFileSync(join(here, 'src/template.html'), 'utf8').replace('/*APP*/', () => app);
writeFileSync(join(here, 'index.html'), banner + page);
console.log(`index.html ${(banner.length + page.length / 1).toString()} bytes`);
