# FOOTBALL EDGE — Batch04.1 lineage

Batch04.1 is local/offline shadow only. No staging or production deployment and no live API call occurred.

## Exact input
- Batch04 ZIP SHA256: `5db4a9dc5d1600544e55d381a917535dcdca0c5345e18ca701bd183bcbfad577`
- Batch04 source-tree manifest SHA256: `36034a080f6e24543efa524b055c3d27d410aa510c5f2f59f9bd380a0015e830`
- Batch04 lineage commit: `a70b800894b28a35deb9c551f97ac6cbd67283ba`
- Frozen production P2.0.5.2 SHA256: `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`

## Exact locally tested Batch04.1 source
- Source manifest SHA256: `c0f76e001de4bf38070cb0941e4d1fcec5d259dfd5f897e760fd74cb2abb139d`
- probability-engine.js SHA256: `194b0c5b9870dbdcb4e06b2a823e1b0afd81f6626fb98c44917172de87257b16`

Runnable source of truth is the Batch04.1 ZIP/source artifact. The GitHub branch records lineage/audit only because the preceding development chain is artifact-backed rather than fully committed as one exact repository tree.

## Batch04.1 scope
- context lookup isolation
- API-Football live market parsing
- executable pilot budget/pacing controller
- immutable content validation before persistence ACK
- offline exact P2.0.5.2 OLD runtime bridge verification
- local fake-collector → persistence → cohort → OLD/NEW → locked prediction → late outcome integration

## Guardrails
- no production changes
- no model coefficient changes
- no quota activation
- no Push/UI changes
- no pilot started
- current provider quota remains unverified
