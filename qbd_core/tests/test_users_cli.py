import pytest

from qbd_core import main as cli
from qbd_core import users


def _passwords(monkeypatch, *answers):
    queue = list(answers)
    monkeypatch.setattr(users.getpass, "getpass", lambda prompt="": queue.pop(0))


def test_add_list_remove(tmp_path, monkeypatch, capsys):
    path = str(tmp_path / "u.json")
    _passwords(monkeypatch, "long enough", "long enough")
    assert cli.main(["user-add", "--users-file", path, "--name", "A", "--role", "head"]) == 0
    assert cli.main(["user-list", "--users-file", path]) == 0
    assert "A\thead" in capsys.readouterr().out
    assert cli.main(["user-remove", "--users-file", path, "--name", "A"]) == 0
    assert cli.main(["user-remove", "--users-file", path, "--name", "A"]) == users.EXIT_ACCOUNTS


def test_mismatched_passwords_write_nothing(tmp_path, monkeypatch):
    path = tmp_path / "u.json"
    _passwords(monkeypatch, "long enough", "different one")
    code = cli.main(["user-add", "--users-file", str(path), "--name", "A", "--role", "head"])
    assert code == users.EXIT_ACCOUNTS and not path.exists()


def test_unknown_role_is_a_usage_error(tmp_path):
    with pytest.raises(SystemExit):
        cli.main(["user-add", "--users-file", str(tmp_path / "u"), "--name", "A", "--role", "x"])


def test_list_of_a_missing_file_fails(tmp_path):
    assert cli.main(["user-list", "--users-file", str(tmp_path / "none")]) == users.EXIT_ACCOUNTS
