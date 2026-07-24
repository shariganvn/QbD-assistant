# G-P3-05 Viewer Fidelity Checklist

## Reviewer Information

- **Reviewer**: _name_
- **Review date**: _YYYY-MM-DD_
- **Viewer product**: _LibreOffice or Microsoft Word_
- **Viewer version**: _version string_
- **Host baseline**: _Windows host + WSL2 Ubuntu_

## Document Identification

- **Fixture SHA-256**: _lowercase 64-hex hash of the committed input fixture_
- **Opened DOCX SHA-256**: _lowercase 64-hex hash of the rendered DOCX opened in the viewer_
- **Normalized manifest SHA-256**: _lowercase 64-hex hash from the normalizer_
- **Opened DOCX path**: _absolute path to the rendered DOCX_

## Visual Observations

Each observation must have a verdict of exactly `PASS` and a non-empty observation.

- **positive_footnotes**
  - Verdict: _PASS_
  - Observation: _description of exactly two positive footnote markers_

- **usp_link**
  - Verdict: _PASS_
  - Observation: _confirmation of the visible USP reference UI hyperlink with target https://www.usp.org/search?query=bisoprolol_

- **local_provenance**
  - Verdict: _PASS_
  - Observation: _confirmation of visible non-link provenance text inputs/trials/formulation-trial-02.docx — page 1, offset 150_

- **toc**
  - Verdict: _PASS_
  - Observation: _confirmation of visible static Mục lục entries without a field refresh_

- **table_layout**
  - Verdict: _PASS_
  - Observation: _confirmation of fully visible four-column table with one header and two body rows at 100% zoom_
