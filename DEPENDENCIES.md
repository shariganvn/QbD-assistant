# Dependencies

Status: active · Updated: 2026-07-22

This file is the dependency register for runtime, package, and platform decisions. The committed
lockfile remains the exact package-install source of truth; this register explains why a dependency
exists, where it runs, and which gate verifies it.

## Supported runtime baseline

The supported Windows deployment is **Windows host + WSL2 Ubuntu runtime**. Run Node, npm,
LiteParse, document conversion, ingest, renderer verification, and the offline gate inside WSL2.
Keep the repository under the Linux filesystem (for example `~/projects/QbD-assistant`), not
`/mnt/c`, to preserve Linux permission and symlink behavior used by the boundary tests. Windows
applications may open the generated DOCX through `\\wsl$`.

Native Windows execution is not currently supported: the current ingest defaults, input builder,
and render spike contain Linux paths or process commands. A future native-Windows port requires a
separate approved plan and passing replacement offline-isolation evidence; it is not achieved by
installing Windows equivalents alone.

## Runtime dependencies

| Dependency | Baseline / pinned version | WSL2 Ubuntu provisioning | Purpose and verification |
|---|---|---|---|
| Node.js + npm | Node 22 LTS; current verified runtime `v22.22.2` | Install Node 22 in WSL; run `npm ci` | Executes all kit scripts. |
| `docx` | `9.7.1` exact in `package.json` | Installed by `npm ci` | Layer C OOXML renderer; G-P3-01 through G-P3-05 verify its contract, fidelity, isolation, deterministic output, and viewer evidence. |
| `jszip` | `3.10.1` exact in `package.json` | Installed by `npm ci` | Deterministic Layer C post-processing: rewrites relationship IDs per OOXML relationship part and fixes core-property timestamps; verified by G-P3-05. |
| `@llamaindex/liteparse` | lockfile-resolved `2.5.0` | Installed by `npm ci` | Layer A extraction through the repo-local `lit` CLI. |
| LibreOffice | `soffice` | `sudo apt install libreoffice` | Markdown-to-DOCX input build and ingest prerequisite probe. |
| Ghostscript | `gs` | `sudo apt install ghostscript` | LiteParse PDF conversion support and ingest prerequisite probe. |
| Tesseract language data | `eng` and `vie` tessdata | `sudo apt install tesseract-ocr tesseract-ocr-vie` | Required by the current ingest prerequisite configuration; OCR execution remains deferred. |
| Bubblewrap | `bwrap` `0.11.1` (verified 2026-07-23) | `sudo apt install bubblewrap` | Required by G-P3-04 for the isolated offline renderer run. Version retained from fresh G-P3-04 evidence. |

## Windows-host procedure

1. Enable WSL2 and install an Ubuntu distribution.
2. Clone the repository inside the WSL home directory.
3. Provision the packages listed above inside WSL, then run `npm ci` there.
4. Execute `npm run inputs:build`, `npm run ingest`, `npm run render`, and verification from the WSL shell.
5. Open `cowork-p2-kit/outputs/p2-draft.docx` with Word or LibreOffice on the Windows host for the Phase 3 viewer checklist.

## Change-control rule

Any dependency addition, removal, version pin change, package-manager change, binary-path change,
or runtime-platform change must update this register in the same change with:

- owner/module and the reason for the dependency;
- exact package or binary version and install source;
- affected gate, test, and offline/egress implications; and
- an executable verification command.

Create a dated record under `docs/decisions/` as well when the change alters a security boundary,
offline behavior, data handling, or the supported runtime baseline. Do not silently switch to a
native Windows runner, a fallback renderer, or a new external binary.
