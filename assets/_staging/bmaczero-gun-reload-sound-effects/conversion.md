# Audio conversion status

## Current result

**No audio has been downloaded, decoded, edited, transcoded, normalized, or
imported.** There is no source waveform or game-ready audio artifact to review.

## Conditional future path

1. Acquire and hash each original file first; keep originals outside any
   precache/runtime directory.
2. Audition the untouched WAVs, identify usable mechanical moments, and retain
   an edit decision log with timecodes.  The three short files may be useful
   sweeteners but are not automatically full reloads.
3. Create project derivatives only after listening tests: document tool/version,
   source filename/hash, edit in/out, peak or loudness target, output codec,
   output filename/hash, and animation marker.
4. Add accepted derivatives only under a runtime audio directory with a local
   license/provenance record and an explicit source-array entry.  Never point a
   runtime fetch at this staging directory or the OpenGameArt page.
