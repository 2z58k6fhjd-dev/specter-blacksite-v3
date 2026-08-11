# Conversion / compatibility status

## Current result

**No conversion is authorized or has occurred.** The source archive and the
linked upstream pistol dependency have not been acquired or audited.  There is
no local GLB, no animation extraction, no rebind, no texture conversion, and no
runtime reference.

## Conditional future path

1. Complete the source and upstream-pistol license/dependency audit described in
   `SOURCE.md`; stop if any source is non-CC0/non-CC-BY, unclear, or missing.
2. Preserve the untouched download and its hash before inspecting the asset.
3. Inventory the actual action tracks and mechanical nodes.  Match the listing's
   names to file contents rather than assuming `RELOAD` and `RELOAD2` mean
   tactical/empty reloads.
4. Test in a non-runtime scene against the current tan M9: scale, grip origin,
   optic/sight line, magazine path, slide travel, ejection side, muzzle anchor,
   and separate moving components.
5. If and only if the source is compatible and visually suitable, document the
   exact retarget/export tool, output hash, materials, attribution, LODs, and
   Low/512px derivative plan before proposing a runtime import.

## Explicit limits

This reference must never overwrite an existing weapon simply to add animation
count.  It must not replace project-authored hands or create claims about a
licensed animation until the full dependency chain and QA record exist.
