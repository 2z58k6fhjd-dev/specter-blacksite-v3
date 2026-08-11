# Poly Haven Fern 02 - high vegetation tier

This folder contains the official **Fern 02** glTF from
<https://polyhaven.com/a/fern_02>, retained at the 4K source tier for sparse
High, Ultra, and Extreme forest-floor dressing when the texture tier is not
Low. It is intentionally not a forest-wide repeated asset: the runtime places a
small number of non-colliding clumps around the exterior boundary and extraction
route. It is requested only after the required mission assets are ready, and
Competitive Low does not request or render it.

## Source and verification

- Official files API: <https://api.polyhaven.com/files/fern_02>
- License: [Creative Commons Zero 1.0 Universal](https://polyhaven.com/license)
- Source credits: Rico Cilliers (modeling) and Rob Tuytel (scanning)
- Runtime package: `fern_02_4k.gltf`, `fern_02.bin`, the matching 4K albedo,
  ARM, and OpenGL-normal JPEGs, plus the official 4K alpha mask
  `textures/fern_02_alpha_4k.png`. The browser glTF uses a JPEG base-color
  image, so the runtime applies that alpha mask to preserve the source model's
  leaf cutouts (`MASK`, 0.5 cutoff) instead of rendering opaque foliage.
- Official alpha-mask URL:
  <https://dl.polyhaven.org/file/ph-assets/Models/png/4k/fern_02/fern_02_alpha_4k.png>
  (MD5 `520e194db987df18fd73b49d979ada0c`, 470,827 bytes).

The six staged runtime files were integrity-checked against the official API
metadata when this folder was added. The original downloaded archive is not
bundled.
