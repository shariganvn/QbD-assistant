# LiteParse Scout Notes

LiteParse is installed for local document scouting through the `lit` CLI.
This project also pins `@llamaindex/liteparse` in `package.json`; after
`npm install`, use `npm run liteparse -- ...` if the global `lit` command is not
available.

Use this workflow for each source document:

1. Parse once to a temporary text file.
2. Search the generated text file with `rg` or `grep`.
3. Only render screenshots when text extraction is not enough.

Examples:

```bash
rtk lit parse "/abs/path/document.pdf" --format text --no-ocr -o /tmp/document.txt
rtk rg -n -C 4 "target phrase|alternate phrase" /tmp/document.txt
rtk lit screenshot "/abs/path/document.pdf" --target-pages "3" --dpi 150 -o /tmp/liteparse-shots
```

Project-local equivalent:

```bash
rtk npm run liteparse -- parse "/abs/path/document.pdf" --format text --no-ocr -o /tmp/document.txt
```

For Office files, install LibreOffice if conversion fails. For images, install ImageMagick if conversion fails.

The Codex skill is installed at:

```text
/home/nguyenhp/.codex/skills/liteparse
```

Restart Codex to pick up newly installed skills.
