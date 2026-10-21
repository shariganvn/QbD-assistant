import hashlib

import pytest

from qbd_core.modules.evidence.api import TrialIntakeError, classify, load_trial_data
from qbd_core.tests.docx_factory import make_docx

SOLUBILITY = [["Media", "Solubility (mg/ml)"], ["Water", "0,5"]]
DISSOLUTION = [["Average dissolution (%)", "5 min", "15 min"], ["Test", "40", "85"]]
NOTES = [["Ghi chú", "x"], ["a", "b"]]


@pytest.mark.parametrize(
    "headers, kind",
    [
        (("Media", "Solubility (mg/ml)"), "solubility"),
        (("Môi trường", "Độ tan"), "solubility"),
        (("Average dissolution (%)", "5 min"), "dissolution_profile"),
        (("Components", "Concor 5 mg", "Concor 10 mg"), "composition"),
        (("Impurity", "Batch 1"), "impurity"),
    ],
)
def test_a_table_with_one_clear_kind_is_named(headers, kind):
    assert classify(headers) == (kind, "")


def test_no_match_and_several_matches_are_never_guessed():
    assert classify(("Ghi chú", "x"))[0] is None
    kind, reason = classify(("Impurity", "Hardness", "Batch"))
    assert kind is None and "impurity" in reason and "physical_tests" in reason


def test_real_extractor_reads_a_docx_and_lists_what_it_did_not_understand(tmp_path):
    path = make_docx(tmp_path / "trial-1.docx", [SOLUBILITY, DISSOLUTION, NOTES])
    data = load_trial_data([str(path)])
    assert [(t.index, t.kind) for t in data.tables] == [
        (1, "solubility"),
        (2, "dissolution_profile"),
        (3, None),
    ]
    assert data.tables[0].rows == (("Water", "0,5"),)
    assert data.unrecognized == ("trial-1.docx, bảng 3: không khớp loại dữ liệu nào",)
    assert data.files == (("trial-1.docx", hashlib.sha256(path.read_bytes()).hexdigest()),)


def test_same_files_give_the_same_data_in_any_order(tmp_path):
    a = make_docx(tmp_path / "a.docx", [SOLUBILITY])
    b = make_docx(tmp_path / "b.docx", [DISSOLUTION, NOTES])
    first = load_trial_data([str(a), str(b)])
    second = load_trial_data([str(b), str(a)])
    assert first.model_dump_json() == second.model_dump_json()


@pytest.mark.parametrize("content", [b"", b"not a zip", b"PK\x03\x04broken"])
def test_a_corrupt_file_stops_the_intake(tmp_path, content):
    bad = tmp_path / "bad.docx"
    bad.write_bytes(content)
    with pytest.raises(TrialIntakeError) as caught:
        load_trial_data([str(bad)])
    assert caught.value.code.startswith("E_")


def test_a_missing_file_and_a_repeated_name_stop_the_intake(tmp_path):
    with pytest.raises(TrialIntakeError) as missing:
        load_trial_data([str(tmp_path / "absent.docx")])
    assert missing.value.code == "E_TRIAL_UNREADABLE"
    one = make_docx(
        tmp_path / "x" / "r.docx" if (tmp_path / "x").mkdir() is None else tmp_path, [NOTES]
    )
    two = make_docx(tmp_path / "r.docx", [NOTES])
    with pytest.raises(TrialIntakeError) as twice:
        load_trial_data([str(one), str(two)])
    assert twice.value.code == "E_TRIAL_DUPLICATE_NAME"


@pytest.mark.parametrize(
    "extracted",
    [
        {},
        {"tables": "x"},
        {"tables": [{"headers": "a", "rows": []}]},
        {"tables": [{"headers": ["a"], "rows": [[1]]}]},
    ],
)
def test_an_extractor_answer_of_the_wrong_shape_stops_the_intake(tmp_path, extracted):
    path = make_docx(tmp_path / "t.docx", [NOTES])
    with pytest.raises(TrialIntakeError) as caught:
        load_trial_data([str(path)], extract=lambda _: extracted)
    assert caught.value.code == "E_EXTRACT_SHAPE"
