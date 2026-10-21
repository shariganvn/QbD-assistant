"""Modules reach each other only through api.py; shared holds no module imports."""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "qbd_core.modules."


def _imports(path: Path):
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            yield from (a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            yield node.module


def test_cross_module_imports_go_through_api():
    bad = []
    for path in (ROOT / "modules").rglob("*.py"):
        own = path.relative_to(ROOT / "modules").parts[0]
        for name in _imports(path):
            if name.startswith(PREFIX):
                target = name[len(PREFIX) :].split(".")
                if target[0] != own and target[1:2] != ["api"]:
                    bad.append(f"{path.relative_to(ROOT)} -> {name}")
    assert not bad, bad


def test_shared_does_not_import_modules():
    for path in (ROOT / "shared").rglob("*.py"):
        assert not [n for n in _imports(path) if n.startswith(PREFIX)], path


def test_every_module_has_spec_and_api():
    for module in (ROOT / "modules").iterdir():
        if module.is_dir() and not module.name.startswith("__"):
            assert (module / "SPEC.md").is_file(), module
            assert (module / "api.py").is_file(), module
