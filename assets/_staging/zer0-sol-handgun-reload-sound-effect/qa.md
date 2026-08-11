# QA status - zer0_sol handgun reload candidate

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source-page license / description | Recorded | CC0 and `reload.wav` metadata are in `SOURCE.md`. |
| Original waveform / SHA-256 | Pending | No source file has been acquired. |
| Empty-reload semantic review | Pending | No audio is present to verify the stated sequence. |
| Runtime import | Not applicable | This is intentionally non-runtime. |

## Required M9-focused QA after acquisition

- Align audible magazine drop, insertion, and slide operation with visible M9
  events.  A slide sound cannot precede the rendered slide action.
- Exercise tactical reload, empty reload, cancelled reload, holster/equip, ADS,
  sprint-lower, and inspect paths.  The candidate must not trigger where its
  mechanics do not apply.
- Verify spatial/dry first-person mix, overlapping report/voice mix, distance
  attenuation where used, and audio-volume controls.
- Test the same output on desktop and Intel/Low paths for decode stability,
  memory pressure, and no audible clipping or repeated-tail artifacts.
