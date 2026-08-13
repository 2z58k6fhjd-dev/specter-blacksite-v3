# Third-party software

This notice covers code dependencies used by SPECTER. Asset licenses and
credits remain in `THIRD_PARTY_ASSETS.md`.

## Isolated experimental WebGPU renderer lab

The files below are self-hosted only for `webgpu-lab.html`. The released game
entry point does not import them, and the service worker does not install-time
precache them. They are fetched on demand after a deliberate lab visit.

| Package | Exact version | License | Purpose | Local evidence |
|---|---:|---|---|---|
| Three.js | 0.185.1 / r185 | MIT | Isolated WebGPU renderer, TSL, MRT, and temporal-resource research | `vendor/webgpu-lab/three-0.185.1/package.json`, `LICENSE`, `SHA256_MANIFEST.json` |
| three-mesh-bvh | 0.9.13 | MIT | Experimental `BVHComputeData` TLAS/BLAS packing and compute traversal research | `vendor/webgpu-lab/three-mesh-bvh-0.9.13/package.json`, `LICENSE`, `SHA256_MANIFEST.json` |
| AMD FidelityFX Super Resolution 2 | 2.2.1, commit `1680d1edd5c034f88ebbbb793d8b88f8842cf804` | MIT | Isolated WGSL/CPU reference for only the first 2x2 log-luminance mip operation; not a complete luminance pyramid or FSR 2 implementation | `src/experimental/fsr2-2.2.1/LICENSE-AMD-FSR2.txt`, `PROVENANCE.json` |

Both trees were copied from their official npm release tarballs. Their local
receipts preserve the registry and tarball URLs, npm SHA-512 integrity,
tarball SHA-256, byte counts, exact entry points, and every vendored file hash.
The release validator checks that closure before packaging.

Copyright and full license terms are preserved verbatim in each package's
local `LICENSE` file. No vendored package makes geometry ray tracing or AMD
FSR 2 active in the game by itself.

The AMD reference retains its official MIT notice and pins every researched
upstream source object by commit and Git blob hash. Its WGSL is a project-authored
WebGPU translation of one bounded arithmetic step. The full AMD SPD hierarchy,
exposure result, reconstruct/dilate, depth clip, locks, temporal accumulation,
and RCAS are still required before the product name can be used for a gameplay
upscaler.
