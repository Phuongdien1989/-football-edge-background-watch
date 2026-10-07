# FOOTBALL EDGE — Batch 03 source lineage

This branch is an audit/lineage branch only. The exact runnable Batch 03 source is delivered in the Batch 03 ZIP artifact.

## Exact Batch 03 input

- Batch 02.2 ZIP SHA256:
  `3d96dc1bf230f04d19e35bed4d068c23cd1bdf19c4df015092cdd706ada28b42`
- Batch 02.2 source-tree manifest SHA256:
  `f742599f65109fee2db2679584631801ba454be81b313d72b75a706ca128ca1c`
- Frozen production P2.0.5.2 SHA256:
  `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`

Batch 02.2 was artifact-backed rather than fully committed to the repository. Therefore this branch starts from the nearest fully committed predecessor:

- Batch 02.1 commit: `1d535a31e30e3c5a79ed020daa2fe054af201797`

The Batch 03 implementation/tests were performed against the exact Batch 02.2 source extracted from the ZIP above, not against the older branch tree.

## Raw replay evidence

Existing GitHub Actions artifact read offline:

- artifact id: `11219420321`
- workflow run: `36989319789`
- name: `football-edge-v2-real-raw`
- SHA256: `5aeda0cf600c19a5b25d63756d78a2ed248b96ea5901866b7e31c74cb0ea1f92`
- source workflow head: `79d7393248eae8bcd5a45b73f3f9d47c8cf60e1c`

The artifact is limited raw-capture scope and MUST NOT be described as all live football.

## Batch 03 constraints

- No staging deployment.
- No production deployment.
- No live API call.
- No production database/schema change.
- No probability/confidence coefficient change.
- OLD replay must be reported unavailable when exact OLD historical state cannot be reconstructed.
