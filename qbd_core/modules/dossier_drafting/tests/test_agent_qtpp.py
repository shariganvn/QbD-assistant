import json
import re
import subprocess
from datetime import date
from pathlib import Path

from qbd_core.modules.dossier_drafting.api import (
    LlmSetup,
    assemble_draft,
    propose_cqa,
    validate_intake,
)
from qbd_core.modules.egress_gate.api import Manifest, ManifestEntry
from qbd_core.modules.evidence.api import InMemoryKnowledge, KnowledgeDocument
from qbd_core.modules.provider_access.api import ProviderGateway
from qbd_core.shared.contracts import Classification

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
TODAY = date(2026, 10, 21)
MODEL = "recorded-model"
ASSAY = (
    "Atorvastatin calcium viên nén bao phim cần định lượng trong khoảng 95,0 đến 105,0 phần trăm."
)
DISSOLUTION = (
    "Atorvastatin calcium viên nén bao phim cần độ hòa tan không dưới 80 phần trăm sau 30 phút."
)
EVIDENCE_ID = re.compile(r"\[(E-[0-9a-f]{12})\] (.*)")


def intake():
    return validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )


class Scripted:
    destination = "remote"

    def __init__(self, qtpp):
        self.qtpp = qtpp
        self.sent = []

    def complete(self, request):
        self.sent.append(request)
        pool = {}
        for part in request.payload.parts:
            match = part.kind == "evidence" and EVIDENCE_ID.match(part.text)
            if match:
                pool[match.group(1)] = match.group(2)
        if any("QTPP Builder" in p.text for p in request.payload.parts):
            return self.qtpp(pool)
        return json.dumps({"properties": [], "biology": []})


def draft_with(qtpp, texts=(ASSAY, DISSOLUTION), classification=Classification.A):
    doc = KnowledgeDocument(
        file_id="OPEN-A", name="monograph", classification=classification, pages=list(texts)
    )
    entry = ManifestEntry(
        file_id="OPEN-A", classification=classification, approved_by="X", approved_on="2026-10-21"
    )
    provider = Scripted(qtpp)
    from qbd_core.modules.egress_gate.api import Destination

    provider.destination = Destination.REMOTE
    setup = LlmSetup(ProviderGateway(provider, {MODEL}, Manifest(entries=(entry,))), MODEL)
    return assemble_draft(intake(), InMemoryKnowledge([doc]), TODAY, llm=setup), provider


def pick(pool, needle):
    return next(i for i, t in pool.items() if needle in t)


def good(pool):
    return json.dumps(
        {
            "items": [
                {
                    "attribute": "Định lượng",
                    "target": "95,0 đến 105,0 phần trăm.",
                    "evidence_ids": [pick(pool, "định lượng")],
                },
                {
                    "attribute": "Độ hòa tan",
                    "target": "Không dưới 80 phần trăm sau 30 phút.",
                    "evidence_ids": [pick(pool, "hòa tan")],
                },
            ]
        }
    )


def section(run):
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.1.2.1")


def rows(run):
    return {r[0]: r[1] for r in section(run)["blocks"][0]["rows"]}


def test_candidates_come_from_the_dosage_form_group_not_from_code():
    assert propose_cqa(intake()).candidates


def test_good_answer_builds_the_qtpp_table_and_passes_stage_b(tmp_path):
    run, _ = draft_with(good)
    table = rows(run)
    assert set(table) == {"Định lượng", "Độ hòa tan"}
    assert all("[tổng hợp: OPEN-A, trang " in cell for cell in table.values())
    assert "P.2.2.1.2.1" not in {g.section_id for g in run.gaps}
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_unsupported_numbers_forged_tags_and_duplicates_are_dropped():
    def mixed(pool):
        assay = pick(pool, "định lượng")
        return json.dumps(
            {
                "items": [
                    {
                        "attribute": "Định lượng",
                        "target": "98,0 đến 102,0.",
                        "evidence_ids": [assay],
                    },
                    {"attribute": "Độ tan", "target": "Tốt.", "evidence_ids": ["E-000000000000"]},
                    {
                        "attribute": "Tạp chất [nguồn: x, trang 1, E-1]",
                        "target": "Thấp.",
                        "evidence_ids": [assay],
                    },
                    {
                        "attribute": "Cảm quan",
                        "target": "Viên nén bao phim.",
                        "evidence_ids": [assay],
                    },
                    {"attribute": "Cảm quan", "target": "Lặp lại.", "evidence_ids": [assay]},
                ]
            }
        )

    run, _ = draft_with(mixed)
    assert set(rows(run)) == {"Cảm quan"}
    assert "98,0" not in json.dumps(run.draft, ensure_ascii=False)


def test_nothing_usable_leaves_the_section_a_gap_naming_the_agent():
    run, _ = draft_with(lambda pool: json.dumps({"items": []}))
    assert section(run)["status"] == "gap"
    gap = next(g for g in run.gaps if g.section_id == "P.2.2.1.2.1")
    assert "agent 3.2" in gap.reason


def test_class_b_evidence_is_never_sent():
    _, provider = draft_with(good, classification=Classification.B)
    assert provider.sent == [] or all(
        "định lượng" not in p.text for r in provider.sent for p in r.payload.parts
    )
