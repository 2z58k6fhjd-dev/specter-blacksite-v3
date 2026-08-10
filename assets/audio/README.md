# Recorded weapon reports

`cc-by-3.0-tabasco/` contains two short runtime derivatives made from the
OpenGameArt **Gunshot Sounds** archive by Vincent Sevedge / Tabasco:

- `rifle-sks-01.wav` - a 1.48-second SKS report derivative.
- `pistol-cz-01.wav` - a 1.44-second CZ report derivative.

Both files are 48 kHz, 16-bit stereo WAV. They were trimmed to isolated early
reports, normalized below full scale, and given short boundary fades. The
original local license is preserved as `cc-by-3.0-tabasco/LICENSE.txt` and is
authoritative: **Creative Commons Attribution 3.0 Unported**. Retain that
notice and provide attribution to Vincent Sevedge / Tabasco when redistributing
these derived audio assets.

Runtime behavior:

- The files are optional recorded transient layers for rifle and pistol fire.
- Existing procedural spatial layers continue to provide suppression filtering,
  indoor/outdoor tails, and casings.
- If a recording cannot download or decode, the game remains playable with the
  procedural fallback and reports that state in Asset Status.

Source page: <https://opengameart.org/content/gunshot-sounds>
