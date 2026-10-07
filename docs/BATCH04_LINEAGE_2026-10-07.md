# FOOTBALL EDGE — Batch04 lineage

Batch04 is local/offline shadow only. No staging or production deployment and no live API call occurred.

## Exact input
- Batch03.1 ZIP SHA256: `f21a829fddfb691337546291806305a7102a02ba52468335183b3aee2a504fa4`
- Batch03.1 source-tree manifest SHA256: `fb171421af882a90af99c1d8ec86219969e4d7bbc6326311878c0e902f393a75`
- Batch03.1 lineage commit: `8f8fb24d7c76c9cc8b0ab8d5c0b07af6b73e0026`
- Frozen production P2.0.5.2 SHA256: `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`

## Exact locally tested Batch04 source
- Source manifest SHA256: `36034a080f6e24543efa524b055c3d27d410aa510c5f2f59f9bd380a0015e830`
- Runnable source of truth is the Batch04 ZIP/source artifact, because prior Batch03.1/B04 work is artifact-backed rather than fully committed as a repository tree.

## Existing sources inspected
- v2-raw-capture @ `a0273ca36d661d0d7ebe0fbf5a623282cec1792c`
- v2-foundation @ `fba2e609ef20c8ede7df6ef9f57f36513245d511`

## Guardrails
- no production changes
- no probability/confidence coefficient changes
- no quota integration activation
- no Push/UI changes
- no current quota assumption
- pilot remains disabled until separately approved
