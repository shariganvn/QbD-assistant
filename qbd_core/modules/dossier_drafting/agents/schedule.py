"""Agent 0.7: a deterministic order for the agents and a check that the graph is sound."""

from __future__ import annotations

from qbd_core.modules.dossier_drafting.agents.registry import AgentSpec

# Services run first; the gate sits after wave 2; self-checks run after the last wave.
SPECIAL_RANK = {"cross": -1, "gate (after 3.3)": 2.5, "after-6": 6.5, "final": 7}


def rank(agent: AgentSpec) -> float:
    return SPECIAL_RANK[agent.wave] if isinstance(agent.wave, str) else float(agent.wave)


def _numeric_id(agent_id: str) -> tuple:
    return tuple(int("".join(c for c in part if c.isdigit()) or 0) for part in agent_id.split("."))


def problems(agents: dict[str, AgentSpec]) -> list[str]:
    found = []
    for agent in agents.values():
        for dep in agent.depends_on:
            if dep not in agents:
                found.append(f"{agent.id}: unknown dependency {dep}")
            elif rank(agents[dep]) > rank(agent):
                found.append(f"{agent.id}: wave {agent.wave} runs before its dependency {dep}")
    try:
        order(agents)
    except ValueError as error:
        found.append(str(error))
    return found


def order(agents: dict[str, AgentSpec]) -> list[str]:
    """Kahn's algorithm; ties broken by wave rank then numeric id, so the order never varies."""
    pending = {a.id: {d for d in a.depends_on if d in agents} for a in agents.values()}
    result: list[str] = []
    while pending:
        ready = sorted(
            (i for i, deps in pending.items() if not deps),
            key=lambda i: (rank(agents[i]), _numeric_id(i)),
        )
        if not ready:
            raise ValueError("dependency cycle among " + ", ".join(sorted(pending)))
        chosen = ready[0]
        result.append(chosen)
        del pending[chosen]
        for deps in pending.values():
            deps.discard(chosen)
    return result


def waves(agents: dict[str, AgentSpec]) -> list[tuple[float, list[str]]]:
    grouped: dict[float, list[str]] = {}
    for agent_id in order(agents):
        grouped.setdefault(rank(agents[agent_id]), []).append(agent_id)
    return sorted(grouped.items())
