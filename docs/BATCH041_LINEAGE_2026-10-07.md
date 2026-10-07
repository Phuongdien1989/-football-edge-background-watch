# FOOTBALL EDGE — Batch04.1 lineage

Batch04.1 is local/offline capture-kit hardening only.

## Exact input
- Batch04 ZIP SHA256: `5db4a9dc5d1600544e55d381a917535dcdca0c5345e18ca701bd183bcbfad577`
- Batch04 source manifest SHA256: `36034a080f6e24543efa524b055c3d27d410aa510c5f2f59f9bd380a0015e830`
- Batch04 lineage commit: `a70b800894b28a35deb9c551f97ac6cbd67283ba`

## Exact locally tested Batch04.1 source
- Source-manifest-file SHA256: `b4fda7b8f8af94d88bf5d88f652d9ae58a52360be223dae5bde836a150bef321`
- Probability engine SHA256 unchanged: `194b0c5b9870dbdcb4e06b2a823e1b0afd81f6626fb98c44917172de87257b16`
- Frozen production P2.0.5.2 SHA256: `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`

The runnable source of truth is the Batch04.1 ZIP/source artifact. This branch records lineage/audit only because the preceding development chain contains artifact-backed source.

## Guardrails
- no staging deployment
- no production deployment
- no live API call
- no production change
- no probability/confidence coefficient change
- no quota activation
- pilot remains NOT STARTED
