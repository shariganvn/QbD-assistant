# qbd_core command line

Status: active · Updated: 2026-10-21

`python -m qbd_core <command>` (Python 3.11 or later; Node is needed for the Stage B validator when a
page is rendered).

| Command | Purpose |
|---|---|
| `cqa-propose --substance S --form F --market M --out proposal.json` | Candidate CQA for the dosage-form group, bound to the input; a person fills the confirmation template. |
| `run --substance S [--substance S2 ...] --form F --market M --documents docs.json --out draft.json [--date YYYY-MM-DD] [--cqa-confirmation signed.json] [--render-dir DIR] [--provider-recording FILE --model NAME [--manifest FILE] [--provider-destination remote|local]]` | Build the gap-flagged draft, run the quality gate, publish `draft.json`, `draft.quality.json` and, with `--render-dir`, `p2-orientation-draft.html`. |
| `render --draft draft.json --out-dir DIR` | Render an existing draft to the HTML page. |

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

Publication is all-or-nothing and the output is repeatable: the same input and date give byte-identical
files (`docs/plans/qbd-core-p2-autodraft/gates.yaml`, G-05 and G-06). The page is a local file; a draft that
holds text from a document that is not class A must stay on the machine.
