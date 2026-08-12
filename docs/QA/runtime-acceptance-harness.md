# Runtime acceptance harness

`npm run qa:runtime` is the dependency-free release gate for the browser-facing
mission wiring. It complements, rather than replaces, `qa:graphics` and
`qa:gameplay`:

- It checks the live UI contract for every preset and custom graphics control,
  graphics/voice persistence, the active GPU-memory estimate, and the AUTO
  capability/benchmark decision.
- It protects the localhost-only QA entry routes for the breaker, exterior,
  forest, storage, utility, voice, and victory paths.
- It proves the input-to-action connections for firing, reload, chamber check,
  inspect, fire-mode selection, and the M9 switch; voice/subtitle routing; and
  the grounded enemy-death to pooled weapon/gear-drop handoff.
- It protects the optional CC0 M9 empty-reload foley path: the full sequence
  must decode through the mechanism loader, sustain through its terminal fade,
  and remain layered under the marker-synced magazine/slide fallback.
- It verifies that normal extraction remains gated by power, cleared hostiles,
  and arrival, then ends at the victory panel.

The dependency-free script protects source-level contracts. It is now paired
with `npm run qa:browser`, a Chromium acceptance suite run before every Pages
deployment. The browser suite starts the same static-root server Pages uses and
executes a Galaxy A16-class touch context plus desktop mission flows. It proves
the rendered mission shell loads, Mobile Ultra Low selects the real low payload,
touch interaction can restore power, weapon controls produce runtime feedback,
the real High-quality CC0 fir LOD chain streams, and the full death/extraction
path reaches victory. The dependency-free
graphics gate separately validates every saved custom-control and query-override
contract. Failure traces,
screenshots, and video are retained by CI for 14 days.

```text
node scripts/runtime-acceptance.mjs --url http://127.0.0.1:4175/
```

## Required real-browser spot checks before publishing

These routes are intentionally accepted only on `localhost` or `127.0.0.1`.
They exercise the same start, breaker, enemy, and extraction functions as a
normal mission; they are not production cheat routes.

1. Open `?quality=auto&qa=breaker`, enter the mission, and wait for the
   `AUTO GRAPHICS → … (… MS P90)` message. Confirm the active summary tells the
   truth about the selected preset and low-payload texture path when applicable.
2. Open the graphics panel, change several custom settings, reload **without**
   a `quality` query, and confirm the summary and controls are restored. Use an
   explicit `quality` query for a clean preset test; it intentionally wins over
   saved custom settings.
3. At `?qa=breaker`, press `E` and confirm `POWER ONLINE` plus
   `EXIT THE FACILITY — CLEAR THE EXTERIOR`.
4. While in a mission, press `C`, `I`, and `B`; confirm the chamber-check,
   inspection, and fire-mode feedback. Observe an enemy subtitle/callout while
   nearby hostiles react.
5. Open `?quality=performance&qa=victory`, enter, and wait for
   `BLACKSITE SECURED`. This route invokes the normal grounded death entry for
   every hostile before it reaches the normal extraction sequence. The exact
   pooled drop meshes are a render-only Three.js detail, so their timed settle
   transition is protected by the deterministic gate rather than inferred from
   a DOM label.

## Latest local browser record (5.14.0-FOREST-BROWSER)

On 2026-08-11, the local browser run completed all five spot checks:

- AUTO selected `COMPETITIVE LOW`, loaded the real `512px low payload`, and
  reported a `15 MS P90` benchmark result.
- A High custom profile with Standard textures, Medium vegetation, SSR enabled,
  and ground grass disabled persisted across a reload without a quality query;
  the panel reported a live 3.01 GB allocation estimate.
- The breaker route advanced from `POWER OFFLINE` to `POWER ONLINE` and the
  exterior objective.
- Chamber check, inspection, and fire-mode actions showed their runtime
  feedback; a hostile subtitle/callout appeared during the same run.
- The victory route showed `BLACKSITE SECURED` with
  `12 HOSTILES NEUTRALIZED · POWER RESTORED · EXTRACTION REACHED` after the
  gate-run and pursuit callout.

The 5.14 Chromium acceptance suite adds a High forest inspection flow. On
2026-08-11 it verified the live post-readiness CC0 Fir Sapling presentation:
six hero LOD chains plus six nearby instanced LOD1 details at the forest camera
route. The full suite runs before packaging or deployment and retains browser
evidence on failure.

This evidence is scoped to a local Chromium renderer and does not claim real
Galaxy A16 or Intel HD 4600 hardware measurement, authored-animation visual
fidelity, or mass-forest asset quality. Those require separate device checks.

## 5.9.0 audio follow-up

On 2026-08-11, a clean local 5.9.0-FOREST-RUNTIME-AUDIO run reported
`2 reports + 1 reload layer` after audio activation. The M9 empty-reload path
completed with no console warnings or errors after the v590 cache update. This
confirms fetch/decode/wiring and fallback continuity; final subjective mix and
clipping evaluation remains a real-speaker/headphone check.
