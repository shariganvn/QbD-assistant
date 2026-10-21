from collections import Counter

from qbd_core.modules.dossier_drafting import config
from qbd_core.shared.contracts import GAP_MARKER

EXPECTED_COUNTS = {"N1": 8, "N2": 3, "N3": 2, "N4": 2, "N5": 2, "N6": 8, "N7": 4, "N8": 6, "N9": 3}
NO_INTERNAL_DOCS = {"N5", "N6", "N7", "N8", "N9"}


def test_thirty_eight_forms_each_in_one_group():
    forms = config.forms()
    assert len(forms) == 38
    assert len({f["id"] for f in forms}) == 38
    assert len({config.normalise(f["name"]) for f in forms}) == 38
    assert all(f["group"] in config.groups() for f in forms)


def test_group_sizes_match_the_catalogue():
    assert dict(Counter(f["group"] for f in config.forms())) == EXPECTED_COUNTS


def test_no_group_is_empty_and_each_has_candidate_cqa():
    assert set(config.groups()) == set(EXPECTED_COUNTS)
    for group in config.groups().values():
        assert group["base"], group["id"]
        assert group["cqa_status"] == "candidate_unconfirmed"


def test_groups_without_internal_documents_carry_gaps():
    for group_id in config.groups():
        gaps = config.group_gaps(group_id)
        if group_id in NO_INTERNAL_DOCS:
            assert {g.section_id for g in gaps} == {"P.2.2.1", "P.2.2.3"}
            assert all(g.reason.startswith(GAP_MARKER) for g in gaps)
        else:
            assert gaps == ()


def test_section_map_covers_the_sop_appendix():
    assert len(config.section_map()) == 11
