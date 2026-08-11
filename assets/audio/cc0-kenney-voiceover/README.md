# CC0 tactical voice callouts

This directory contains 14 source clips selected from the official **Kenney
Voiceover Pack #1** for tactical enemy-state callouts. The local `License.txt`
and `Credits.txt` are retained unmodified from the official archive.

- Source page: <https://www.kenney.nl/assets/voiceover-pack/>
- Official archive: `kenney_voiceover-pack.zip`
- License: Creative Commons Zero 1.0 (CC0)
- Male actor credit: Jeffrey M. Smith
- Female actor credit: Giselle

The runtime loads one male or female variant for each supported callout type:
contact, investigate, backup request, flank, retreat, suppression, and downed. They
are spatialized and narrowed through a radio filter when the AI communicates by
radio. If an OGG clip cannot download or decode, `src/audio-overhaul.js` uses
its existing procedural callout fallback, so audio availability never blocks a
mission.

The source pack’s female suppression filename is intentionally preserved as
`Female-war_supressing_fire.ogg` because that is the spelling used by the
official archive.
