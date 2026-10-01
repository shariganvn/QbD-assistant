# Step 06 — Drawing figures at all

Status: pass · Gates: G-08, G-09, G-11

## The constraint that shaped this

There is no rasteriser in this environment: no ImageMagick, librsvg, inkscape, PIL, cairosvg,
matplotlib or rdkit. What there is, is the Chromium build Playwright installs — and only one of its
two binaries works. Measured here: `chrome --headless` paints the outlines of boxes and drops every
piece of text and every fill, with or without a virtual time budget and forced software rasterisation;
`headless_shell` renders correctly, Vietnamese diacritics intact. A figure that comes out as empty
outlines in a registration-shaped document is evidence replaced by a blank, so the binary choice is
recorded in the module rather than left to whoever reads the code next.

## What was built

- `render/figures/browser-png.mjs` — HTML to PNG through `headless_shell`. Searches the versioned
  install directory, honours `PHARMA_DEV_HEADLESS_SHELL`, and **fails loudly when it finds nothing**,
  the way `verify.mjs` already refuses to run without its schema validator. It also rejects an image
  too small to hold anything, because a blank page still writes a valid PNG.
- `render/figures/process-flow.mjs` — a chain of boxes, wrapping onto further rows for a long process.
  Labels wrap by width rather than word count: wrapping on word count breaks a short three-word name
  like "Trộn sơ bộ" for no reason.
- `render/figures/bar-chart.mjs` — columns with an optional acceptance line. Values are read as the
  source writes them, comma decimals and all, and printed back that way; a chart that renders 98,64 as
  98.64 has restated the source's number.
- `render/figures/figure-source.mjs` — resolves what a figure draws out of a table already in its
  section.
- `figure` and `image` block types, validated in Stage B.

## Three drawing decisions that were wrong first

Each was visible only in a rendered image, which is why the figures were rendered and looked at rather
than assumed correct from passing code.

1. **The axis rounded to the next power of ten.** Values near 98 gave a 0–200 scale, with every column
   squashed into the bottom half and the differences between formulations — the only thing the chart is
   for — no longer readable. Now it steps through finer multiples and tops out just above the tallest
   column.
2. **The acceptance label sat on top of a column.** Anchored to the right edge it landed on the tallest
   bar, red on blue. It has its own gutter to the right of the plot now, where nothing can reach it.
3. **The dashed acceptance line struck through a value label.** A column just under the line puts its
   number exactly where the line runs. The labels carry a white halo, which fixes every such collision
   rather than the one that happened to show up.
