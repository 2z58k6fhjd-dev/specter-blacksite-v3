# Poly Haven Plastic Container - browser runtime tier

This folder contains the official **Plastic Container** glTF from
<https://polyhaven.com/a/plastic_container>, downloaded at the 2K
browser-quality tier. Poly Haven distributes the asset under CC0 1.0 and lists
PierreB3D as the author.

## Runtime behavior

`src/main.js` places six clones across the motor pool and storage yard. Clones
share source geometry and textures; each has shadows and a collision volume so
the props provide grounded exterior cover instead of visual-only clutter.

## Provenance and verification

| Runtime file | Official source | Official MD5 |
| --- | --- | --- |
| `plastic_container_2k.gltf` | `Models/gltf/2k/plastic_container/plastic_container_2k.gltf` | `80d2c8adcc5192637dab7c43d526611f` |
| `plastic_container.bin` | `Models/gltf/4k/plastic_container/plastic_container.bin` | `3c33225cc3459cc66552cd6570eb72fe` |
| `textures/plastic_container_diff_2k.jpg` | `Models/jpg/2k/plastic_container/plastic_container_diff_2k.jpg` | `eb4afc4a2f5c02e08a54a29f124d9add` |
| `textures/plastic_container_nor_gl_2k.jpg` | `Models/jpg/2k/plastic_container/plastic_container_nor_gl_2k.jpg` | `76e7e6f1820c235afb319f406dd0508a` |
| `textures/plastic_container_arm_2k.jpg` | `Models/jpg/2k/plastic_container/plastic_container_arm_2k.jpg` | `4fe81b22e01b0c6fe4dbf9da1d9f1a1c` |

All five local runtime files were compared against the official API MD5 values
when this folder was added. The original source archive is not bundled.
