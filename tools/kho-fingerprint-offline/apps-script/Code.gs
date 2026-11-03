// Built by build.py from Code.template.gs; edit the template, not this file.
/**
 * Kho fingerprint, Google Apps Script edition.
 *
 * Reads the class B and C files of the Kho from Drive, computes the same word-window hashes as
 * `python -m qbd_core kho-fingerprint` and the offline page, and writes them into a Drive folder.
 * Nothing is downloaded to a computer and the project holds no scope that can reach outside Google
 * (see appsscript.json: no external_request scope). Text of the files only lives in memory and in
 * temporary Google Docs that are deleted right after reading.
 *
 * Steps: see README.md next to this file. Run selfTest, pilot, then runBatch until it says done,
 * then finalize.
 */

const CONFIG = {
  TABLE_SHEET_ID: '', // Google Sheet made from kho-manifest-phan-loai.xlsx (sheet "Manifest")
  MANIFEST_FILE_ID: '', // docs/kho/manifest.json uploaded to Drive
  OUT_FOLDER_NAME: 'kho-fingerprints',
  CLASSES: ['B', 'C'],
  SALT: '',
  BATCH_SECONDS: 270,
  OCR_LANGUAGE: 'vi',
};

const SHINGLE_WORDS = 8;
const CASEFOLD = {"181":"\u03bc","223":"ss","329":"\u02bcn","383":"s","496":"j\u030c","837":"\u03b9","912":"\u03b9\u0308\u0301","944":"\u03c5\u0308\u0301","962":"\u03c3","976":"\u03b2","977":"\u03b8","981":"\u03c6","982":"\u03c0","1008":"\u03ba","1009":"\u03c1","1013":"\u03b5","1415":"\u0565\u0582","5024":"\u13a0","5025":"\u13a1","5026":"\u13a2","5027":"\u13a3","5028":"\u13a4","5029":"\u13a5","5030":"\u13a6","5031":"\u13a7","5032":"\u13a8","5033":"\u13a9","5034":"\u13aa","5035":"\u13ab","5036":"\u13ac","5037":"\u13ad","5038":"\u13ae","5039":"\u13af","5040":"\u13b0","5041":"\u13b1","5042":"\u13b2","5043":"\u13b3","5044":"\u13b4","5045":"\u13b5","5046":"\u13b6","5047":"\u13b7","5048":"\u13b8","5049":"\u13b9","5050":"\u13ba","5051":"\u13bb","5052":"\u13bc","5053":"\u13bd","5054":"\u13be","5055":"\u13bf","5056":"\u13c0","5057":"\u13c1","5058":"\u13c2","5059":"\u13c3","5060":"\u13c4","5061":"\u13c5","5062":"\u13c6","5063":"\u13c7","5064":"\u13c8","5065":"\u13c9","5066":"\u13ca","5067":"\u13cb","5068":"\u13cc","5069":"\u13cd","5070":"\u13ce","5071":"\u13cf","5072":"\u13d0","5073":"\u13d1","5074":"\u13d2","5075":"\u13d3","5076":"\u13d4","5077":"\u13d5","5078":"\u13d6","5079":"\u13d7","5080":"\u13d8","5081":"\u13d9","5082":"\u13da","5083":"\u13db","5084":"\u13dc","5085":"\u13dd","5086":"\u13de","5087":"\u13df","5088":"\u13e0","5089":"\u13e1","5090":"\u13e2","5091":"\u13e3","5092":"\u13e4","5093":"\u13e5","5094":"\u13e6","5095":"\u13e7","5096":"\u13e8","5097":"\u13e9","5098":"\u13ea","5099":"\u13eb","5100":"\u13ec","5101":"\u13ed","5102":"\u13ee","5103":"\u13ef","5104":"\u13f0","5105":"\u13f1","5106":"\u13f2","5107":"\u13f3","5108":"\u13f4","5109":"\u13f5","5112":"\u13f0","5113":"\u13f1","5114":"\u13f2","5115":"\u13f3","5116":"\u13f4","5117":"\u13f5","7296":"\u0432","7297":"\u0434","7298":"\u043e","7299":"\u0441","7300":"\u0442","7301":"\u0442","7302":"\u044a","7303":"\u0463","7304":"\ua64b","7830":"h\u0331","7831":"t\u0308","7832":"w\u030a","7833":"y\u030a","7834":"a\u02be","7835":"\u1e61","7838":"ss","8016":"\u03c5\u0313","8018":"\u03c5\u0313\u0300","8020":"\u03c5\u0313\u0301","8022":"\u03c5\u0313\u0342","8064":"\u1f00\u03b9","8065":"\u1f01\u03b9","8066":"\u1f02\u03b9","8067":"\u1f03\u03b9","8068":"\u1f04\u03b9","8069":"\u1f05\u03b9","8070":"\u1f06\u03b9","8071":"\u1f07\u03b9","8072":"\u1f00\u03b9","8073":"\u1f01\u03b9","8074":"\u1f02\u03b9","8075":"\u1f03\u03b9","8076":"\u1f04\u03b9","8077":"\u1f05\u03b9","8078":"\u1f06\u03b9","8079":"\u1f07\u03b9","8080":"\u1f20\u03b9","8081":"\u1f21\u03b9","8082":"\u1f22\u03b9","8083":"\u1f23\u03b9","8084":"\u1f24\u03b9","8085":"\u1f25\u03b9","8086":"\u1f26\u03b9","8087":"\u1f27\u03b9","8088":"\u1f20\u03b9","8089":"\u1f21\u03b9","8090":"\u1f22\u03b9","8091":"\u1f23\u03b9","8092":"\u1f24\u03b9","8093":"\u1f25\u03b9","8094":"\u1f26\u03b9","8095":"\u1f27\u03b9","8096":"\u1f60\u03b9","8097":"\u1f61\u03b9","8098":"\u1f62\u03b9","8099":"\u1f63\u03b9","8100":"\u1f64\u03b9","8101":"\u1f65\u03b9","8102":"\u1f66\u03b9","8103":"\u1f67\u03b9","8104":"\u1f60\u03b9","8105":"\u1f61\u03b9","8106":"\u1f62\u03b9","8107":"\u1f63\u03b9","8108":"\u1f64\u03b9","8109":"\u1f65\u03b9","8110":"\u1f66\u03b9","8111":"\u1f67\u03b9","8114":"\u1f70\u03b9","8115":"\u03b1\u03b9","8116":"\u03ac\u03b9","8118":"\u03b1\u0342","8119":"\u03b1\u0342\u03b9","8124":"\u03b1\u03b9","8126":"\u03b9","8130":"\u1f74\u03b9","8131":"\u03b7\u03b9","8132":"\u03ae\u03b9","8134":"\u03b7\u0342","8135":"\u03b7\u0342\u03b9","8140":"\u03b7\u03b9","8146":"\u03b9\u0308\u0300","8147":"\u03b9\u0308\u0301","8150":"\u03b9\u0342","8151":"\u03b9\u0308\u0342","8162":"\u03c5\u0308\u0300","8163":"\u03c5\u0308\u0301","8164":"\u03c1\u0313","8166":"\u03c5\u0342","8167":"\u03c5\u0308\u0342","8178":"\u1f7c\u03b9","8179":"\u03c9\u03b9","8180":"\u03ce\u03b9","8182":"\u03c9\u0342","8183":"\u03c9\u0342\u03b9","8188":"\u03c9\u03b9","43888":"\u13a0","43889":"\u13a1","43890":"\u13a2","43891":"\u13a3","43892":"\u13a4","43893":"\u13a5","43894":"\u13a6","43895":"\u13a7","43896":"\u13a8","43897":"\u13a9","43898":"\u13aa","43899":"\u13ab","43900":"\u13ac","43901":"\u13ad","43902":"\u13ae","43903":"\u13af","43904":"\u13b0","43905":"\u13b1","43906":"\u13b2","43907":"\u13b3","43908":"\u13b4","43909":"\u13b5","43910":"\u13b6","43911":"\u13b7","43912":"\u13b8","43913":"\u13b9","43914":"\u13ba","43915":"\u13bb","43916":"\u13bc","43917":"\u13bd","43918":"\u13be","43919":"\u13bf","43920":"\u13c0","43921":"\u13c1","43922":"\u13c2","43923":"\u13c3","43924":"\u13c4","43925":"\u13c5","43926":"\u13c6","43927":"\u13c7","43928":"\u13c8","43929":"\u13c9","43930":"\u13ca","43931":"\u13cb","43932":"\u13cc","43933":"\u13cd","43934":"\u13ce","43935":"\u13cf","43936":"\u13d0","43937":"\u13d1","43938":"\u13d2","43939":"\u13d3","43940":"\u13d4","43941":"\u13d5","43942":"\u13d6","43943":"\u13d7","43944":"\u13d8","43945":"\u13d9","43946":"\u13da","43947":"\u13db","43948":"\u13dc","43949":"\u13dd","43950":"\u13de","43951":"\u13df","43952":"\u13e0","43953":"\u13e1","43954":"\u13e2","43955":"\u13e3","43956":"\u13e4","43957":"\u13e5","43958":"\u13e6","43959":"\u13e7","43960":"\u13e8","43961":"\u13e9","43962":"\u13ea","43963":"\u13eb","43964":"\u13ec","43965":"\u13ed","43966":"\u13ee","43967":"\u13ef","64256":"ff","64257":"fi","64258":"fl","64259":"ffi","64260":"ffl","64261":"st","64262":"st","64275":"\u0574\u0576","64276":"\u0574\u0565","64277":"\u0574\u056b","64278":"\u057e\u0576","64279":"\u0574\u056d"};
const DRIVE_ID = /^[A-Za-z0-9_-]{33}$/;
const WORD_RE = /[\p{L}\p{N}_]+/gu;
const CLASS_NAMES = ['A', 'B', 'C', '?'];
const TMP_PREFIX = '__kho_tmp__';
const MIME_DOC = 'application/vnd.google-apps.document';
const MIME_CONVERTIBLE = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

class Fail_ extends Error {
  constructor(code, detail) {
    super(detail ? code + ': ' + detail : code);
    this.code = code;
  }
}

// ---- SHA-256 and shingles: the same definition as qbd_core egress_gate.fingerprint ----
const K_ = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W_ = new Uint32Array(64);

function utf8Bytes_(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function sha256Hex_(bytes) {
  const len = bytes.length;
  const total = (len + 9 + 63) & ~63;
  const data = new Uint8Array(total);
  data.set(bytes);
  data[len] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(total - 8, Math.floor((len * 8) / 0x100000000), false);
  view.setUint32(total - 4, (len * 8) >>> 0, false);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W_[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = W_[i - 15], b = W_[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W_[i] = (W_[i - 16] + s0 + W_[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K_[i] + W_[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(function (x) { return (x >>> 0).toString(16).padStart(8, '0'); })
    .join('');
}

function casefold_(word) {
  let out = '';
  for (const ch of word) {
    const folded = CASEFOLD[ch.codePointAt(0)];
    out += folded !== undefined ? folded : ch.toLowerCase();
  }
  return out;
}

function words_(text) {
  return (text.normalize('NFC').match(WORD_RE) || []).map(casefold_);
}

function shinglesOf_(text, salt) {
  const w = words_(text);
  const prefix = salt ? salt + '\0' : '';
  const out = {};
  for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) {
    out[sha256Hex_(utf8Bytes_(prefix + w.slice(i, i + SHINGLE_WORDS).join(' '))).slice(0, 16)] = 1;
  }
  return Object.keys(out).sort();
}

// ---- Inputs: the owner's table and the manifest ----
function parseManifest_(text) {
  let raw;
  try { raw = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return null; }
  const plain = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
  if (!plain(raw) || !Array.isArray(raw.entries)) return null;
  if (Object.keys(raw).some(function (k) { return k !== 'entries' && k !== 'salt'; })) return null;
  const keys = ['file_id', 'classification', 'approved_by', 'approved_on', 'shingles'];
  const entries = [];
  const seen = {};
  for (const e of raw.entries) {
    if (!plain(e) || Object.keys(e).some(function (k) { return keys.indexOf(k) < 0; })) return null;
    if (typeof e.file_id !== 'string' || !e.file_id || CLASS_NAMES.indexOf(e.classification) < 0) return null;
    if (seen[e.file_id]) return null;
    seen[e.file_id] = 1;
    entries.push({
      file_id: e.file_id,
      classification: e.classification,
      approved_by: e.approved_by === undefined ? null : e.approved_by,
      approved_on: e.approved_on === undefined ? null : e.approved_on,
      shingles: (e.shingles || []).slice().sort(),
    });
  }
  return entries;
}

function tableRows_(values) {
  const header = values.find(function (r) { return r.indexOf('file_id') >= 0; });
  if (!header) throw new Fail_('E_TABLE_HEADER');
  const col = {};
  header.forEach(function (v, i) { col[v] = i; });
  if (!('file_id' in col && 'file_name' in col && 'nhom' in col)) throw new Fail_('E_TABLE_HEADER');
  const rows = [];
  for (const r of values.slice(values.indexOf(header) + 1)) {
    const fileId = r[col.file_id] || '';
    if (!fileId) continue;
    if (!DRIVE_ID.test(fileId)) throw new Fail_('E_TABLE_ID', 'a file_id is not a Drive id');
    rows.push({ fileId: fileId, fileName: r[col.file_name] || '', group: r[col.nhom] || '' });
  }
  const ids = rows.map(function (r) { return r.fileId; });
  const unique = {};
  ids.forEach(function (i) { unique[i] = 1; });
  if (!rows.length || Object.keys(unique).length !== ids.length) {
    throw new Fail_('E_TABLE_ID', 'empty table or repeated file_id');
  }
  return rows;
}

function loadInputs_() {
  if (!CONFIG.TABLE_SHEET_ID || !CONFIG.MANIFEST_FILE_ID) {
    throw new Fail_('REFUSED', 'fill TABLE_SHEET_ID and MANIFEST_FILE_ID in CONFIG');
  }
  if (CONFIG.CLASSES.indexOf('A') >= 0 || !CONFIG.CLASSES.length) {
    throw new Fail_('REFUSED', 'class A files are not fingerprinted');
  }
  const entries = parseManifest_(DriveApp.getFileById(CONFIG.MANIFEST_FILE_ID).getBlob().getDataAsString('UTF-8'));
  if (!entries) throw new Fail_('REFUSED', 'the manifest is missing or unreadable');
  const sheet = SpreadsheetApp.openById(CONFIG.TABLE_SHEET_ID).getSheetByName('Manifest');
  if (!sheet) throw new Fail_('E_TABLE_UNREADABLE', 'sheet Manifest');
  const rows = tableRows_(sheet.getDataRange().getValues().map(function (r) {
    return r.map(function (v) { return String(v); });
  }));
  const known = {};
  entries.forEach(function (e) { known[e.file_id] = e.classification; });
  rows.forEach(function (r) {
    if (known[r.fileId] !== r.group) throw new Fail_('E_TABLE_MISMATCH', 'a row differs from the manifest');
  });
  return { entries: entries, rows: rows, known: known };
}

// ---- Text from Drive ----
function convertAndRead_(file, tmpFolderId) {
  let tmpId = null;
  try {
    const created = Drive.Files.create(
      { name: TMP_PREFIX + file.getId(), mimeType: MIME_DOC, parents: [tmpFolderId] },
      file.getBlob(),
      { ocrLanguage: CONFIG.OCR_LANGUAGE }
    );
    tmpId = created.id;
    return DocumentApp.openById(tmpId).getBody().getText();
  } finally {
    if (tmpId) {
      try { Drive.Files.remove(tmpId); } catch (e) { /* cleanupTemp removes leftovers */ }
    }
  }
}

function extractText_(file, tmpFolderId) {
  const mime = file.getMimeType();
  if (mime === MIME_DOC) return DocumentApp.openById(file.getId()).getBody().getText();
  if (MIME_CONVERTIBLE.indexOf(mime) >= 0) return convertAndRead_(file, tmpFolderId);
  return null;
}

// ---- Leak trap on the text just read: the same shapes as the offline page ----
const SAFE_LINES_ = [
  'Hôm nay trời nắng đẹp và chúng tôi đi dạo quanh hồ để bàn chuyện khác hoàn toàn khác biệt',
  'The quick brown fox jumps over the lazy dog while nobody is watching the quiet river bank',
  'Danh mục này liệt kê các hạng mục kiểm tra chung cho cuộc họp định kỳ của tuần sau đó',
];

function trapPayloads_(text) {
  const w = text.normalize('NFC').match(WORD_RE) || [];
  if (w.length < SHINGLE_WORDS) return [];
  const slice = function (from, n) { return w.slice(from, from + n).join(' '); };
  const mid = Math.max(0, Math.floor(w.length / 2) - 30);
  return [
    slice(0, SHINGLE_WORDS),
    slice(mid, 60),
    SAFE_LINES_[0] + '. ' + slice(Math.max(0, w.length - SHINGLE_WORDS), SHINGLE_WORDS) + '. ' + SAFE_LINES_[1],
    slice(mid, 20).toUpperCase(),
    slice(mid, 20).normalize('NFD'),
  ];
}

function runTrap_(text, hashes, salt) {
  const own = {};
  hashes.forEach(function (h) { own[h] = 1; });
  const blocks = function (payload) {
    return shinglesOf_(payload, salt).some(function (h) { return own[h]; });
  };
  const traps = trapPayloads_(text);
  const blocked = traps.filter(blocks).length;
  const controls = SAFE_LINES_.length;
  const allowed = SAFE_LINES_.filter(function (t) { return !blocks(t); }).length;
  return { traps: traps.length, blocked: blocked, controls: controls, allowed: allowed };
}

// ---- Output folder and progress ----
function outFolder_() {
  const found = DriveApp.getFoldersByName(CONFIG.OUT_FOLDER_NAME);
  return found.hasNext() ? found.next() : DriveApp.createFolder(CONFIG.OUT_FOLDER_NAME);
}

function replaceFile_(folder, name, text) {
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  return folder.createFile(name, text, 'application/json');
}

function loadProgress_(folder) {
  const found = folder.getFilesByName('progress.json');
  return found.hasNext() ? JSON.parse(found.next().getBlob().getDataAsString('UTF-8')) : {};
}

function fingerprintOne_(row, ctx) {
  let file;
  try { file = DriveApp.getFileById(row.fileId); } catch (e) { return { s: 'skip', r: 'not_found' }; }
  if (file.getName().normalize('NFC') !== row.fileName.normalize('NFC')) return { s: 'skip', r: 'name_differs' };
  let text;
  try {
    text = extractText_(file, ctx.folder.getId());
  } catch (e) {
    return { s: 'skip', r: 'convert_failed' };
  }
  if (text === null) return { s: 'skip', r: 'unsupported_type' };
  if (!/\S/.test(text)) return { s: 'skip', r: 'no_text' };
  const hashes = shinglesOf_(text, CONFIG.SALT);
  if (ctx.dryRun) {
    return { s: 'ok', n: hashes.length, words: words_(text).length, chars: text.length };
  }
  replaceFile_(ctx.folder, row.fileId + '.json', JSON.stringify({
    file_id: row.fileId, classification: row.group, shingles: hashes,
  }));
  const trap = runTrap_(text, hashes, CONFIG.SALT);
  return { s: 'ok', n: hashes.length, t: trap.traps, b: trap.blocked, c: trap.controls, a: trap.allowed };
}

// ---- Entry points ----
function selfTest() {
  const text = 'Quy trình nội bộ mô tả bước nghiền trộn bột siêu mịn trước khi dập viên Straße ﬁne';
  const plain = shinglesOf_(text, '');
  const salted = shinglesOf_(text, 'k');
  const checks = [
    ['sha256(abc)', sha256Hex_(utf8Bytes_('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['windows', plain.length === 11],
    ['hash 1', plain.slice(0, 3).join() === "50981974bb177b8f,612a14e813c892e6,73f2e5e6b55e22af"],
    ['hash salt', salted.slice(0, 3).join() === "06c7146a28f50ae3,151012f19a97852f,2420732a71c5bc7c"],
    ['casefold', words_('Straße ﬁne ΣΑΣ').join(' ') === 'strasse fine σασ'],
  ];
  checks.forEach(function (c) { Logger.log((c[1] ? 'OK   ' : 'FAIL ') + c[0]); });
  if (checks.some(function (c) { return !c[1]; })) throw new Error('selfTest failed');
  Logger.log('selfTest passed');
}

function pilot() {
  // Three class A rows, nothing written: shows that conversion works and how long it takes.
  const inputs = loadInputs_();
  const ctx = { folder: outFolder_(), dryRun: true };
  inputs.rows.filter(function (r) { return r.group === 'A'; }).slice(0, 3).forEach(function (row) {
    const t0 = Date.now();
    const result = fingerprintOne_(row, ctx);
    Logger.log(JSON.stringify(result) + ' ' + (Date.now() - t0) + ' ms');
  });
}

function runBatch() {
  const t0 = Date.now();
  const inputs = loadInputs_();
  const folder = outFolder_();
  const ctx = { folder: folder, dryRun: false };
  const progress = loadProgress_(folder);
  const todo = inputs.rows.filter(function (r) {
    return CONFIG.CLASSES.indexOf(r.group) >= 0 && !progress[r.fileId];
  });
  let handled = 0;
  for (const row of todo) {
    if (Date.now() - t0 > CONFIG.BATCH_SECONDS * 1000) break;
    progress[row.fileId] = fingerprintOne_(row, ctx);
    replaceFile_(folder, 'progress.json', JSON.stringify(progress));
    handled++;
  }
  Logger.log('handled ' + handled + ', left ' + (todo.length - handled));
  Logger.log(summary_(inputs, progress));
  if (todo.length === handled) Logger.log('done: run finalize');
}

function summary_(inputs, progress) {
  const wanted = inputs.rows.filter(function (r) { return CONFIG.CLASSES.indexOf(r.group) >= 0; });
  const ok = [], reasons = {};
  let traps = 0, blocked = 0, controls = 0, allowed = 0;
  wanted.forEach(function (r) {
    const p = progress[r.fileId];
    if (!p) return;
    if (p.s === 'ok') {
      ok.push(r);
      traps += p.t || 0; blocked += p.b || 0; controls += p.c || 0; allowed += p.a || 0;
    } else {
      reasons[p.r] = (reasons[p.r] || 0) + 1;
    }
  });
  return [
    'fingerprinted ' + ok.length + '/' + wanted.length + ', skipped ' + JSON.stringify(reasons),
    'trap: total ' + traps + ', blocked ' + blocked + ', leaked ' + (traps - blocked)
      + '; controls allowed ' + allowed + '/' + controls,
  ].join('\n');
}

function finalize() {
  const inputs = loadInputs_();
  const folder = outFolder_();
  const progress = loadProgress_(folder);
  const missing = inputs.rows.filter(function (r) {
    return CONFIG.CLASSES.indexOf(r.group) >= 0 && !progress[r.fileId];
  }).length;
  if (missing) throw new Fail_('REFUSED', missing + ' rows still to process: run runBatch');
  const entries = inputs.entries.map(function (e) {
    const p = progress[e.file_id];
    let shingles = e.shingles;
    if (p && p.s === 'ok') {
      shingles = JSON.parse(folder.getFilesByName(e.file_id + '.json').next().getBlob().getDataAsString('UTF-8')).shingles;
    }
    return {
      file_id: e.file_id, classification: e.classification,
      approved_by: e.approved_by, approved_on: e.approved_on, shingles: shingles,
    };
  });
  const text = JSON.stringify({ entries: entries, salt: CONFIG.SALT }, null, 1) + '\n';
  const report = summary_(inputs, progress);
  replaceFile_(folder, 'report.txt', report + '\n');
  if (text.length > 45 * 1024 * 1024) {
    throw new Fail_('REFUSED', 'fingerprints.json would be about ' + Math.round(text.length / 1048576)
      + ' MB, too large for one Drive write: use the per-file shards in the folder');
  }
  replaceFile_(folder, 'fingerprints.json', text);
  Logger.log(report);
  Logger.log('fingerprints.json written, ' + Math.round(text.length / 1024) + ' KB');
}

function cleanupTemp() {
  const found = DriveApp.searchFiles("title contains '" + TMP_PREFIX + "' and trashed = false");
  let n = 0;
  while (found.hasNext()) { Drive.Files.remove(found.next().getId()); n++; }
  Logger.log('temporary conversions removed: ' + n);
}

function installTrigger() {
  ScriptApp.newTrigger('runBatch').timeBased().everyMinutes(10).create();
  Logger.log('runBatch will run every 10 minutes; delete the trigger when done');
}
