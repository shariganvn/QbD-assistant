"""Decide whether a payload may leave the machine. Blocks unless every part is proven allowed."""

from __future__ import annotations

from qbd_core.modules.egress_gate.fingerprint import shingles
from qbd_core.modules.egress_gate.models import (
    Destination,
    EgressDecision,
    Manifest,
    ManifestEntry,
    Payload,
    PayloadPart,
    Reason,
)
from qbd_core.shared.contracts import Classification


def _source_reasons(index: int, entry: ManifestEntry | None, source_id: str) -> list[Reason]:
    def reason(code: str) -> list[Reason]:
        return [Reason(code=code, part_index=index, source_id=source_id)]  # type: ignore[arg-type]

    if entry is None:
        return reason("E_SOURCE_UNKNOWN")
    if entry.classification is not Classification.A:
        return reason("E_SOURCE_RESTRICTED")
    if not (entry.approved_by and entry.approved_on):
        return reason("E_SOURCE_UNAPPROVED")
    return []


def _part_reasons(index: int, part: PayloadPart, manifest: Manifest, banned: frozenset[str]):
    reasons: list[Reason] = []
    if part.kind == "evidence":
        if not part.source_ids:
            reasons.append(Reason(code="E_PART_UNATTRIBUTED", part_index=index))
        for source_id in part.source_ids:
            reasons += _source_reasons(index, manifest.get(source_id), source_id)
    if shingles(part.text, salt=manifest.salt) & banned:
        reasons.append(Reason(code="E_RESTRICTED_TEXT", part_index=index))
    return reasons


def check_egress(
    payload: Payload, destination: Destination, manifest: Manifest | None
) -> EgressDecision:
    """Local use leaves nothing behind; a remote send needs every part proven allowed."""
    if destination is Destination.LOCAL:
        return EgressDecision(allowed=True, destination=destination)
    if manifest is None:
        reasons = (Reason(code="E_MANIFEST_MISSING"),)
        return EgressDecision(allowed=False, destination=destination, reasons=reasons)
    banned = frozenset().union(
        *(e.shingles for e in manifest.entries if e.classification is not Classification.A)
    )
    reasons = [
        r for i, part in enumerate(payload.parts) for r in _part_reasons(i, part, manifest, banned)
    ]
    return EgressDecision(allowed=not reasons, destination=destination, reasons=tuple(reasons))
