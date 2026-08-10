# Poly Haven Power Box 01 - browser runtime tier

This folder contains the official **Power Box 01** glTF from
<https://polyhaven.com/a/power_box_01>, downloaded at the 2K browser-quality
tier. Poly Haven distributes the asset under CC0 1.0. Credits listed by the
source: Rico Cilliers (modeling/texturing) and Yann Kervran (rigging).

## Runtime behavior

`src/main.js` mounts the textured cabinet around the facility breaker. The
source's static `power_box_01_door` mesh is intentionally hidden: the project
keeps its existing animated breaker door, live lamps, and lever so pressing `E`
still visibly flips the breaker and opens the exterior exit. The high-detail
cabinet is otherwise an unmodified clone with shadowing enabled.

## Provenance and verification

| Runtime file | Official source | Official MD5 |
| --- | --- | --- |
| `power_box_01_2k.gltf` | `Models/gltf/2k/power_box_01/power_box_01_2k.gltf` | `d0549520e06ea7437906992f4e9152f3` |
| `power_box_01.bin` | `Models/gltf/8k/power_box_01/power_box_01.bin` | `e76df413e15ce8a76eb50971266d2450` |
| `textures/power_box_01_diff_2k.jpg` | `Models/jpg/2k/power_box_01/power_box_01_diff_2k.jpg` | `c911f1ffb29ea558069498a01d5ccc5a` |
| `textures/power_box_01_nor_gl_2k.jpg` | `Models/jpg/2k/power_box_01/power_box_01_nor_gl_2k.jpg` | `453ff402c8af7f09a53644fcdc604e7f` |
| `textures/power_box_01_arm_2k.jpg` | `Models/jpg/2k/power_box_01/power_box_01_arm_2k.jpg` | `af49a41c1fa2c50456e3f7c2eaabd3b0` |

All five local runtime files were compared against the official API MD5 values
when this folder was added. The original source archive is not bundled.
