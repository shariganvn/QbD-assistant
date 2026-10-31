# Kho Fingerprint Offline

One HTML file, `index.html`, that does in a browser what `python -m qbd_core kho-fingerprint` does,
for machines where commands cannot be run. It reads the Kho files on the machine, writes hashes of
every 8-word window of class B and C text, and runs a leak trap on the text it just read.

Nothing leaves the page: the content security policy is `default-src 'none'` with no `connect-src`,
and the code holds no `fetch`, `XMLHttpRequest`, `WebSocket` or `sendBeacon`. No text, page or file
name is written to the output.

## Use
1. Get approval from the head of R&D that hash files (no text) may leave the machine.
2. Open `index.html` in a current Chrome or Edge (needs `DecompressionStream` and folder pick).
3. Pick the **folder** with the downloaded Kho files in the first box (the page then shows how many
   files it holds; the browser asks to confirm the upload, which stays on this machine), then
   `classification-manifest.xlsx` (sheet `Manifest`) and `docs/kho/manifest.json` in the other two. Classes default to `B,C`; class A is refused.
4. "Sinh dấu vân tay", then download `fingerprints.json`. It is a manifest the egress gate loads as
   is, with the salt it was built with. Keep it outside any git work tree.
5. "Chạy bẫy", then download `g-03-trap-report.txt` (counts only). Send back the report, and the
   fingerprints file only with the approval in step 1.

The page stops and offers no file when no document at all could be fingerprinted (the message
lists the skip reasons, e.g. every file `not_found` when the wrong box or folder was chosen),
when the first box holds a plain file instead of a folder, and when the manifest is unreadable, a class in the table differs from
the manifest, the table is unreadable, or class A is asked for (same as the command, exit 13).

## Same output as the command
For `.docx` the page and the command give identical bytes (tested, with and without salt and with
decomposed accents). For `.pdf` the page uses pdf.js and the command uses `pdftotext -layout`;
line joins and hyphenation can differ, so a few windows differ and a copied passage of several
lines is still caught. Only verbatim 8-word overlap is caught, never paraphrase.

## Build
`index.html` is built, do not edit it. Sources are `src/template.html` and `src/app.js`, plus
`casefold-table.json` (made by `gen-casefold.py` from Python's `str.casefold`).

```
npm i pdfjs-dist@4.10.38 --ignore-scripts      # Apache-2.0, in a scratch folder
node build.mjs <that folder>/node_modules/pdfjs-dist/build
```
The hashes of the embedded pdf.js files are in the comment at the top of `index.html`.

## Tests
`python -m pytest qbd_core/tests/test_kho_fingerprint_offline.py` drives the page in headless
Chromium from `file://` (needs `node` and `playwright`; the tests skip when they are missing).
