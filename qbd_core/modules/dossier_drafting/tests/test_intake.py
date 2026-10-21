import json
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import IntakeRejected, validate_intake

FIXTURES = sorted((Path(__file__).parent / "fixtures" / "intake").glob("*.json"))


def test_fixtures_present():
    assert len(FIXTURES) >= 15


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: p.stem)
def test_fixture(path):
    case = json.loads(path.read_text(encoding="utf-8"))
    expect = case["expect"]
    if "codes" in expect:
        with pytest.raises(IntakeRejected) as caught:
            validate_intake(case["input"])
        assert list(caught.value.codes) == expect["codes"]
        return
    result = validate_intake(case["input"])
    assert (result.form_id, result.group) == (expect["form_id"], expect["group"])
    assert list(result.scope_flags) == expect["flags"]


def test_canonical_form_name_is_returned():
    result = validate_intake({"substances": ["X"], "dosage_form": "f09", "market": "both"})
    assert result.request.dosage_form == "Viên nén bao phim"
