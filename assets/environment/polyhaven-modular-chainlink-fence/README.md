# Poly Haven Modular Chainlink Fence — optional high-tier perimeter detail

This folder contains the official **2K** glTF closure for
[Modular Chainlink Fence](https://polyhaven.com/a/modular_chainlink_fence).
It is a **15.47 MiB** source closure: one 3.17 MiB geometry buffer, two PBR
materials, and six 2K JPG maps. The authored kit contains 89,232 triangles;
SPECTER only clones the 3,054-triangle double-panel mesh for eight nearby,
high-tier visual inserts instead of repeatedly spawning the entire kit.

## License and source

- License: [CC0 1.0](https://polyhaven.com/license)
- Official files API: <https://api.polyhaven.com/files/modular_chainlink_fence>
- Model credit shown by Poly Haven: Amal Kumar
- Fence-wire material credit shown by Poly Haven: James Ray Cock

`manifest.json` retains the official download MD5 values and local SHA-256
records for every runtime file. The source is unmodified; SPECTER only adds
placement, a High/Ultra/Extreme quality gate, and existing perimeter collision
continues to use the lightweight authored boundary panels.

## Runtime budget

The detailed panels stream only after the core mission is ready and only when
the texture tier is High or 4K-preferred with High, Ultra, or Extreme
vegetation. Mobile Ultra Low, Competitive Low, and Medium remain on the
existing procedural/security-scrim fallback and never request this closure.
The fence asset is not service-worker precached.

The imported wire material retains the official transparent double-sided PBR
configuration. It receives lighting but does not cast expensive alpha-tested
shadows; the existing posts and rails retain the boundary's shadow/readability
role.
