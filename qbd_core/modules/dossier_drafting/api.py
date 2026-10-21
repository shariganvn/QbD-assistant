"""Public entry points of the dossier_drafting module. Other modules import only from here."""

from qbd_core.modules.dossier_drafting.agents.llm import AgentInfrastructureError, LlmSetup
from qbd_core.modules.dossier_drafting.assemble import (
    CQA_SECTION,
    DraftingRefused,
    DraftRun,
    assemble_draft,
)
from qbd_core.modules.dossier_drafting.calc import CalcError, f2
from qbd_core.modules.dossier_drafting.config import (
    group_gaps,
    groups,
    section_map,
    section_map_verified,
)
from qbd_core.modules.dossier_drafting.cqa import (
    ConfirmedCqa,
    CqaConfirmation,
    CqaNotConfirmed,
    CqaProposal,
    intake_digest,
    load_confirmation,
    propose_cqa,
    require_confirmation,
)
from qbd_core.modules.dossier_drafting.intake import validate_intake
from qbd_core.modules.dossier_drafting.models import (
    COMBINATION_OUT_OF_SOP,
    IntakeIssue,
    IntakeRejected,
    IntakeResult,
)
from qbd_core.modules.dossier_drafting.outline import (
    leaf_sections,
    load_outline,
    most_strength_sections,
)

__all__ = [
    "CalcError",
    "f2",
    "AgentInfrastructureError",
    "LlmSetup",
    "COMBINATION_OUT_OF_SOP",
    "CQA_SECTION",
    "ConfirmedCqa",
    "CqaConfirmation",
    "CqaNotConfirmed",
    "CqaProposal",
    "DraftRun",
    "DraftingRefused",
    "IntakeIssue",
    "IntakeRejected",
    "IntakeResult",
    "assemble_draft",
    "group_gaps",
    "leaf_sections",
    "load_outline",
    "most_strength_sections",
    "section_map_verified",
    "intake_digest",
    "load_confirmation",
    "propose_cqa",
    "require_confirmation",
    "groups",
    "section_map",
    "validate_intake",
]
