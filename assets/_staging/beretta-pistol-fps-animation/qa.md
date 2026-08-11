# QA status - Beretta pistol animation reference

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source-page metadata | Recorded with limitation | Search-index facts are in `SOURCE.md`; direct page fetch returned 403. |
| Archive / SHA-256 | Pending | No download was made. |
| Upstream pistol dependency | Pending | Listing links another model; license and provenance are not audited. |
| Clip content / skeleton / materials | Pending | No archive is available for inspection. |
| Runtime import | Not applicable | This is intentionally non-runtime. |

## Required pistol-specific QA after a compatible acquisition

- Verify `UP`, inspect, fire, reload, fire2, reload2, and `DOWN` clip names,
  durations, FPS, first/last keyframes, and semantics from the actual file.
- Validate tactical and empty reload timing separately.  Magazine detachment,
  insertion, slide release/rack, and recoil return must match visible M9 events.
- Confirm hand contact with the current viewmodel throughout, including at the
  magazine, trigger guard, slide, and support points.
- Test ADS at 16:9 and ultrawide: sight/optic line must agree with the raycast,
  the ADS crosshair must hide, and the muzzle flash must begin at the barrel end.
- Test equip/holster, sprint-lower, landing, inspect, recoil recovery, ejection,
  and reload interruption.  Profile the accepted asset on desktop and Intel/Low.
