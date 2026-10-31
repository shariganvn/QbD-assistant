"""Composition root: wires the modules together. Contains no business logic."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from qbd_core import __version__, accept, doctor, run, users, webapp


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
    run.add_kho_load_arguments(
        commands.add_parser("kho-load", help="build the documents JSON from downloaded Kho files")
    )
    run.add_kho_fingerprint_arguments(
        commands.add_parser("kho-fingerprint", help="hash restricted Kho files, no text written")
    )
    run.add_kho_manifest_arguments(
        commands.add_parser("kho-manifest", help="build the egress manifest from the owner table")
    )
    accept.add_arguments(
        commands.add_parser("accept", help="run the acceptance cases and write one report each")
    )
    webapp.add_arguments(
        commands.add_parser("serve", help="local web page around `run`, loopback only")
    )
    users.add_add_arguments(commands.add_parser("user-add", help="add a web page account"))
    users.add_list_arguments(commands.add_parser("user-list", help="list web page accounts"))
    users.add_remove_arguments(commands.add_parser("user-remove", help="remove a web page account"))
    doctor.add_arguments(
        commands.add_parser("doctor", help="read-only check of what a real run needs")
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
    if args.command == "kho-load":
        return run.kho_load(args)
    if args.command == "kho-fingerprint":
        return run.kho_fingerprint(args)
    if args.command == "kho-manifest":
        return run.kho_manifest(args)
    if args.command == "accept":
        return accept.accept(args)
    if args.command == "user-add":
        return users.user_add(args)
    if args.command == "user-list":
        return users.user_list(args)
    if args.command == "user-remove":
        return users.user_remove(args)
    if args.command == "doctor":
        return doctor.doctor(args)
    if args.command == "serve":
        return webapp.serve(args)
    build_parser().print_help()
    return 0
