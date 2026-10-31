# qbd_core command line

Status: active · Updated: 2026-10-21

`python -m qbd_core <command>` (Python 3.11 or later; Node is needed for the Stage B validator when a
page is rendered).

| Command | Purpose |
|---|---|
| `cqa-propose --substance S --form F --market M --out proposal.json` | Candidate CQA for the dosage-form group, bound to the input; a person fills the confirmation template. |
| `accept --cases cases.json --out-dir DIR` | Runs every acceptance case twice through `run`; writes one report per case, `g-10.txt` and `g-10-data-requests.md` only if every case met its expected exit code with identical bytes (else exit 11, nothing written; 12 unreadable cases). |
| `run --substance S [--substance S2 ...] --form F --market M --documents docs.json --out draft.json [--date YYYY-MM-DD] [--cqa-confirmation signed.json] [--render-dir DIR] [--trial-file REPORT.docx ...] [--provider-recording FILE --model NAME [--manifest FILE] [--provider-destination remote|local]]` | Build the gap-flagged draft, run the quality gate, publish `draft.json`, `draft.quality.json` and, with `--render-dir`, `p2-orientation-draft.html`. |
| `render --draft draft.json --out-dir DIR` | Render an existing draft to the HTML page. |

`--trial-file` gives the team's own trial reports. They are read by code only (never sent to a model); each table is named by its header words, and a table that matches no kind or several is listed as not recognised, never guessed.

The model agents run only with `--provider-recording` and `--model`. A model answer in the wrong shape does not stop the run: that agent's sections stay marked gaps. Evidence the egress policy does not allow is left out of the request; with none left the model is not called. Without a manifest nothing is sent to a remote destination.

Market is `eu`, `domestic` (or `trong nước`) or `both` (or `cả hai`). A combination of substances is out of
the SOP and refused.

## Exit codes of `run`

| Code | Meaning | Published files |
|---|---|---|
| 0 | Published | draft, quality report, page |
| 1 | Unexpected error | none changed |
| 2 | Input rejected (field, form, market, substance count) or `--date` not `YYYY-MM-DD` | none changed |
| 3 | Combination of substances (not supported) | none changed |
| 4 | Documents file unreadable or not a JSON list of documents | none changed |
| 5 | CQA confirmation does not match the input, or is incomplete | none changed |
| 6 | Render or page verification failed | none changed |
| 7 | Blocked by the quality gate | none changed; the report is written as `draft.quality.blocked.json` |
| 8 | Publishing failed (disk, permission) | none changed; files already replaced are restored |
| 9 | Model provider failed or refused (error, empty answer, missing recording, unapproved model, egress block of the whole request), or `--provider-recording` / `--model` given alone | none changed |
| 10 | A trial file could not be read (missing, corrupt, extractor failed, same name twice) | none changed |

Publication is all-or-nothing and the output is repeatable: the same input and date give byte-identical
files (`docs/plans/qbd-core-p2-autodraft/gates.yaml`, G-05 and G-06). The page is a local file; a draft that
holds text from a document that is not class A must stay on the machine.

## Real provider

`run --provider {anthropic,openai,gemini} --model NAME --manifest manifest.json` uses the real provider. It refuses (exit 9, nothing published) unless that vendor's entry in `provider_access/config/providers.json` has `enabled: true`, the model is on that vendor's approved list (empty for OpenAI and Gemini until the project names models), a manifest is given and the key variable it names is set. It cannot be combined with `--provider-recording`. With no zero-data-retention contract on file only approved class A material is sent; trial data and class B/C files never leave the machine.

## Kho manifest

`docs/kho/manifest.json` lists the 393 Kho files by Drive id and class (A 249, B 119, C 25), no file names. It comes from the owner's table `classification-manifest.xlsx` (23/10/2026). Pass it as `--manifest docs/kho/manifest.json`. Only the 28 class A files whose upload flag is "Có" carry `approved_by` and `approved_on`; the other 221 class A files (flag "Chờ" 205, "Không" 16) and every B and C file are refused by the egress gate. The id-to-name table and the spreadsheet stay outside the repository.

## Loading Kho text on your machine

`kho-load --table classification-manifest.xlsx --folder DOWNLOADS --manifest docs/kho/manifest.json --out DOCUMENTS.json [--classes A,B,C]` writes the knowledge documents for `run --documents`. Files are matched to Drive ids by the file name in the owner's table; text is extracted from the files themselves (PDF through `pdftotext`, `.docx` from the document XML; other types are skipped with a reason), so stored pages are exactly what the extractor read. It exits 13 and writes nothing when the table and the manifest disagree on an id or class, when a table is unreadable, or when `--out` is inside a git work tree (class B and C text must not be committed). The report lists counts and reasons, never file names.

## Fingerprinting Kho text (hashes only)

`kho-fingerprint --table classification-manifest.xlsx --folder DOWNLOADS --manifest docs/kho/manifest.json --out FINGERPRINTS.json [--classes B,C] [--salt TEXT]` reads the same files as `kho-load` but writes a copy of the manifest whose class B and C entries carry `shingles`: hashes of every 8-word window of the file text (NFC, case-folded). No text, page or file name is written, and the report holds counts only. The output is a manifest `check_egress` loads directly, with the `salt` it was built with. Hashes are derived from restricted text, so `--out` must be outside any git tree (exit 13 otherwise, also on an unreadable manifest or a class that differs from the table; class A is refused). `docs/kho/manifest.json` is never changed. A salt stops precomputed hash tables only; whoever holds the output and the salt can still test guessed phrases. Only verbatim 8-word overlap is caught, not paraphrase.

Where commands cannot be run, `tools/kho-fingerprint-offline/index.html` does the same in a browser with no network, gives byte-identical output for `.docx`, and can run the leak trap on the text it read; see its README. PDF text comes from pdf.js there, so PDF hashes can differ slightly from `pdftotext`.

## Rebuilding the Kho manifest

`kho-manifest --table classification-manifest.xlsx --out docs/kho/manifest.json --approved-by NAME --approved-on YYYY-MM-DD [--check]` rebuilds the egress manifest from the owner's table (sheet `Manifest`, columns `file_id`, `file_name`, `nhom`, `tai_len_ngoai`). Only a class A file whose upload flag is "Có" is approved; dates already in `--out` are kept, new ones take `--approved-on`. It stops with exit 13 (nothing written) on an unknown class or flag, a flag "Có" on a class other than A, a repeated or malformed id, an unreadable table or a bad date. With `--check` it writes nothing and exits 14 when the result differs from `--out`; run it after every change to the table. The spreadsheet itself stays outside the repository.

## Web interface

`python -m qbd_core user-add --users-file users.json --name NAME --role researcher|head` (password asked twice, never taken from arguments; also `user-list`, `user-remove`; exit 15 on any accounts failure; `serve` exits 16 when it cannot listen). Keep the accounts file outside the repo.

`python -m qbd_core serve --documents docs.json --users-file users.json [--workdir runs] [--port 8765] [--provider NAME --model M --manifest manifest.json]`

A local page around `run`: sign in, three inputs, CQA candidates the signed-in person ticks (the confirmer is the account name, not a typed field), then the draft, the Data Gap Register and the quality checklist. Each run goes through `run.run`, so the draft, quality report and HTML are byte-for-byte what the command line writes for the same inputs. Files go to `<workdir>/<timestamp>/` (`draft.json`, `draft.quality.json`, `html/`, `cqa-confirmation.json`, `run.json`, `project.json`, `a13-record-<n>.json`). The project list reads `project.json`; `gaps.csv` and `checklist.csv` export a run (UTF-8 with BOM, cells that start with `=`, `+`, `-`, `@`, tab or CR get a leading quote).

Roles: `researcher` creates and views; `head` can also record the A13 signature. The record names who signed, when, and the SHA-256 of `draft.json`, `draft.quality.json` and the HTML. It never changes the draft and unlocks no step; if the draft changes afterwards the page shows that the signature no longer matches. A second record needs a note and the first is kept.

Safeguards: loopback only; another `Host` is refused; every POST needs the per-start token and a session; the session cookie is `HttpOnly; SameSite=Strict` and lasts 8 hours; five wrong passwords lock a name for a minute; bodies over 64 KB are refused; only run ids of the form `YYYYMMDDTHHMMSS` are served; the server will not start without a usable accounts file. Sign-in only separates people sharing one machine; it does not protect against someone who can read the disk. Provider settings come from the command line only and the page shows them read-only. There is no sign-up page and no switch for providers.

## Doctor

`doctor [--documents F] [--manifest F] [--users-file F] [--provider NAME --model M] [--workdir DIR]` checks what a real run needs and writes nothing and sends nothing. It prints `[ok]`, `[FAIL]` or `[skip]` per item with counts and file ids only (never file names, text or key values) and exits 17 when anything fails. The provider check uses the same function `run` uses to refuse (`run.provider_problems`), so the two always agree. The full order of steps is in `docs/qbd-core-quickstart.md`.
