# Experimental WebGPU advanced-renderer contract

Status: **design and QA only; not imported by the game runtime**.

The authoritative executable contract is
`src/experimental/webgpu-advanced-contract.js`. Its direct deterministic QA is
`scripts/webgpu-advanced-qa.mjs`.

## Claims boundary

The standardized WebGPU API does not expose acceleration structures, ray
queries, DXR, Vulkan RT, RTX cores, or any equivalent hardware-ray-tracing
feature. A future SPECTER WebGPU compute shader may traverse a TLAS/BLAS and
intersect real scene triangles. That is **WebGPU compute BVH geometry ray
tracing**, but it is not a claim of hardware-accelerated ray tracing.

The current game remains on its existing WebGL renderer. The separate
`webgpu-lab.html` document now owns a fully isolated, pinned Three r185 graph;
it does not add a game runtime feature flag or rename the current
SSR/SSAO/PCF fallbacks.

## Staged eligibility

Geometry ray tracing is eligible for a future experimental build only after:

1. A secure-context WebGPU adapter is acquired.
2. Three.js r185 or newer is proven compatible with the entire game.
3. Legacy EffectComposer effects are replaced by the TSL render pipeline.
4. Required WebGPU compute/storage limits are present.
5. `three-mesh-bvh` `BVHComputeData` has packed and validated the intended
   scene coverage.
Even after all five gates, diagnostics must say `hardware RT unavailable` and
identify static, dynamic, alpha-tested, and skinned-mesh coverage separately.

## AMD FSR 2 claim gate

The existing 77% spatial scaler is not AMD FSR 2. A future WebGPU port may use
the AMD FSR 2 name only when all of the following are implemented and verified:

- Current render-resolution HDR color, float depth, and RG16F velocity.
- Jitter, previous camera/object/instance/bone transforms, frame delta, camera
  parameters, and deterministic history invalidation.
- Exposure, reactive, and transparency/composition masks covering muzzle
  flashes, particles, emissive effects, alpha foliage, scopes, and ray-traced
  effects.
- The official luminance-pyramid, reconstruct/dilate, depth-clip, create-locks,
  reproject/accumulate, and RCAS stages as a faithful WGSL port.
- The pinned AMD source version and MIT notice.
- Reference-image, motion-coverage, disocclusion, and camera-cut validation.
- Separate TAA disabled while AMD FSR 2 is active.

Quality modes use the published per-axis ratios: Native AA 1.0x, Quality 1.5x,
Balanced 1.7x, Performance 2.0x, and optional Ultra Performance 3.0x. The
contract resolves dimensions with a deterministic ceiling so an odd display
size is never undersized.

## Temporal history resets

History resets on first frame, explicit reset, device/backend change, render or
presentation resolution change, quality-mode change, camera cut, camera
teleport, projection change, or scene-topology change. Multiple simultaneous
causes are returned in a stable order for diagnostics and regression tests.

Run the isolated QA directly with:

```text
node scripts/webgpu-advanced-qa.mjs
```

The lab and contract QA are mandatory release checks, while the shipped game
remains completely isolated from their module graph. Passing those checks is
not evidence that ray tracing or AMD FSR 2 is active in gameplay.

## Primary references

- WebGPU standardized feature names:
  https://gpuweb.github.io/types/types/GPUFeatureName.html
- Three.js WebGPU renderer migration:
  https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPU post-processing and MRT:
  https://threejs.org/manual/en/webgpu-postprocessing.html
- Official AMD FidelityFX FSR 2 source and integration requirements:
  https://github.com/GPUOpen-Effects/FidelityFX-FSR2
