# SPEC - accounts

## Purpose
Say who is at the keyboard of the local web page and in which role. It does not decide what a role may
do; the web page does.

## Ubiquitous nouns owned
User, Role (`researcher`, `head`), UserStore.

## API contract (api.py)
- `UserStore(path)`: `users()`, `add(name, role, password)`, `remove(name)`, `authenticate(name, password)`.
- `authenticate` returns `None` for a wrong password, an unknown name, a missing or damaged file. It never
  raises for those cases and takes the same time for an unknown name.
- `add` and `remove` raise `AccountError` for a bad name, role or password (under 8 characters), a duplicate
  name (case-insensitive) and an unusable existing file. An existing file that cannot be read is never
  overwritten.

## Invariants
- Passwords are stored only as scrypt hashes with a per-user salt; the file holds no password.
- A missing or damaged accounts file lets nobody in.
- Writes replace the file whole or leave it as it was.

## Data owned
The accounts JSON file (`{"version": 1, "users": {name: {role, salt, hash, n, r, p}}}`), outside the repo.

## Exposed to (file-share outside api.py)
None.

## Dependencies
Standard library only.

## Non-goals
Protection against someone who can read the disk, sign-up from the web page, role changes from the web
page, and any network exposure.
