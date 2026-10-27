# qbd_core: from the Kho files to a first real run

Run these on the machine that holds the downloaded Kho files. Class B and C text never leaves it; nothing below sends anything until step 6.

1. **Kho text.** Put the downloaded files in one folder and keep the owner's `classification-manifest.xlsx` outside the repository.
   `python -m qbd_core kho-load --table classification-manifest.xlsx --folder DOWNLOADS --manifest docs/kho/manifest.json --out ../kho-documents.json`
   The report gives counts and reasons per file type. `--out` must be outside any git tree (exit 13 otherwise). Send the counts back if something is skipped.
2. **Manifest still matches the table.**
   `python -m qbd_core kho-manifest --table classification-manifest.xlsx --out docs/kho/manifest.json --approved-by NAME --approved-on YYYY-MM-DD --check`
   Exit 0 means the committed manifest equals what the table says; 14 means it differs.
3. **Accounts** (one administrator at a time, file outside the repo):
   `python -m qbd_core user-add --users-file ../users.json --name "Name" --role researcher`
   `python -m qbd_core user-add --users-file ../users.json --name "Name" --role head`
4. **Check everything.**
   `python -m qbd_core doctor --documents ../kho-documents.json --manifest docs/kho/manifest.json --users-file ../users.json --workdir runs`
   Prints `[ok]`, `[FAIL]` or `[skip]` per item with counts and file ids only; exit 17 if anything fails. A document missing from the manifest, or whose class differs, is a failure.
5. **Run without a model first.**
   `python -m qbd_core serve --documents ../kho-documents.json --users-file ../users.json`
   Open the printed address, sign in, enter substance, form and market, tick the CQA you confirm, and read the draft and the Data Gap Register. Agents that need a model stay marked as gaps.
6. **Turn the provider on (your decision, by hand).**
   Set `ANTHROPIC_API_KEY` in the environment, set `"enabled": true` for `anthropic` in `qbd_core/modules/provider_access/config/providers.json`, then:
   `python -m qbd_core doctor --manifest docs/kho/manifest.json --provider anthropic --model claude-sonnet-5-5`
   When it prints `[ok] provider anthropic`, start `serve` with `--provider anthropic --model claude-sonnet-5-5 --manifest docs/kho/manifest.json`. Only the 28 approved class A files can be sent. For OpenAI or Gemini, name the approved models in the same file first.
7. **Sign one real case (closes the A13 part of the acceptance gate).** As the head of R&D, open a finished run and use "Ghi nhận chữ ký A13". The record binds the signature to the bytes of the draft; it does not approve anything by itself.

Exit codes: 9 provider, 13 Kho load or manifest, 14 manifest differs, 15 accounts, 16 cannot listen, 17 doctor found a problem. The rest are in `docs/qbd-core-cli.md`.
