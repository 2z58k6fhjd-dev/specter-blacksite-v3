SPECTER v2.4.4 — MODEL ALIGNMENT HOTFIX
================================================

WHAT THIS FIXES
---------------
- Rotates the imported AR-15 so the barrel points forward instead of across the screen.
- Rotates and resizes the imported M9 correctly.
- Repositions rifle and pistol hip-fire poses.
- Repositions rifle and pistol ADS poses.
- Raises the imported soldier so his legs are no longer buried under the floor.
- Corrects the procedural fallback optic rings.
- Adds B-key SEMI/AUTO switching for the rifle if it is not already installed.
- Adds console status messages for AR15, M9, and SOLDIER loading.
- Updates the build label and service-worker cache.

HOW TO APPLY
------------
1. Download these three files from the ROOT of your GitHub repository:
     game.js
     index.html
     service-worker.js

2. Put those three files in the same folder as:
     Apply-SPECTER-v2.4.4-Fix.ps1

3. Right-click Apply-SPECTER-v2.4.4-Fix.ps1 and choose:
     Run with PowerShell

   If Windows blocks it, open PowerShell in the folder and run:

     powershell -ExecutionPolicy Bypass -File .\Apply-SPECTER-v2.4.4-Fix.ps1

4. The script creates a timestamped backup folder automatically.

5. Upload the modified files back to the ROOT of the GitHub repository:
     game.js
     index.html
     service-worker.js

6. Commit the changes and wait for GitHub Pages deployment.

7. Open the game with a cache-busting URL:
     https://2z58k6fhjd-dev.github.io/specter-blacksite-v3/?v=244

8. The top-left build label should read:
     BUILD 2.4.4-MODEL-ALIGNMENT

CONTROLS
--------
B = switch HK416 between SEMI and AUTO.
The M9 remains SEMI.

IMPORTANT
---------
This patch is tuned from the screenshots you provided. Because the model's exact
pivot/orientation can differ slightly between browsers and export versions, one
small final position adjustment may still be needed after testing. The major
sideways/buried-model problems should be corrected.
