// Turns an HTML document into a PNG, using the Chromium build Playwright installs. There is no
// rasteriser in this environment — no ImageMagick, no librsvg, no cairo, no matplotlib — so the
// browser is the only thing that can draw a figure with real fonts, and Vietnamese diacritics make
// a hand-rolled bitmap font a poor substitute.
//
// It must be `headless_shell`, not `chrome --headless`. Measured in this container: `chrome` paints
// only the box outlines and drops all text and fills, even with a virtual time budget and software
// rasterisation forced; `headless_shell` renders correctly. A figure that comes out as empty boxes
// in a document shaped like a dossier is evidence quietly replaced by a blank.
//
// Missing browser fails loudly. Dropping the figure and rendering the rest would produce a document
// whose reader cannot tell a section has lost its diagram, which is the one outcome worse than an
// error, and is why verify.mjs already refuses to run without its schema validator.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class FigureRenderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FigureRenderError";
    this.code = code;
  }
}

const BROWSER_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
const SHELL_SUFFIX = join("chrome-linux", "headless_shell");

// Installed under a versioned directory, so search rather than pin: a browser update renames it.
function browserCandidates() {
  const found = [];
  if (process.env.PHARMA_DEV_HEADLESS_SHELL) found.push(process.env.PHARMA_DEV_HEADLESS_SHELL);
  if (existsSync(BROWSER_ROOT)) {
    for (const entry of readdirSync(BROWSER_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.includes("headless_shell")) {
        found.push(join(BROWSER_ROOT, entry.name, SHELL_SUFFIX));
      }
    }
  }
  return found;
}

export function findHeadlessShell() {
  const candidates = browserCandidates();
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new FigureRenderError(
      "E_BROWSER_MISSING",
      `Chromium headless_shell not found (checked: ${candidates.join(", ") || "nothing under " + BROWSER_ROOT}). ` +
      "Set PHARMA_DEV_HEADLESS_SHELL to its path. Rendering stops rather than omitting a figure.",
    );
  }
  return found;
}

// `width`/`height` are CSS pixels; the shot is taken at twice that so the figure stays sharp when
// Word scales it onto the page.
export function htmlToPng(html, { width, height, scale = 2 }) {
  const shell = findHeadlessShell();
  const workDir = mkdtempSync(join(tmpdir(), "pharma-dev-figure-"));
  const htmlPath = join(workDir, "figure.html");
  const pngPath = join(workDir, "figure.png");
  try {
    writeFileSync(htmlPath, html, "utf8");
    execFileSync(shell, [
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      // Without a time budget the shot is taken mid-paint and comes out partly drawn.
      "--virtual-time-budget=5000",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      "--default-background-color=FFFFFFFF",
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ], { stdio: "pipe", timeout: 60000 });
    if (!existsSync(pngPath)) {
      throw new FigureRenderError("E_FIGURE_NOT_DRAWN", `the browser produced no image for a ${width}x${height} figure`);
    }
    const png = readFileSync(pngPath);
    // A blank page still writes a valid PNG, so check the file carries something. The threshold is
    // deliberately low: it catches "nothing was drawn", not "the drawing is wrong".
    if (png.length < 512) {
      throw new FigureRenderError("E_FIGURE_BLANK", `the browser produced an empty ${png.length}-byte image`);
    }
    return png;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

// Wraps SVG markup in a minimal page. The font stack names what this container actually has, with
// the generic family last so the figure still draws on a machine with a different font set.
export function svgToPng(svg, { width, height, scale = 2 } = {}) {
  const html = `<!doctype html><meta charset="utf-8">` +
    `<body style="margin:0;background:#fff;font-family:'DejaVu Sans','Liberation Sans',sans-serif">${svg}</body>`;
  return htmlToPng(html, { width, height, scale });
}

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
