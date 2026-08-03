SPECTER v2.4.3 — OPTIC + FIRE MODE MANUAL HOTFIX
================================================

WHAT THIS FIXES
- Corrects the two procedural optic rings so they no longer turn sideways across the sight picture.
- Adds B to switch the HK416 between SEMI and AUTO.
- SEMI fires one shot for each mouse click.
- AUTO fires continuously while the mouse button is held.
- The pistol remains SEMI only.
- The HUD displays HK416 · SEMI, HK416 · AUTO, or M9A4 · SEMI.
- Updates the build label and service-worker cache to v2.4.3.

EASIEST INSTALLATION
1. Download and extract this ZIP.
2. From your GitHub repository, download these current files:
   - game.js
   - index.html
   - service-worker.js
3. Put those three files in the SAME folder as Apply-SPECTER-v2.4.3-Hotfix.ps1.
4. Right-click Apply-SPECTER-v2.4.3-Hotfix.ps1 and choose “Run with PowerShell.”

If Windows blocks the script:
1. Open PowerShell in that folder.
2. Run:
   powershell -ExecutionPolicy Bypass -File .\Apply-SPECTER-v2.4.3-Hotfix.ps1

The script creates a dated backup folder before changing anything.

UPLOAD TO GITHUB
1. Open your specter-blacksite-v3 repository.
2. Upload/replace ONLY:
   - game.js
   - index.html
   - service-worker.js
3. Commit the changes.
4. Wait for GitHub Pages to finish deploying.
5. Reload the game. The top should say:
   BUILD 2.4.3-OPTIC-FIRE-MODE

If the old build remains, open the site in a private browser tab once or clear the site’s service worker/cache.

CONTROL
B = toggle HK416 SEMI/AUTO
