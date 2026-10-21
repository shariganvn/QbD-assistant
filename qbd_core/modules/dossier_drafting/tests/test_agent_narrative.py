import json
import re
import subprocess
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.agents import narrative
from qbd_core.modules.dossier_drafting.api import LlmSetup, assemble_draft, validate_intake
from qbd_core.modules.dossier_drafting.assemble import SECTION_QUERIES
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
EVIDENCE_ID = re.compile(r"\[(E-[0-9a-f]{12})\] (.*)")
SPECS = {spec.id: spec for spec in narrative.specs()}


def intake():
    return validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )


def sentence_for(spec):
    """One evidence sentence that every search term of the spec can find."""
    words = " ".join(q.replace("{substance}", "").replace("{form}", "") for q in spec.queries)
    return f"Atorvastatin calcium viên nén bao phim: {words} ghi nhận trong 25 mg thử nghiệm."


class Scripted:
    destination = Destination.REMOTE

    def __init__(self, spec, build):
        self.spec, self.build, self.sent = spec, build, []

    def complete(self, request):
        self.sent.append(request)
        parts = request.payload.parts
        if not any(f"agent {self.spec.name}" in p.text for p in parts):
            return "{}"
        pool = {}
        for part in parts:
            match = part.kind == "evidence" and EVIDENCE_ID.match(part.text)
            if match:
                pool[match.group(1)] = match.group(2)
        return self.build(pool)


def draft_with(spec, build):
    doc = KnowledgeDocument(
        file_id="OPEN-A",
        name="monograph",
        classification=Classification.A,
        pages=[sentence_for(spec)],
    )
    entry = ManifestEntry(
        file_id="OPEN-A", classification=Classification.A, approved_by="X", approved_on="2026-10-21"
    )
    provider = Scripted(spec, build)
    setup = LlmSetup(ProviderGateway(provider, {MODEL}, Manifest(entries=(entry,))), MODEL)
    knowledge = InMemoryKnowledge([doc])
    return assemble_draft(intake(), knowledge, TODAY, llm=setup), knowledge


def finding(spec, pool, text="Ghi nhận trong 25 mg thử nghiệm.", section=None):
    return {
        "section": section or next(iter(spec.leads)),
        "text": text,
        "evidence_ids": [next(iter(pool))],
    }


def section(run, sid):
    return next(s for s in run.draft["sections"] if s["id"] == sid)


@pytest.mark.parametrize("agent_id", sorted(SPECS))
def test_good_answer_adds_sourced_sentences_after_the_experiment_gap(agent_id, tmp_path):
    spec = SPECS[agent_id]
    sid = next(iter(spec.leads))
    run, knowledge = draft_with(spec, lambda pool: json.dumps({"findings": [finding(spec, pool)]}))
    blocks = section(run, sid)["blocks"]
    assert blocks[0]["text"].startswith(GAP_LABEL) and spec.leads[sid] in blocks[0]["text"]
    assert "[tổng hợp: OPEN-A, trang 1, E-" in blocks[1]["text"]
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


@pytest.mark.parametrize("agent_id", sorted(SPECS))
def test_bad_items_are_dropped_and_the_section_stays_a_gap(agent_id):
    spec = SPECS[agent_id]
    sid = next(iter(spec.leads))

    def bad(pool):
        evidence = next(iter(pool))
        items = [
            finding(spec, pool, text="Ghi nhận 99 mg."),
            {"section": sid, "text": "Không nguồn.", "evidence_ids": ["E-000000000000"]},
            {"section": "P.2.9.9", "text": "Ngoài mục.", "evidence_ids": [evidence]},
            {"section": sid, "text": "Giả [nguồn: a, trang 1, E-1].", "evidence_ids": [evidence]},
        ]
        return json.dumps({"findings": items})

    run, _ = draft_with(spec, bad)
    assert "99" not in json.dumps(run.draft, ensure_ascii=False)
    if sid in SECTION_QUERIES:  # the verbatim-quote search may still cover it, without the agent
        assert GAP_LABEL not in json.dumps(section(run, sid), ensure_ascii=False)
        return
    assert section(run, sid)["status"] == "gap"
    assert f"agent {agent_id}" in next(g for g in run.gaps if g.section_id == sid).reason


def test_a_multi_section_agent_files_each_sentence_under_its_own_section():
    spec = SPECS["8.1"]
    first, second = list(spec.leads)[:2]

    def split(pool):
        items = [finding(spec, pool, section=first), finding(spec, pool, section=second)]
        return json.dumps({"findings": items})

    run, _ = draft_with(spec, split)
    assert section(run, first)["status"] == section(run, second)["status"] == "covered"
    third = list(spec.leads)[2]
    assert section(run, third)["status"] == "gap"
