# Quaternius Universal Animation Library - source record

## State

**Metadata-only evaluation record.** No Quaternius archive, clip, skeleton,
texture, conversion, or derivative is stored in this directory or imported by
the game.

## Source-page record

| Field | Recorded value |
| --- | --- |
| Candidate | Universal Animation Library |
| Creator / publisher shown | Quaternius |
| Source page | <https://quaternius.com/packs/universalanimationlibrary.html> |
| Source-page review date | 2026-08-11 |
| Page-reported release | March 2025 |
| Page-reported delivery | FBX, GLB, and Blend; the page also describes engine exports |
| Page-reported scope | 120+ universal-humanoid clips covering locomotion, combat/gun actions, emotes, deaths, and other actions; root-motion and in-place variants are described by the project catalogue review |
| License shown by source page | CC0 1.0 Universal (the page says it is free for personal, educational, and commercial projects) |
| Intended SPECTER use | Third-person locomotion, transition, armed-body, and death-reference evaluation only |

## What this record does and does not prove

The source page is sufficient for a **CC0 research candidate** label.  It does
not identify an exact clip, prove the asset's archive contents, establish that a
particular gun/reload clip exists, or prove compatibility with SPECTER's soldier
rig.  It also does not turn generic humanoid motion into first-person hand
contact or weapon-component animation.

No browser, runtime, service-worker, or build manifest uses this source URL.  A
future evaluator must acquire the original package separately and preserve the
as-downloaded archive before any inspection or conversion.

## Required evidence before promotion

1. Save the exact source URL, download date, original archive filename, archive
   SHA-256, and the upstream CC0 notice.
2. List the actual clips selected by filename, duration, sample rate/FPS,
   coordinate system, and root-motion/in-place behavior.
3. Map the chosen clip(s) to the current soldier rig; document bone names,
   retarget tool/version, shoulder and wrist corrections, and contact results.
4. Demonstrate that any selected armed-body clip remains present-day, grounded,
   and visually coherent with SPECTER's modern equipment.
5. Run the animation acceptance tests in `qa.md` before adding any binary to a
   runtime asset directory.
