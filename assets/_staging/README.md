# Non-runtime candidate staging records

This directory contains evidence records for sources that have been screened at
the catalogue level but are **not** assets in SPECTER: Blacksite.  It contains
no downloaded archives, audio, models, textures, derived files, or runtime
imports.  The records are deliberately kept beside the asset tree so a future
reviewer can follow a candidate from research through provenance, conversion,
and QA before it is ever promoted.

The game, its service worker, and the runtime asset loader must not reference
`assets/_staging/`.  These text records can be copied into a source release with
the rest of the repository, but they are not precached, decoded, streamed, or
otherwise loaded by a player session.

Each candidate directory contains only these review documents:

```text
SOURCE.md        source-page facts and the intended evaluation boundary
LICENSE.txt      page-reported license record; not a substitute for a downloaded license
ORIGINAL.sha256  explicit no-binary state until an untouched source is acquired
conversion.md    conversion/retargeting plan, with no conversion claimed
qa.md            acceptance checklist, with pending checks called out explicitly
```

Promotion is forbidden until the original source is independently downloaded
outside the runtime path, its complete dependency chain and license are audited,
its SHA-256 is recorded, and the project-specific conversion and QA gates pass.
See [`../../ASSET_CATALOG.md`](../../ASSET_CATALOG.md) for the overall policy.
