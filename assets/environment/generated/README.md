# Project-generated forest billboard

`fir-tree-billboard-v1.png` is the runtime photo-tree impostor used only by
the High, Ultra, and Extreme perimeter-forest tiers. It was generated for this
project from a clean chroma-key source and then passed through a local
chroma-key transparency step; it is not a downloaded third-party model.

## Generation record

- Source output: `fir-tree-chromakey-v1.png`
- Runtime output: `fir-tree-billboard-v1.png`
- Image generation output ID: `exec-7ee61f93-0a6c-4ab9-9290-17427054071a`
- Prompt intent: a photorealistic Pacific Northwest Douglas fir, isolated on a
  flat chroma background, with no text, ground, or cast shadow.
- Transparency processing: chroma key removal; the source is retained so the
  runtime card can be regenerated or adjusted later.

The card is a performance-conscious high-tier foliage enhancement, not a claim
that the fallback procedural forest is a full authored 3D tree pack.

## Douglas fir PBR card v2

`douglas-fir-card-v2.png` is a second, project-authored transparent conifer
card used with the existing version-one card at High, Ultra, and Extreme
vegetation density. It has companion runtime maps:

- `douglas-fir-card-v2-normal.png`
- `douglas-fir-card-v2-roughness.png`

The browser uses these maps only for the high-tier instanced card layer; the
compact procedural forest remains the all-tier fallback. These files are not a
downloaded tree model, scan, or substitute for a full authored 3D tree pack.

- Source output: `douglas-fir-card-v2-source.png`
- Runtime alpha-cutout: `douglas-fir-card-v2.png`
- Image generation output ID: `exec-670de1a7-ee9c-4f85-ab7f-9a0f5891cc76`
- Prompt intent: a realistic mature Pacific Northwest Douglas fir, isolated on
  a flat chroma background, no ground plane, text, people, or cast shadow.
- Transparency processing: project chroma-key removal; the source is retained
  with the runtime cutout for reproducibility.
- Derived PBR maps: `scripts/build-tree-card-maps.py`, which builds a
  conservative foliage normal response and high-roughness map from the final
  alpha-cutout.

This is a project-owned generated bitmap asset. It carries no third-party tree
model license or attribution claim.
