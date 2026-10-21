from collections import Counter

import pytest

from qbd_core.modules.dossier_drafting.agents import registry, schedule
from qbd_core.modules.dossier_drafting.outline import leaf_sections, load_outline

AGENTS = registry.load_agents()


def test_the_kit_has_59_schedulable_agents_with_the_documented_kinds():
    assert len(AGENTS) == 59
    assert Counter(a.kind for a in AGENTS.values()) == {"llm": 36, "deterministic": 22, "human": 1}


def test_the_dependency_graph_is_sound():
    assert schedule.problems(AGENTS) == []


def test_the_order_respects_every_dependency_and_never_varies():
    order = schedule.order(AGENTS)
    position = {agent_id: i for i, agent_id in enumerate(order)}
    assert len(order) == len(set(order)) == 59
    for agent in AGENTS.values():
        assert all(position[dep] < position[agent.id] for dep in agent.depends_on)
    assert order == schedule.order(AGENTS)


def test_waves_group_the_order_in_ascending_rank():
    grouped = schedule.waves(AGENTS)
    assert [rank for rank, _ in grouped] == sorted(rank for rank, _ in grouped)
    assert sum(len(ids) for _, ids in grouped) == 59


def test_a_cycle_or_unknown_dependency_is_reported():
    a = AGENTS["0.1"]
    cyclic = {
        "x": registry.AgentSpec(**{**a.__dict__, "id": "x", "depends_on": ("y",)}),
        "y": registry.AgentSpec(**{**a.__dict__, "id": "y", "depends_on": ("x",)}),
    }
    assert any("cycle" in p for p in schedule.problems(cyclic))
    ghost = {"x": registry.AgentSpec(**{**a.__dict__, "id": "x", "depends_on": ("nope",)})}
    assert any("unknown dependency" in p for p in schedule.problems(ghost))


def test_every_target_section_exists_in_the_outline():
    leaves = {s["id"] for s in leaf_sections(load_outline())}
    targets = {t for a in AGENTS.values() for t in a.targets}
    assert targets <= leaves


def test_every_implemented_agent_is_a_real_agent():
    assert set(registry.IMPLEMENTED) <= set(AGENTS)
    assert registry.status_of("4.2") == ("pending", "")
    assert registry.status_of("3.5")[0] == "implemented"


@pytest.mark.parametrize("section", ["P.2.1.1.1", "P.2.2.1.2.2", "P.2.3.4"])
def test_a_section_names_the_agents_that_fill_it(section):
    assert registry.agents_for_section(section)


def test_a5_ordering_is_provisional_and_listed_for_final_approval():
    from qbd_core.modules.dossier_drafting.agents.registry import provisional_decisions

    items = provisional_decisions()
    assert [i.split(":")[0] for i in items] == [
        "agent 5.1 (Direct Compression Assessor)",
        "agent 5.2 (Granulation Assessor)",
    ]
    assert all("Trưởng R&D" in i for i in items)
