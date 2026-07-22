---
title: TOCTOU hardening technical debt for LiteParse invocation
id: D20260722
status: active
date: "2026-07-22"
scope: qbd-p2-ingest-completion
affects:
  - cowork-p2-kit/ingest/liteparse-adapter.mjs
  - docs/plans/qbd-p2-ingest-completion/plan.md
read_when: Before accepting untrusted input or changing LiteParse binary trust checks.
---

# D20260722 — LiteParse TOCTOU Hardening

## Debt

Between validating the configured LiteParse path/input and invoking LiteParse, another same-host actor
could replace a checked filesystem object. The completed Phase 2 gates validate the current behaviour but
do not eliminate this check-to-use race.

## Decision

Accept this as open technical debt, outside the completed Phase 2 ingest scope. Do not describe the Step 4
or Step 5 gates as closing it.

## Required follow-up

Before a future security-hardening release claims this boundary closed, define and review a design that
binds the object used for execution to the object that was trusted. The design must include a focused
threat model, an executable regression test, and explicit handling for the supported host/filesystem model.

## Non-goals

This record neither weakens path admission nor changes the accepted LiteParse capability contract.
