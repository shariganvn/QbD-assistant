"""Composition root: wires the modules together. Contains no business logic."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from qbd_core import __version__, run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qbd_core",
        description="Orientation draft of the P.2 report from substance, dosage form and market.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="command")
    run.add_arguments(commands.add_parser("run", help="build a draft from the three inputs"))
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "run":
        return run.run(args)
    build_parser().print_help()
    return 0
