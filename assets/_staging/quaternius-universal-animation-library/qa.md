# QA status - Quaternius animation candidate

## Current status

| Check | Status | Evidence |
| --- | --- | --- |
| Source-page license screen | Recorded | `SOURCE.md` and `LICENSE.txt`; page reported CC0 on 2026-08-11. |
| Original archive / SHA-256 | Pending | No archive has been downloaded. |
| Exact clip inventory | Pending | Source page advertises a library, not a chosen clip list in this record. |
| Soldier-rig retarget | Pending | No source skeleton or clip has been inspected. |
| Runtime import | Not applicable | This is intentionally non-runtime. |

## Required test matrix after acquisition

- Verify idle, walk, sprint, transition, landing, armed stance, and death
  behavior at desktop and Intel/Low performance settings.
- Compare root-motion and in-place variants against SPECTER collision and
  navigation; no body drift or teleport correction is acceptable.
- Inspect shoulders, elbows, wrists, hands, fingers, spine, head, and feet at
  close range.  There must be no visible collapse, floor penetration, or loss
  of weapon-support contact.
- If an armed clip is chosen, time any project-authored magazine/bolt/slide
  event independently; the imported body clip is not proof of weapon mechanics.
- Verify a death pose settles before SPECTER's deterministic gear/weapon drop
  system starts, and profile a multi-enemy scene on the Intel/Low path.
