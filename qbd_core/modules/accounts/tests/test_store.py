import hashlib
import json

import pytest

from qbd_core.modules.accounts.api import AccountError, UserStore


@pytest.fixture
def store(tmp_path):
    return UserStore(tmp_path / "sub" / "users.json")


def test_add_then_authenticate(store):
    store.add("Lê Thọ Tiển", "head", "battery staple")
    user = store.authenticate("Lê Thọ Tiển", "battery staple")
    assert (user.name, user.role) == ("Lê Thọ Tiển", "head")
    assert store.authenticate("Lê Thọ Tiển", "wrong password") is None
    assert store.authenticate("Nobody", "battery staple") is None


def test_file_holds_no_password(store):
    store.add("A", "researcher", "correct horse")
    text = store.path.read_text(encoding="utf-8")
    assert "correct horse" not in text
    assert hashlib.sha256(b"correct horse").hexdigest() not in text
    assert set(json.loads(text)["users"]["A"]) == {"role", "salt", "hash", "n", "r", "p"}


def test_same_password_gets_a_different_hash(store):
    store.add("A", "researcher", "correct horse")
    store.add("B", "researcher", "correct horse")
    users = json.loads(store.path.read_text(encoding="utf-8"))["users"]
    assert users["A"]["hash"] != users["B"]["hash"]


@pytest.mark.parametrize(
    "name,role,password",
    [
        ("", "head", "long enough"),
        ("A", "admin", "long enough"),
        ("A", "head", "short"),
        ("a\x00b", "head", "long enough"),
        ("x" * 65, "head", "long enough"),
    ],
)
def test_bad_input_is_refused_and_writes_nothing(store, name, role, password):
    with pytest.raises(AccountError):
        store.add(name, role, password)
    assert not store.path.exists()


def test_duplicate_name_ignoring_case_is_refused(store):
    store.add("Alice", "researcher", "correct horse")
    before = store.path.read_bytes()
    with pytest.raises(AccountError):
        store.add("ALICE", "head", "correct horse")
    assert store.path.read_bytes() == before


@pytest.mark.parametrize(
    "content",
    [
        "",
        "not json",
        "[]",
        '{"users": []}',
        '{"users": {"A": {"role": "head"}}}',
        '{"users": {"A": {"role": "x", "salt": "00", "hash": "00", "n": 1, "r": 1, "p": 1}}}',
    ],
)
def test_unusable_file_lets_nobody_in_and_is_not_overwritten(store, content):
    store.path.parent.mkdir(parents=True)
    store.path.write_text(content, encoding="utf-8")
    assert store.authenticate("A", "anything at all") is None
    with pytest.raises(AccountError):
        store.add("B", "head", "long enough")
    assert store.path.read_text(encoding="utf-8") == content


def test_missing_file_lets_nobody_in(store):
    assert store.authenticate("A", "long enough") is None
    with pytest.raises(AccountError):
        store.users()


def test_remove(store):
    store.add("A", "researcher", "correct horse")
    store.add("B", "head", "correct horse")
    store.remove("A")
    assert [u.name for u in store.users()] == ["B"]
    with pytest.raises(AccountError):
        store.remove("A")
