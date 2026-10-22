"""The agents of the PTDH kit as data, and which of them exist in code."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from typing import Literal

Status = Literal["implemented", "partial", "blocked", "pending"]


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    skill: str
    wave: int | str
    depends_on: tuple[str, ...]
    targets: tuple[str, ...]
    kind: Literal["llm", "deterministic", "human"]
    out_of_sop: bool
    notes: str
    provisional: str | None = None


# Where an agent's job is done in qbd_core. An id missing here is pending.
IMPLEMENTED: dict[str, tuple[Status, str]] = {
    "0.1": ("implemented", "dossier_drafting.validate_intake"),
    "0.2": ("implemented", "dossier_drafting.assemble (gap register)"),
    "0.3": ("partial", "dossier_drafting.assemble_draft and rendering; no final self-check pass"),
    "0.5": ("implemented", "dossier_drafting.config (38 forms, groups N1-N9)"),
    "0.6": ("implemented", "evidence.KnowledgePort"),
    "0.7": ("implemented", "dossier_drafting.agents.schedule"),
    "0.8": ("partial", "combinations are refused (E_COMBINATION_NOT_SUPPORTED), not planned"),
    "2.1": ("implemented", "quality_gate.numbering (CTD)"),
    "2.2": (
        "partial",
        "quality_gate.numbering (ACTD from the SOP, unchecked against Appendix I)",
    ),
    "2.3": ("implemented", "quality_gate.numbering (market: eu, domestic, both)"),
    "3.4": ("partial", "dossier_drafting.config.groups and propose_cqa (candidates)"),
    "3.5": ("implemented", "dossier_drafting.cqa (confirmation gate)"),
    "1.3": (
        "partial",
        "evidence.trial_intake: tables named or listed as unrecognised; only sink data used",
    ),
    "7.3": (
        "partial",
        "dossier_drafting.calc.f2 with the pair and point rules; no separate gate verdict",
    ),
    "8.2": (
        "partial",
        "dossier_drafting.dissolution: f2 and profile tables when the trial tables fit",
    ),
    "6.4": ("partial", "dossier_drafting.formula: copies the team's formula table; no proportions"),
    "3.1": ("partial", "dossier_drafting.reference: only columns labelled RMP/reference/đối chiếu"),
    "8.3": (
        "partial",
        "dossier_drafting.impurity: impurity tables whose batches can be tied to a product",
    ),
    "8.4": (
        "partial",
        "dossier_drafting.subdivision: mass uniformity and mass loss only; rules unconfirmed",
    ),
    "10.2": (
        "partial",
        "dossier_drafting.report_text: carries a filled report's results, discussion, conclusion",
    ),
    "1.1": ("partial", "retrieval is done inside agent 4.1; no separate collector output"),
    "1.4": (
        "partial",
        "substance name is taken as typed; no identity resolution or ambiguity stop",
    ),
    "3.2": ("implemented", "dossier_drafting.agents.qtpp"),
    **{
        agent_id: ("partial", f"dossier_drafting.agents.narrative: sourced literature only; {why}")
        for agent_id, why in {
            "4.3": "the own compatibility study stays a gap",
            "5.3": "the own compression/granulation assessment stays a gap",
            "6.3": "overage from the own data stays a gap",
            "8.1": "the sink section uses the team's data when given; method and power stay gaps",
            "9.1": "environment and moisture data stay gaps; the risk table is blocked",
            "9.2": "the own unit-operation results stay gaps",
            "10.3": "the own compatibility tests stay gaps",
        }.items()
    },
    "5.1": ("partial", "absorbed into 5.3; no separate assessment without the team's data"),
    "5.2": ("partial", "absorbed into 5.3; no separate assessment without the team's data"),
    "3.3": (
        "partial",
        "candidates from propose_cqa; the person confirms at gate 3.5; no rationale",
    ),
    "7.1": ("partial", "BCS statements come from agent 4.1 (P.2.1.1.2); no separate verdict"),
    "4.1": ("implemented", "dossier_drafting.agents.api_properties"),
    "4.2": ("implemented", "dossier_drafting.agents.excipients"),
    "12.1": ("implemented", "quality_gate.checklist (Appendix C)"),
    "12.3": ("implemented", "quality_gate.consistency"),
    "12.4": ("implemented", "quality_gate.provenance"),
}


# Agents that cannot run on the three inputs, with the reason. They stay marked gaps in the draft.
NEEDS_TEAM_DATA = "needs the team's own experimental data, which is not among the three inputs"
NEEDS_JUDGEMENT = "risk levels are the team's judgement on confirmed CQA and experiments"
BLOCKED: dict[str, str] = {
    "0.4": "no model review loop exists (12.2 deferred), so there is nothing to control",
    "1.2": "the reference-product profile needs its measured data (strengths, tests)",
    "4.4": NEEDS_JUDGEMENT,
    "4.5": "combinations of substances are out of the SOP and refused at intake",
    "6.1a": NEEDS_JUDGEMENT,
    "6.1b": NEEDS_JUDGEMENT,
    "6.2": NEEDS_TEAM_DATA,
    "6.5": "needs the final formula and the strengths",
    "7.2": "compares excipients with the reference product, which needs agent 3.1 data",
    "7.4": "route decision needs dissolution data and the eligibility verdict",
    "8.5": "conclusion needs the route decision and the team's data",
    "9.3": NEEDS_TEAM_DATA,
    "9.4": NEEDS_JUDGEMENT,
    "9.5": "optional module that needs a decision of the project owner",
    "10.1": "container-closure choice needs the final formula and stability data",
    "11.1": "links stability, overage and container sections that are still gaps",
    "11.2": "links process sections that are still gaps",
    "11.3": "links control-strategy sections that are still gaps",
    "11.4": "links the route decision and the BE conclusion, which are still gaps",
    "12.2": "a model review would send the draft text out; the code checks 12.1, 12.3, 12.4 stay",
}


@cache
def load_agents() -> dict[str, AgentSpec]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "agents.json")
    raw = json.loads(text.read_text("utf-8"))["agents"]
    return {
        a["id"]: AgentSpec(
            id=a["id"],
            name=a["name"],
            skill=a["skill"],
            wave=a["wave"],
            depends_on=tuple(a["depends_on"]),
            targets=tuple(a["target_sections"]),
            kind=a["kind"],
            out_of_sop=bool(a["out_of_sop"]),
            notes=a["notes"] or "",
            provisional=a.get("provisional"),
        )
        for a in raw
    }


def status_of(agent_id: str) -> tuple[Status, str]:
    if agent_id in BLOCKED:
        return "blocked", BLOCKED[agent_id]
    return IMPLEMENTED.get(agent_id, ("pending", ""))


def agents_for_section(section_id: str) -> tuple[AgentSpec, ...]:
    return tuple(a for a in load_agents().values() if section_id in a.targets)


def provisional_decisions() -> tuple[str, ...]:
    """Design choices used until the head of R&D confirms them at the final approval (A13)."""
    return tuple(
        f"agent {a.id} ({a.name}): {a.provisional}" for a in load_agents().values() if a.provisional
    )
