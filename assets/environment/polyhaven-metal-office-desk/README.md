# Poly Haven Metal Office Desk - optional high-detail facility dressing

This folder contains the official **2K** glTF closure for
[Metal Office Desk](https://polyhaven.com/a/metal_office_desk). It is a
5.00 MiB source closure with a 6,898-triangle static desk and three PBR maps.

## License and source

- License: [CC0 1.0](https://polyhaven.com/license)
- Official files API: <https://api.polyhaven.com/files/metal_office_desk>
- Model credit shown by Poly Haven: Ulan Cabanilla

`manifest.json` retains the official download MD5 values and local SHA-256
records for every runtime file. The source geometry and maps are unmodified;
SPECTER adds only placement, a quality gate, and a lightweight collision
envelope for the installed desk roots.

## Runtime budget

The desks stream only after the core mission is ready and only when the texture
tier is High or 4K-preferred. Mobile Ultra Low, Competitive Low, Performance,
and Medium retain the existing procedural desks and never request this closure.
The desk asset is not service-worker precached.
