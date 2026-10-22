"""Composition root: wires the modules together. Contains no business logic."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from qbd_core import __version__, accept, run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="qbd_core",
        description="Orientation draft of the P.2 report from substance, dosage form and market.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="command")
    run.add_arguments(commands.add_parser("run", help="build a draft from the three inputs"))
    run.add_render_arguments(commands.add_parser("render", help="render a draft to one HTML file"))
    run.add_propose_arguments(commands.add_parser("cqa-propose", help="write the CQA proposal"))
    accept.add_arguments(
        commands.add_parser("accept", help="run the acceptance cases and write one report each")
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "run":
        return run.run(args)
    if args.command == "render":
        return run.render(args)
    if args.command == "cqa-propose":
        return run.propose(args)
    if args.command == "accept":
        return accept.accept(args)
    build_parser().print_help()
    return 0
