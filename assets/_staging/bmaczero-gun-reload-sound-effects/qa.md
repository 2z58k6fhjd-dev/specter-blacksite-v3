# QA status - BMacZero reload audio candidate

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source-page license / file metadata | Recorded | `SOURCE.md` records the CC0 page label and listed WAV filenames/sizes. |
| Original WAVs / hashes | Pending | No download has been made. |
| Waveform / artifact review | Pending | No audio is present to audition. |
| Derivative / mix / runtime import | Not applicable | This is intentionally non-runtime. |

## Required audio QA after acquisition

- Inspect peak, DC offset, clipping, silence, room tone, and exact duration.
- Compare levels against existing player weapon reports, footsteps, and enemy
  voice; click layers must remain audible without masking critical callouts.
- Test magazine-out, magazine-in, and single-round candidates only at verified
  game animation markers.  Reject any layer that reads as the wrong mechanism.
- Test randomized selection and rate limiting during rapid reload/equip/sprint
  transitions so repeated transients do not machine-gun.
- Test mobile/desktop browser decoding and the Intel/Low audio-memory path before
  any deployment.
