# Isolated WebGPU renderer lab

Open `webgpu-lab.html` from the same local or HTTPS static server used for the
game. It has no import from `src/main.js`, and the shipped game has no import
from the lab.

The module graph is intentionally one-way:

```text
webgpu-lab.html
  -> src/webgpu-lab/main.js
       -> browser-probe.js
       -> dependency-loader.js -> dependency-manifest.js
       -> diagnostics.js -> experimental/webgpu-advanced-contract.js
```

## Local dependency gate

The lab accepts only these exact local packages:

- `vendor/webgpu-lab/three-0.185.1` (`three` 0.185.1, MIT)
- `vendor/webgpu-lab/three-mesh-bvh-0.9.13` (`three-mesh-bvh` 0.9.13, MIT)

Both `package.json` files, both expected module files, the exact versions,
licenses, and required exports must pass before either module is evaluated.
There is no CDN fallback. Both packages are now vendored from their official
npm tarballs. Each package directory retains its untouched MIT `LICENSE`, npm
`package.json`, tarball URL and integrity, tarball SHA-256, and a complete
per-file SHA-256/byte-count manifest. The release validator rejects missing,
modified, extra, incorrectly licensed, or unrecorded files.

## Claims boundary

This slice probes local dependencies, the browser API, an adapter, declared
compute limits, and device creation. When WebGPU is available it compiles and
dispatches a real WGSL Möller–Trumbore ray/triangle intersection over a fixed
unit triangle, copies the 24-byte storage result, maps it with
`GPUBuffer.mapAsync`, and accepts only the exact expected hit distance and
barycentric bytes with clean error scopes.

The same WebGPU-capable probe then attempts a separate Three r185
`WebGPURenderer` frame using a real temporal MRT resource graph: linear HDR
RGBA16F color, float depth, RG16F velocity, R8 reactive and
transparency/composition masks, a 1x1 float exposure resource, and two
presentation-resolution RGBA16F history targets. A raster receipt is accepted
only from the actual WebGPU backend after queue completion; Three's WebGL
fallback is explicitly rejected. The temporary renderer and probe device are
released after their evidence is collected.

Those isolated proofs are not the game renderer. They do not migrate SPECTER's
combat scene, trace production lighting, denoise rays, or implement AMD FSR 2.
The temporal MRT resources are prerequisites only; none of AMD's six FSR 2
algorithm stages is claimed by this foundation. Geometry tracing, hardware RT,
and AMD FSR 2 therefore remain inactive in the game. The lab may report its own
small raster proof as active only when its strict receipt validates.

The next geometry slice must connect validated scene TLAS/BLAS buffers to a
bounded GPU traversal and mapped-readback receipt, then expand explicit scene
coverage and add temporal denoising. This remains compute geometry ray
tracing—not hardware RT—because standardized WebGPU exposes no ray-query or
acceleration-structure feature.

Run its deterministic source QA with:

```text
node scripts/webgpu-lab-qa.mjs
node scripts/webgpu-temporal-qa.mjs
```

When the local Playwright browser is installed, verify the rendered fail-closed
page with:

```text
node scripts/webgpu-lab-browser-qa.mjs
```
