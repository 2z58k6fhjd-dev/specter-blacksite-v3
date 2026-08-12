# CC0 handgun reload foley

- Source: https://opengameart.org/content/handgun-reload-sound-effect
- Direct original: https://opengameart.org/sites/default/files/reload.wav
- Author: zer0_sol
- License: CC0 1.0 Universal; see `LICENSE.txt`.
- Downloaded for SPECTER provenance: 2026-08-11.

`reload.wav` is the original, unmodified 44.1 kHz stereo 16-bit PCM WAV
(1.5906 seconds, 280,620 bytes). The runtime decodes it lazily after player
audio activation and uses it only as a quiet full-sequence layer during the
M9A4 empty reload. The marker-synced procedural magazine and slide foley
remains active, and is the fallback if this source cannot fetch or decode.
