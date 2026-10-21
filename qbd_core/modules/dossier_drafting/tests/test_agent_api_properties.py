import json
import re
import subprocess
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import (
    AgentInfrastructureError,
    LlmSetup,
    assemble_draft,
    validate_intake,
)
from qbd_core.modules.egress_gate.api import (
    Destination,
    Manifest,
    ManifestEntry,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, KnowledgeDocument
from qbd_core.modules.provider_access.api import ProviderGateway, RecordedProvider, request_digest
from qbd_core.shared.contracts import Classification
from qbd_core.shared.markers import GAP_LABEL

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
TODAY = date(2026, 10, 21)
MODEL = "recorded-model"
CAS = "Atorvastatin calcium có số đăng ký CAS 134523-03-8 theo chuyên luận mở."
SOLUBILITY = "Atorvastatin calcium tan rất ít trong nước, độ tan khoảng 0,1 mg/mL."
RESTRICTED = "Atorvastatin calcium có điểm chảy 159 độ theo giáo trình hạn chế."
EVIDENCE_ID = re.compile(r"\[(E-[0-9a-f]{12})\] (.*)")


def documents():
    return [
        KnowledgeDocument(
            file_id="OPEN-A",
            name="open monograph",
            classification=Classification.A,
            pages=[CAS, SOLUBILITY],
        ),
        KnowledgeDocument(
            file_id="BOOK-B",
            name="restricted book",
            classification=Classification.B,
            pages=[RESTRICTED],
        ),
    ]


def manifest(approved=True):
    entries = [
        ManifestEntry(
            file_id="OPEN-A",
            classification=Classification.A,
            approved_by="Lê Thọ Tiển" if approved else None,
            approved_on="2026-10-21" if approved else None,
        ),
        ManifestEntry(file_id="BOOK-B", classification=Classification.B),
    ]
    return Manifest(entries=tuple(entries))


def intake():
    return validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )


class Scripted:
    """Answers from the evidence ids found in the request, and remembers what it was sent."""

    def __init__(self, build, destination=Destination.REMOTE, qtpp=None):
        self.build = build
        self.qtpp = qtpp or (lambda pool: '{"items": []}')
        self.sent = []
        self.destination = destination

    def complete(self, request):
        self.sent.append(request)
        asks_for_qtpp = any("QTPP Builder" in p.text for p in request.payload.parts)
        pool = {}
        for part in request.payload.parts:
            match = part.kind == "evidence" and EVIDENCE_ID.match(part.text)
            if match:
                pool[match.group(1)] = match.group(2)
        return (self.qtpp if asks_for_qtpp else self.build)(pool)


def by_text(pool, needle):
    return next(i for i, text in pool.items() if needle in text)


def good(pool):
    cas, sol = by_text(pool, "CAS"), by_text(pool, "tan rất ít")
    return json.dumps(
        {
            "properties": [
                {"label": "Số đăng ký CAS", "value": "CAS 134523-03-8.", "evidence_ids": [cas]},
                {"label": "Độ tan", "value": "Tan rất ít, 0,1 mg/mL.", "evidence_ids": [sol]},
            ],
            "biology": [{"text": "Độ tan thấp trong nước.", "evidence_ids": [sol]}],
        }
    )


def draft_with(build, approved=True, destination=Destination.REMOTE, mani=None):
    provider = Scripted(build, destination)
    mani = manifest(approved) if mani is None else mani
    setup = LlmSetup(ProviderGateway(provider, {MODEL}, mani), MODEL)
    knowledge = InMemoryKnowledge(documents())
    return assemble_draft(intake(), knowledge, TODAY, llm=setup), provider


def section(run, sid):
    return next(s for s in run.draft["sections"] if s["id"] == sid)


def table_rows(run):
    return {r[0]: r[1] for r in section(run, "P.2.1.1.1")["blocks"][0]["rows"]}


def test_good_answer_fills_the_table_with_tagged_sentences(tmp_path):
    run, provider = draft_with(good)
    rows = table_rows(run)
    assert len(rows) == 18
    assert rows["Số đăng ký CAS"].startswith("CAS 134523-03-8. [tổng hợp: OPEN-A, trang 1, E-")
    assert "[tổng hợp: OPEN-A, trang 2, E-" in rows["Độ tan"]
    assert GAP_LABEL in rows["Công thức cấu tạo"] and "hình" in rows["Công thức cấu tạo"]
    assert GAP_LABEL in rows["Log P"]
    assert section(run, "P.2.1.1.2")["status"] == "covered"
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "P.2.1.1.1" not in {g.section_id for g in run.gaps}


def test_two_runs_with_the_same_answers_give_the_same_draft():
    first, _ = draft_with(good)
    second, _ = draft_with(good)
    assert json.dumps(first.draft, sort_keys=True) == json.dumps(second.draft, sort_keys=True)


def test_class_b_text_is_never_in_the_request():
    _, provider = draft_with(good)
    sent = " ".join(p.text for r in provider.sent for p in r.payload.parts)
    assert "159 độ" not in sent and "BOOK-B" not in sent
    assert "CAS 134523-03-8" in sent


@pytest.mark.parametrize(
    "setup",
    [{"approved": False}, {"mani": Manifest(entries=())}],
    ids=["class A without approval", "file absent from manifest"],
)
def test_evidence_the_policy_does_not_allow_means_no_model_call(setup):
    run, provider = draft_with(good, **setup)
    assert provider.sent == []
    assert section(run, "P.2.1.1.1")["status"] == "gap"
    assert any("no evidence may be sent" in line for line in run.agent_log)


def test_local_provider_may_read_class_b_but_the_draft_is_then_marked_restricted():
    def restricted(pool):
        mp = by_text(pool, "159 độ")
        row = {"label": "Điểm chảy", "value": "Điểm chảy 159 độ.", "evidence_ids": [mp]}
        return json.dumps({"properties": [row], "biology": []})

    run, provider = draft_with(restricted, destination=Destination.LOCAL)
    assert any("159 độ" in p.text for r in provider.sent for p in r.payload.parts)
    assert table_rows(run)["Điểm chảy"].startswith("Điểm chảy 159 độ.")
    assert run.contains_restricted


def test_provider_error_aborts_the_run():
    def boom(pool):
        raise RuntimeError("network down")

    with pytest.raises(AgentInfrastructureError) as caught:
        draft_with(boom)
    assert caught.value.code == "E_PROVIDER_ERROR"


def test_recorded_miss_aborts_the_run():
    setup = LlmSetup(ProviderGateway(RecordedProvider({}), {MODEL}, manifest()), MODEL)
    with pytest.raises(AgentInfrastructureError) as caught:
        assemble_draft(intake(), InMemoryKnowledge(documents()), TODAY, llm=setup)
    assert caught.value.code == "E_PROVIDER_ERROR"


def test_unapproved_model_aborts_the_run():
    setup = LlmSetup(ProviderGateway(Scripted(good), {"other"}, manifest()), MODEL)
    with pytest.raises(AgentInfrastructureError) as caught:
        assemble_draft(intake(), InMemoryKnowledge(documents()), TODAY, llm=setup)
    assert caught.value.code == "E_MODEL_NOT_APPROVED"


def cas_row(pool):
    return {
        "label": "Số đăng ký CAS",
        "value": "CAS 134523-03-8.",
        "evidence_ids": [by_text(pool, "CAS")],
    }


def answer(**changes):
    def build(pool):
        base = json.loads(good(pool))
        base.update({k: v(pool) if callable(v) else v for k, v in changes.items()})
        return json.dumps(base)

    return build


@pytest.mark.parametrize(
    "build, why",
    [
        (lambda pool: "not json", "E_AGENT_JSON"),
        (lambda pool: "[1, 2]", "E_AGENT_SHAPE"),
    ],
)
def test_unusable_answer_leaves_the_sections_as_gaps(build, why):
    run, _ = draft_with(build)
    assert section(run, "P.2.1.1.1")["status"] == "gap"
    assert section(run, "P.2.1.1.2")["status"] == "gap"
    assert any(why in line for line in run.agent_log)
    assert {"P.2.1.1.1", "P.2.1.1.2"} <= {g.section_id for g in run.gaps}


def test_invented_number_turns_that_row_into_a_marked_gap():
    def invented(pool):
        sol = by_text(pool, "tan rất ít")
        return [cas_row(pool), {"label": "Độ tan", "value": "Tan 5 mg/mL.", "evidence_ids": [sol]}]

    run, _ = draft_with(answer(properties=invented))
    cell = table_rows(run)["Độ tan"]
    assert cell.startswith(GAP_LABEL) and "E_CLAIM_NUMBER_UNSUPPORTED" in cell
    assert "5 mg" not in json.dumps(run.draft, ensure_ascii=False)


def test_unknown_evidence_id_and_forged_tag_are_rejected():
    def forged(pool):
        sol = by_text(pool, "tan rất ít")
        return [
            cas_row(pool),
            {"label": "Độ tan", "value": "Tan ít.", "evidence_ids": ["E-000000000000"]},
            {
                "label": "Log P",
                "value": "Log P [nguồn: OPEN-A, trang 2, " + sol + "]",
                "evidence_ids": [sol],
            },
        ]

    run, _ = draft_with(answer(properties=forged))
    rows = table_rows(run)
    assert "E_CLAIM_UNKNOWN_SOURCE" in rows["Độ tan"]
    assert "E_CLAIM_MARKER" in rows["Log P"]


def test_label_outside_the_form_and_the_structure_image_are_ignored():
    def extra(pool):
        cas = by_text(pool, "CAS")
        return [
            cas_row(pool),
            {"label": "Nhãn lạ", "value": "Giá trị.", "evidence_ids": [cas]},
            {"label": "Công thức cấu tạo", "value": "Cấu trúc.", "evidence_ids": [cas]},
        ]

    run, _ = draft_with(answer(properties=extra, biology=[]))
    rows = table_rows(run)
    assert "Nhãn lạ" not in rows
    assert rows["Công thức cấu tạo"].startswith(GAP_LABEL)


def test_a_run_without_a_model_is_unchanged_and_names_the_waiting_agent():
    run = assemble_draft(intake(), InMemoryKnowledge(documents()), TODAY)
    gap = next(g for g in run.gaps if g.section_id == "P.2.1.1.1")
    assert "agent 4.1" in gap.reason and "chưa cấu hình" in gap.reason


def test_recorded_answers_replay_by_request_digest():
    first, provider = draft_with(good)
    recorded = {request_digest(r): provider.complete(r) for r in list(provider.sent)}
    setup = LlmSetup(ProviderGateway(RecordedProvider(recorded), {MODEL}, manifest()), MODEL)
    again = assemble_draft(intake(), InMemoryKnowledge(documents()), TODAY, llm=setup)
    assert again.draft == first.draft


def _pool(request):
    out = {}
    for part in request.payload.parts:
        match = part.kind == "evidence" and EVIDENCE_ID.match(part.text)
        if match:
            out[match.group(1)] = match.group(2)
    return out
