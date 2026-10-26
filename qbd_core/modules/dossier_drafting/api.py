"""Public entry points of the dossier_drafting module. Other modules import only from here."""

from qbd_core.modules.dossier_drafting.agents.llm import AgentInfrastructureError, LlmSetup
from qbd_core.modules.dossier_drafting.agents.registry import status_rows as agent_status_rows
from qbd_core.modules.dossier_drafting.assemble import (
    CQA_SECTION,
    DraftingRefused,
    DraftRun,
    assemble_draft,
)
from qbd_core.modules.dossier_drafting.calc import CalcError, f2
from qbd_core.modules.dossier_drafting.config import (
    forms as dosage_forms,
)
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
from qbd_core.modules.dossier_drafting.f2_tag import F2_TAG, cells_of
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
from qbd_core.modules.dossier_drafting.subdivision import ANY_TAG as SUBDIVISION_TAG
from qbd_core.modules.dossier_drafting.subdivision import files_in as subdivision_files
from qbd_core.modules.dossier_drafting.subdivision import verify as verify_subdivision

__all__ = [
    "SUBDIVISION_TAG",
    "agent_status_rows",
    "dosage_forms",
    "subdivision_files",
    "verify_subdivision",
    "F2_TAG",
    "cells_of",
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
