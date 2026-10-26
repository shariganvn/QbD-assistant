"""The `user-add`, `user-list` and `user-remove` commands for the local web page."""

from __future__ import annotations

import argparse
import getpass
import sys

from qbd_core.modules.accounts.api import ROLES, AccountError, UserStore

EXIT_ACCOUNTS = 15


def _common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--users-file", required=True, help="accounts JSON; keep it outside the repo"
    )


def add_add_arguments(parser: argparse.ArgumentParser) -> None:
    _common(parser)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", required=True, choices=ROLES)


def add_list_arguments(parser: argparse.ArgumentParser) -> None:
    _common(parser)


def add_remove_arguments(parser: argparse.ArgumentParser) -> None:
    _common(parser)
    parser.add_argument("--name", required=True)


def user_add(args: argparse.Namespace) -> int:
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Again: "):
        print("accounts: the two passwords differ", file=sys.stderr)
        return EXIT_ACCOUNTS
    try:
        user = UserStore(args.users_file).add(args.name, args.role, password)
    except AccountError as error:
        print(f"accounts: {error}", file=sys.stderr)
        return EXIT_ACCOUNTS
    print(f"user added: {user.name} ({user.role})")
    return 0


def user_list(args: argparse.Namespace) -> int:
    try:
        users = UserStore(args.users_file).users()
    except AccountError as error:
        print(f"accounts: {error}", file=sys.stderr)
        return EXIT_ACCOUNTS
    for user in users:
        print(f"{user.name}\t{user.role}")
    return 0


def user_remove(args: argparse.Namespace) -> int:
    try:
        UserStore(args.users_file).remove(args.name)
    except AccountError as error:
        print(f"accounts: {error}", file=sys.stderr)
        return EXIT_ACCOUNTS
    print(f"user removed: {args.name}")
    return 0
