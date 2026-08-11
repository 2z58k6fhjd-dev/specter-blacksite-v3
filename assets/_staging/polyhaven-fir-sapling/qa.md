# QA status - Poly Haven Fir Sapling candidate

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source license / contributor metadata | Recorded | `SOURCE.md` and `LICENSE.txt` preserve the supplied CC0/page metadata. |
| Original source / dependency closure | Pending | No glTF, buffers, or textures were downloaded. |
| LOD hierarchy | Pending | Reported source provides no exported LOD hierarchy. |
| Meshopt / texture compression | Pending | No file exists to test. |
| High and Intel/Low runtime QA | Pending | This candidate is not runtime-approved. |
| Runtime import | Not applicable | This directory is intentionally non-runtime. |

## Required forest QA after an approved conversion

- Record source, LOD0, LOD1, LOD2, and impostor/card triangle/material/texture
  budgets.  Verify distance culling and instancing with the dense forest enabled.
- Test High/Extreme density, mist/fog, ground cover, alpha edges, normal maps,
  shadow distance, day/night lighting, and camera movement for shimmer/pop.
- Test Intel/Competitive Low with 512px texture derivatives, low vegetation,
  low/disabled shadows as appropriate, and no unbounded source texture download.
- Measure initial load, decoded texture pressure, draw calls, frame time, and
  gameplay headroom during a multi-enemy firefight; record results before a
  runtime proposal.
- Compare the asset at first-person and background distances.  Reject it if its
  visual quality or scale conflicts with SPECTER's realistic modern setting.
