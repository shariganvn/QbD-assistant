import json
import re
import subprocess
from datetime import date
from pathlib import Path

from qbd_core.modules.dossier_drafting.api import LlmSetup, assemble_draft, validate_intake
from qbd_core.modules.egress_gate.api import Destination, Manifest, ManifestEntry
from qbd_core.modules.evidence.api import InMemoryKnowledge, KnowledgeDocument
from qbd_core.modules.provider_access.api import ProviderGateway
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.shared.contracts import Classification
from qbd_core.shared.markers import GAP_LABEL

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
TODAY = date(2026, 10, 21)
MODEL = "recorded-model"
LEAD = "Viên nén bao phim Atorvastatin calcium có tá dược"
LACTOSE = f"{LEAD} lactose monohydrat, là chất độn, cỡ hạt 100 mesh."
MCC = f"{LEAD} cellulose vi tinh thể, là chất độn kiêm tá dược dính."
GRADE = f"{LEAD} lactose monohydrat grade Pharmatose 200M được chọn vì dập trực tiếp."
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
    destination = Destination.REMOTE

    def __init__(self, excipients):
        self.excipients = excipients
        self.sent = []

    def complete(self, request):
        self.sent.append(request)
        parts = request.payload.parts
        if not any("Excipient Selector" in p.text for p in parts):
            kind = "items" if any("QTPP Builder" in p.text for p in parts) else "properties"
            return json.dumps({kind: [], "biology": []})
        pool = {}
        for part in parts:
            match = part.kind == "evidence" and EVIDENCE_ID.match(part.text)
            if match:
                pool[match.group(1)] = match.group(2)
        return self.excipients(pool)


def draft_with(excipients, texts=(LACTOSE, MCC, GRADE)):
    doc = KnowledgeDocument(
        file_id="OPEN-A", name="monograph", classification=Classification.A, pages=list(texts)
    )
    entry = ManifestEntry(
        file_id="OPEN-A",
        classification=Classification.A,
        approved_by="X",
        approved_on="2026-10-21",
    )
    provider = Scripted(excipients)
    setup = LlmSetup(ProviderGateway(provider, {MODEL}, Manifest(entries=(entry,))), MODEL)
    knowledge = InMemoryKnowledge([doc])
    return assemble_draft(intake(), knowledge, TODAY, llm=setup), knowledge


def pick(pool, needle):
    return next(i for i, t in pool.items() if needle in t)


def claim(pool, needle, text):
    return {"text": text, "evidence_ids": [pick(pool, needle)]}


def good(pool):
    return json.dumps(
        {
            "excipients": [
                {
                    "name": "Lactose monohydrat",
                    "physchem": claim(pool, "lactose monohydrat, là", "Cỡ hạt 100 mesh."),
                    "use": None,
                    "function": claim(pool, "lactose monohydrat, là", "Chất độn."),
                },
                {
                    "name": "Cellulose vi tinh thể",
                    "physchem": None,
                    "use": None,
                    "function": claim(pool, "cellulose", "Chất độn kiêm tá dược dính."),
                },
            ],
            "grades": [claim(pool, "Pharmatose", "Chọn grade Pharmatose 200M vì dập trực tiếp.")],
        }
    )


def section(run, sid):
    return next(s for s in run.draft["sections"] if s["id"] == sid)


def rows(run):
    return section(run, "P.2.1.2.1")["blocks"][0]["rows"]


def test_good_answer_builds_the_table_and_grade_paragraph(tmp_path):
    run, _ = draft_with(good)
    table = rows(run)
    assert [r[0] for r in table] == ["1", "2"]
    assert table[0][1].startswith("Lactose monohydrat [tổng hợp: OPEN-A, trang 1, E-")
    assert table[1][1].startswith("Cellulose vi tinh thể [tổng hợp:")
    assert "[tổng hợp: OPEN-A, trang 1, E-" in table[0][2]
    assert table[0][3].startswith(GAP_LABEL) and table[1][2].startswith(GAP_LABEL)
    assert "[tổng hợp:" in section(run, "P.2.1.2.3")["blocks"][0]["text"]
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_quality_gate_accepts_the_filled_table():
    run, knowledge = draft_with(good)
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_an_excipient_missing_from_its_evidence_is_not_listed():
    def invented(pool):
        return json.dumps(
            {
                "excipients": [
                    {
                        "name": "Povidon K30",
                        "physchem": None,
                        "use": None,
                        "function": claim(pool, "cellulose", "Chất dính."),
                    }
                ],
                "grades": [],
            }
        )

    run, _ = draft_with(invented)
    assert section(run, "P.2.1.2.1")["status"] == "gap"
    assert "Povidon" not in json.dumps(run.draft, ensure_ascii=False)


def test_invented_number_in_a_cell_becomes_a_marked_gap_cell():
    def wrong_number(pool):
        item = {
            "name": "Lactose monohydrat",
            "physchem": claim(pool, "lactose monohydrat, là", "Cỡ hạt 250 mesh."),
            "use": None,
            "function": claim(pool, "lactose monohydrat, là", "Chất độn."),
        }
        return json.dumps({"excipients": [item], "grades": []})

    run, _ = draft_with(wrong_number)
    row = rows(run)[0]
    assert row[2].startswith(GAP_LABEL) and "E_CLAIM_NUMBER_UNSUPPORTED" in row[2]
    assert "250" not in json.dumps(run.draft, ensure_ascii=False)


def test_duplicates_and_names_with_markers_are_dropped():
    def messy(pool):
        function = claim(pool, "lactose monohydrat, là", "Chất độn.")
        names = ["Lactose monohydrat", "LACTOSE  monohydrat", "Lactose [nguồn: x, trang 1, E-1]"]
        items = [{"name": n, "physchem": None, "use": None, "function": function} for n in names]
        return json.dumps({"excipients": items, "grades": []})

    run, _ = draft_with(messy)
    assert len(rows(run)) == 1 and rows(run)[0][1].startswith("Lactose monohydrat [tổng hợp:")


def test_nothing_usable_leaves_both_sections_gaps_naming_the_agent():
    run, _ = draft_with(lambda pool: json.dumps({"excipients": [], "grades": []}))
    for sid in ("P.2.1.2.1", "P.2.1.2.3"):
        assert section(run, sid)["status"] == "gap"
        assert "agent 4.2" in next(g for g in run.gaps if g.section_id == sid).reason
