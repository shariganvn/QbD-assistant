"""Local accounts: a JSON file of names, roles and scrypt password hashes."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path

ROLES = ("researcher", "head")
MIN_PASSWORD = 8
MAX_NAME = 64
SCRYPT = {"n": 2**14, "r": 8, "p": 1}
_DUMMY_SALT = bytes(16)


class AccountError(Exception):
    """The accounts file is missing or unusable, or a change to it is refused."""


@dataclass(frozen=True)
class User:
    name: str
    role: str


def clean_name(raw: str) -> str:
    name = unicodedata.normalize("NFC", raw).strip()
    if not name or len(name) > MAX_NAME or any(unicodedata.category(c) == "Cc" for c in name):
        raise AccountError("name must be 1-64 characters without control characters")
    return name


def _digest(password: str, salt: bytes, params: dict[str, int]) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, dklen=32, **params)


def _valid_record(record: object) -> bool:
    if not isinstance(record, dict) or record.get("role") not in ROLES:
        return False
    try:
        bytes.fromhex(record["salt"])
        bytes.fromhex(record["hash"])
        return all(type(record[k]) is int and record[k] == v for k, v in SCRYPT.items())
    except (KeyError, TypeError, ValueError):
        return False


class UserStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def _load(self) -> dict[str, dict]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            users = data["users"]
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise AccountError(f"accounts file unusable: {type(error).__name__}") from error
        if not isinstance(users, dict) or not all(
            isinstance(k, str) and _valid_record(v) for k, v in users.items()
        ):
            raise AccountError("accounts file unusable: bad record")
        return users

    def _save(self, users: dict[str, dict]) -> None:
        text = json.dumps({"version": 1, "users": users}, ensure_ascii=False, indent=2) + "\n"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(text)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, self.path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    def users(self) -> tuple[User, ...]:
        return tuple(User(n, r["role"]) for n, r in sorted(self._load().items()))

    def add(self, name: str, role: str, password: str) -> User:
        name = clean_name(name)
        if role not in ROLES:
            raise AccountError("role must be researcher or head")
        if len(password) < MIN_PASSWORD:
            raise AccountError(f"password needs at least {MIN_PASSWORD} characters")
        users = self._load() if self.path.exists() else {}
        if name.casefold() in {n.casefold() for n in users}:
            raise AccountError("name already exists")
        salt = secrets.token_bytes(16)
        users[name] = {
            "role": role,
            "salt": salt.hex(),
            "hash": _digest(password, salt, SCRYPT).hex(),
            **SCRYPT,
        }
        self._save(users)
        return User(name, role)

    def remove(self, name: str) -> None:
        users = self._load()
        key = clean_name(name)
        if key not in users:
            raise AccountError("no such user")
        del users[key]
        self._save(users)

    def authenticate(self, name: str, password: str) -> User | None:
        """None for anything wrong, including an unusable file. Unknown names cost the same time."""
        try:
            users = self._load()
            record = users.get(clean_name(name))
        except AccountError:
            return None
        if record is None:
            _digest(password, _DUMMY_SALT, SCRYPT)
            return None
        params = {k: record[k] for k in SCRYPT}
        expected = bytes.fromhex(record["hash"])
        actual = _digest(password, bytes.fromhex(record["salt"]), params)
        if not hmac.compare_digest(expected, actual):
            return None
        return User(clean_name(name), record["role"])
