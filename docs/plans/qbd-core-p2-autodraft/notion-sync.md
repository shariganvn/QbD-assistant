# Notion sync

Notion mirrors this plan; the repo is the source of truth.

| Item | Location |
|---|---|
| Project page | https://app.notion.com/p/400e614b11778115bd9ad06a95ce6b64 |
| Task database | data source `collection://264df610-b039-485a-bf48-fac2d0aa1eaa` (page https://app.notion.com/p/7c4455cefb39467ea063cb1848c9b0cb) |
| Phase pages | children of the project page, titles `P0` .. `P6` |
| Skill-kit tasks (separate, untouched) | `collection://ced03434-645c-4903-9a5a-2e201a54e8be` |

Task rows are keyed by the `Bước` column (`0.1` .. `6.4`), which matches the step numbers in the
step files. Look a row up by `Bước`; do not keep a second id table here.

## Protocol when a task completes

1. Gate evidence retained under `docs/reports/qbd-core-p2-autodraft/`.
2. Tick the checkbox in `plan.md` and, when a whole step finishes, set its step file `status: done`.
3. Update the Claude Task.
4. Update the Notion row: `Trạng thái` = `Xong`, `Evidence / Commit` = commit hash and evidence path.
5. Append one line to the progress log at the bottom of the project page.
6. At the end of a phase write `docs/reports/qbd-core-p2-autodraft/pm-<phase>.md` and update the phase page.

Notion writes go only to the pages and database listed above.
