# Audio conversion status

## Current result

**No conversion has occurred.** The candidate remains a page-recorded source;
there is no local waveform, derivative, decoded buffer, or runtime asset.

## Conditional future path

1. Preserve and hash the untouched `reload.wav` outside a runtime/precache path.
2. Audition the complete sequence and log the actual magazine-drop, insertion,
   and slide-rack timecodes only if clearly audible.
3. Decide whether it works as one complete empty-reload layer or can be split
   cleanly.  If splitting is audible or semantically misleading, retain it as
   one sequence or reject it.
4. For every derivative, record source hash, editor/version, edit points,
   fades, loudness/peak target, codec, output hash, and actual M9 event marker.
5. Promote only after mix, browser, and gameplay QA, with a local runtime
   provenance record.  Do not make this record or its source URL a fetch target.
