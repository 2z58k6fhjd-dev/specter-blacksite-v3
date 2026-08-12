# QA status - zer0_sol handgun reload candidate

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source-page license / description | Recorded | CC0 and `reload.wav` metadata are in `SOURCE.md`. |
| Original waveform / SHA-256 | Verified | Unmodified 44.1 kHz stereo PCM source is stored outside staging at `assets/audio/cc0-zer0-sol-handgun-reload/reload.wav`; its SHA-256 is retained in the runtime receipt and release validator. |
| Empty-reload semantic review | Conservative pass | Kept intact as a quiet full-sequence layer on the M9 empty reload; it is not split into unverified per-part sounds and the authored magazine/slide markers remain audible. |
| Runtime import | Approved | `src/main.js` fetches the one runtime source during asset loading, then decodes it only after audio activation; decode failure leaves marker-synced procedural foley intact. |

## Required M9-focused QA after acquisition

- Align any future edited recording with the visible M9 magazine and slide
  events. A slide sound cannot precede the rendered slide action.
- Exercise tactical reload, empty reload, cancelled reload, holster/equip, ADS,
  sprint-lower, and inspect paths.  The candidate must not trigger where its
  mechanics do not apply.
- Verify spatial/dry first-person mix, overlapping report/voice mix, distance
  attenuation where used, and audio-volume controls.
- Test the same output on desktop and Intel/Low paths for decode stability,
  memory pressure, and no audible clipping or repeated-tail artifacts.
