"""config/ctd_actd_map.json agrees with the numbering and the generic column of the two sources."""

import json
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import section_map
from qbd_core.modules.quality_gate.numbering import _NOTE_TO_REQUIREMENT

SOURCES = json.loads(
    (Path(__file__).parent / "fixtures" / "source-sections.json").read_text(encoding="utf-8")
)
CTD = SOURCES["ctd_source"]["sections"]
ACTD = SOURCES["actd_source"]["sections"]
DIFFERENCES = SOURCES["known_differences"]


def requirement(note: str) -> str:
    return next(
        (req for prefix, req in _NOTE_TO_REQUIREMENT if note.startswith(prefix)), "required"
    )


@pytest.mark.parametrize("entry", section_map(), ids=lambda e: e["actd"])
def test_every_mapped_number_exists_in_the_sources(entry):
    assert entry["actd"] in ACTD
    if entry["ctd"]:
        assert "3.2." + entry["ctd"] in CTD


@pytest.mark.parametrize("entry", [e for e in section_map() if e["ctd"]], ids=lambda e: e["ctd"])
def test_titles_carried_in_the_map_are_the_source_titles(entry):
    assert entry["ctd_title"] == CTD["3.2." + entry["ctd"]]
    assert entry["actd_title"] == ACTD[entry["actd"]]["title"]


def test_the_ctd_and_actd_parts_of_each_entry_are_the_same_section():
    pairs = {(e["ctd"], e["actd"]) for e in section_map()}
    assert ("P.2.3", "P2.4") in pairs and ("P.2.4", "P2.5") in pairs
    assert ("P.2.5", "P2.6") in pairs and ("P.2.6", "P2.7") in pairs and ("P.8", "P8") in pairs


@pytest.mark.parametrize("entry", section_map(), ids=lambda e: e["actd"])
def test_the_generic_requirement_follows_the_actd_table_except_where_recorded(entry):
    expected = ACTD[entry["actd"]]["generic"]
    got = requirement(entry["generic_actd_note"])
    if entry["ctd"] in DIFFERENCES:
        assert got != expected, "the recorded difference no longer exists; remove it"
    else:
        assert got == expected, DIFFERENCES


def test_every_actd_pharmaceutical_development_section_is_mapped_or_explained():
    mapped = {e["actd"] for e in section_map()}
    missing = set(ACTD) - mapped
    assert missing == {
        "P2.1"
    }  # NCE and biotech only: not applicable to the products this system drafts
