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
    "1.1": ("partial", "retrieval is done inside agent 4.1; no separate collector output"),
    "1.4": (
        "partial",
        "substance name is taken as typed; no identity resolution or ambiguity stop",
    ),
    "3.1": (
        "blocked",
        "needs strengths and measured reference-product data, not among the three inputs",
    ),
    "3.2": ("implemented", "dossier_drafting.agents.qtpp"),
    "4.1": ("implemented", "dossier_drafting.agents.api_properties"),
    "4.2": ("implemented", "dossier_drafting.agents.excipients"),
    "12.1": ("implemented", "quality_gate.checklist (Appendix C)"),
    "12.3": ("implemented", "quality_gate.consistency"),
    "12.4": ("implemented", "quality_gate.provenance"),
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
    return IMPLEMENTED.get(agent_id, ("pending", ""))


def agents_for_section(section_id: str) -> tuple[AgentSpec, ...]:
    return tuple(a for a in load_agents().values() if section_id in a.targets)


def provisional_decisions() -> tuple[str, ...]:
    """Design choices used until the head of R&D confirms them at the final approval (A13)."""
    return tuple(
        f"agent {a.id} ({a.name}): {a.provisional}" for a in load_agents().values() if a.provisional
    )
