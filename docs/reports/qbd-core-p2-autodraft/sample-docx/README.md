# Format tokens measured from the P.2 sample (.docx)

Source: the department's P.2 sample .docx, supplied by the user (class C proposed: format only).
`extract_format.py` and `extract_paragraphs.py` read the file as data (python -I, no DOCTYPE or entity
allowed) and print only formatting; any text they show is masked to its shape (letters a/A, digits 9).
`format-tokens.json` and `paragraph-groups.json` are their outputs. No sentence, number, name or limit of
the sample is in these files. Re-run: `python3 -I extract_format.py <file.docx>`.

## Measured, and used by `qbd_core/modules/rendering/html_doc.py`

| Item | Sample |
|---|---|
| Font | Arimo (Arial-metric); body, tables, captions all 10 pt; Times New Roman only in 7 list paragraphs |
| Body paragraph | justified; line spacing 1.5 (360); 3 pt before, 0 after |
| Headings | no Heading styles; typed numbers, bold, same 10 pt as body. Top level `P.2.n` uses a 1.25 cm hanging indent, 10 pt after, line 1.15; deeper levels use body spacing and a trailing dot (`P.2.n.n.`) |
| Sub-headings in a section | bold italic underlined, or italic underlined labels |
| Notes under a table | italic, starting with `*`, body spacing |
| Table and figure captions | centred, **bold** (both kinds; the Notion rendering showed figure captions italic, the .docx says bold), 1.5 line spacing, 3 pt before, `Table N.` / `Figure N.`, typed (no SEQ field) |
| Lists | `-` bullet, left 1.27 cm, hanging 0.63 cm |
| Table style | Table Grid: single 0.5 pt black borders on every edge; cell text 10 pt Arimo, line 1.15, 3 pt before, vertically centred; mostly centred text, prose justified; header row repeats on 42 of 74 tables |
| Header row fill | grey A6A6A6 (some BFBFBF or 808080) |
| Group label cells | grey A6A6A6 in the body (113 cells) |
| Risk cells | Low 00B050 (24 also 00CC00), Medium FFFF00, High FF0000 |
| Page | A4 portrait; margins left 2.5 cm, right 1.5 cm, bottom 3.0 cm, top 5.5 cm (header block of two tables); some sections landscape (A4 rotated) for wide tables; 28 hard page breaks |
| Header | 10 paragraphs and 2 tables (document title block), Arimo 10 pt, first line bold |
| Footer | page number (PAGE field), right-aligned, Arimo 10 pt |
| Figures | inline, mostly 13.5 to 15.9 cm wide (text width is 17 cm) |
| Auto numbering | headings are not auto-numbered; only bullet lists use Word numbering |

## Not applied, and why
Header title block (the sample's content is the company's; ours is a one-line draft label, so the top
margin is 3.5 cm), landscape sections, forced page breaks (the reason for the 28 is not visible), table and
figure captions (the Stage B table block has no caption field), group-label grey cells (no marker in the
draft), figure drawing.
