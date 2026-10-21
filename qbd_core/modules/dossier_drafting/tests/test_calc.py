import math

import pytest

from qbd_core.modules.dossier_drafting.calc import CalcError, f2, mean, overage_percent, rsd_percent


def test_f2_matches_a_worked_example():
    # Differences of 5 at every point: mean square 25, f2 = 50 * log10(100 / sqrt(26)).
    assert f2([50, 70, 90], [45, 65, 85]) == pytest.approx(64.626, abs=0.001)


def test_identical_profiles_give_100():
    assert f2([30, 60, 90], [30, 60, 90]) == pytest.approx(100.0)


def test_points_after_both_profiles_reach_85_percent_are_left_out():
    with_tail = f2([30, 60, 88, 99], [32, 63, 90, 70])
    without = f2([30, 60, 88], [32, 63, 90])
    assert with_tail == pytest.approx(without)


@pytest.mark.parametrize(
    "ref, test, code",
    [
        ([50, 70], [45, 65], "E_F2_TOO_FEW_POINTS"),
        ([50, 90, 99], [45, 92, 99], "E_F2_TOO_FEW_POINTS"),
        ([50, 70, 90], [45, 65], "E_F2_LENGTH"),
        ([50, 70, 110], [45, 65, 85], "E_F2_RANGE"),
        ([50, 70, -1], [45, 65, 85], "E_F2_RANGE"),
    ],
)
def test_unusable_profiles_are_refused(ref, test, code):
    with pytest.raises(CalcError) as caught:
        f2(ref, test)
    assert caught.value.code == code


def test_mean_and_rsd_match_hand_values():
    assert mean([2, 4, 6]) == 4
    # sample sd of 2,4,6 is 2; 2 / 4 = 50 %
    assert rsd_percent([2, 4, 6]) == pytest.approx(50.0)
    assert math.isclose(rsd_percent([10, 10, 10]), 0.0)


@pytest.mark.parametrize(
    "call, code",
    [
        (lambda: mean([]), "E_CALC_EMPTY"),
        (lambda: rsd_percent([5]), "E_RSD_TOO_FEW_VALUES"),
        (lambda: rsd_percent([-1, 1]), "E_RSD_ZERO_MEAN"),
        (lambda: overage_percent(0, 10), "E_OVERAGE_AMOUNT"),
    ],
)
def test_calculations_refuse_what_they_cannot_answer(call, code):
    with pytest.raises(CalcError) as caught:
        call()
    assert caught.value.code == code


def test_overage_is_a_percent_of_the_label_amount():
    assert overage_percent(100, 105) == pytest.approx(5.0)
    assert overage_percent(100, 100) == 0
