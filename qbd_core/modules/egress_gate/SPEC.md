# SPEC - egress_gate

## Purpose
Decide which classified material may leave the machine and for which destination. Policy only; the
mechanism that calls a provider lives in provider_access.

## Ubiquitous nouns owned
Manifest, ManifestEntry, Payload, PayloadPart, Destination, EgressDecision, Reason.

## API contract (api.py)
- `check_egress(payload, destination, manifest) -> EgressDecision`. A `local` destination is allowed
  (nothing leaves the machine). A `remote` destination is allowed only when every part is proven allowed;
  one failing part blocks the whole payload. No partial send.
- `try_load_manifest(path) -> Manifest | None`: returns `None` for a missing file, bad encoding, schema
  violation or duplicate `file_id`. `None` blocks every remote send (`E_MANIFEST_MISSING`).
- `shingles(text)`: hashes of 8-word windows, used to fill `ManifestEntry.shingles` for documents that
  must never leave. The manifest stores hashes, never the text.
- Reason codes: `E_MANIFEST_MISSING`, `E_SOURCE_UNKNOWN`, `E_SOURCE_RESTRICTED` (class B, C or unclassified),
  `E_SOURCE_UNAPPROVED` (class A without approver and date), `E_PART_UNATTRIBUTED` (evidence part with no
  source), `E_RESTRICTED_TEXT` (a part shares an 8-word window with a restricted document, whatever the
  part claims to be).

## Invariants
- Class B, class C and unclassified material never reaches a remote destination.
- Class A material leaves only when it carries an approver and an approval date.
- A missing, unreadable or inconsistent manifest blocks everything remote.
- A decision never repeats payload text; it carries codes, part indexes and source ids only.

## Data owned (models.py)
None persisted. The manifest is an input produced by the evidence step (JSON view of the Kho manifest).

## Exposed to (file-share outside api.py)
None.

## Dependencies
`shared.contracts.Classification`. Called by provider_access before any remote request.

## Non-goals
Choosing a provider, reading documents, classifying documents (a person approves classes), and detecting
paraphrased restricted content: only verbatim 8-word overlap is caught.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Policy, manifest loader, fingerprints | Fail-closed gate against a synthetic manifest; real manifest follows the Kho classification | - |
| 2026-10-31 | NFC-normalised text and optional manifest salt in shingles | Extractor text and payload text must hash alike; an empty salt keeps the earlier hashes | - |
| 2026-10-31 | Offline browser page repeats the shingle definition | Machines that cannot run commands; byte-for-byte parity with the command is tested | - |
