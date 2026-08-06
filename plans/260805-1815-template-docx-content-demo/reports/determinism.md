# Render determinism

Date: 2026-08-06

Command:

```text
node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs
```

Result: pass. Two fresh run roots produced equal normalized OOXML manifests.

Normalized OOXML SHA-256:

```text
9c5836848c2517b7cb9ad2450468b739a26efcd1ff0a106f2b590416ad4d59ab
```

The raw DOCX hash is retained only as a diagnostic because ZIP packaging bytes
are not the determinism contract. The normalized manifest is the acceptance
comparison and is stable across the two runs.
