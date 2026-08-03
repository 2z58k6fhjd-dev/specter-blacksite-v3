param(
    [string]$ProjectPath = "."
)

$ErrorActionPreference = "Stop"

function Replace-Exact {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if (-not $Text.Contains($Old)) {
        throw "Could not find expected code for: $Label`nThe file may already be modified or may be a different version."
    }
    return $Text.Replace($Old, $New)
}

$gamePath = Join-Path $ProjectPath "game.js"
$indexPath = Join-Path $ProjectPath "index.html"
$swPath = Join-Path $ProjectPath "service-worker.js"

foreach ($path in @($gamePath, $indexPath, $swPath)) {
    if (-not (Test-Path $path)) {
        throw "Missing required file: $path"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectPath "backup-v2.4.4-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item $gamePath,$indexPath,$swPath -Destination $backup

$game = Get-Content $gamePath -Raw
$index = Get-Content $indexPath -Raw
$sw = Get-Content $swPath -Raw

# -------------------------------------------------------------------------
# 1. Correct imported weapon transforms.
# The old code overwrote the orientation calculated by orientLongAxisToForward(),
# making both Sketchfab weapons display broadside across the screen.
# -------------------------------------------------------------------------
$oldInstall = @'
  if(kind==='rifle'){
    model.scale.multiplyScalar(.92);model.position.set(0,-.04,-.82);model.rotation.set(.02,Math.PI,0);
  }else{
    model.scale.multiplyScalar(.72);model.position.set(0,-.05,-.20);model.rotation.set(.02,Math.PI,0);
  }
'@

$newInstall = @'
  if(kind==='rifle'){
    // Sketchfab rifle is authored along its local X axis. Rotate +90 degrees
    // so the barrel points down camera-forward (-Z), then place it near the shoulder.
    model.scale.multiplyScalar(.72);
    model.position.set(0,-.025,-.18);
    model.rotation.set(0,Math.PI/2,0);
  }else{
    // The M9 uses the same broadside source orientation.
    model.scale.multiplyScalar(.66);
    model.position.set(0,-.035,-.12);
    model.rotation.set(0,Math.PI/2,0);
  }
'@
$game = Replace-Exact $game $oldInstall $newInstall "licensed weapon transforms"

# Reduce initial normalization sizes so the detailed models fit a first-person view.
$game = $game.Replace(
    "maxDimension:1.85,exclude:",
    "maxDimension:1.28,exclude:"
)
$game = $game.Replace(
    "maxDimension:.72});orientLongAxisToForward",
    "maxDimension:.48});orientLongAxisToForward"
)

# Raise the soldier so the lower body is not buried below the floor.
$oldSoldierPos = "  model.position.set(0,0,0);model.rotation.y=Math.PI;"
$newSoldierPos = @'
  // The source pivot is near the torso instead of the boots. Lift the clone
  // so the feet meet the floor rather than burying the lower body.
  model.position.set(0,1.02,0);
  model.rotation.y=Math.PI;
'@
$game = Replace-Exact $game $oldSoldierPos $newSoldierPos "soldier floor alignment"

# -------------------------------------------------------------------------
# 2. Improve hip-fire and ADS positions for the newly rotated models.
# -------------------------------------------------------------------------
$oldPoses = @'
    const hip=currentWeapon==='rifle'?new THREE.Vector3(.38,-.34,-.72):new THREE.Vector3(.34,-.31,-.61);
    const ads=currentWeapon==='rifle'?new THREE.Vector3(0,-.22,-.52):new THREE.Vector3(0,-.205,-.47);
    const sprint=currentWeapon==='rifle'?new THREE.Vector3(.48,-.52,-.54):new THREE.Vector3(.45,-.48,-.52);
'@
$newPoses = @'
    // Hand-tuned viewmodel poses for the imported Sketchfab weapons.
    // ADS raises the optic/sights to the exact centerline without clipping the camera.
    const hip=currentWeapon==='rifle'?new THREE.Vector3(.31,-.29,-.50):new THREE.Vector3(.27,-.27,-.46);
    const ads=currentWeapon==='rifle'?new THREE.Vector3(0,-.135,-.36):new THREE.Vector3(0,-.145,-.34);
    const sprint=currentWeapon==='rifle'?new THREE.Vector3(.43,-.46,-.43):new THREE.Vector3(.39,-.42,-.40);
'@
$game = Replace-Exact $game $oldPoses $newPoses "hip, ADS, and sprint poses"

# -------------------------------------------------------------------------
# 3. Fix the procedural optic rings too, so fallback mode remains usable.
# TorusGeometry already faces the camera in its default XY plane.
# -------------------------------------------------------------------------
$game = $game.Replace(
    "scopeRear.rotation.x=Math.PI/2;",
    "scopeRear.rotation.x=0;"
)
$game = $game.Replace(
    "scopeFront.rotation.x=Math.PI/2;",
    "scopeFront.rotation.x=0;"
)

# -------------------------------------------------------------------------
# 4. Add a semi/auto fire selector if the previous hotfix was not applied.
# -------------------------------------------------------------------------
if (-not $game.Contains("let rifleFireMode=")) {
    $game = $game.Replace(
        "let currentWeapon='rifle';",
        "let currentWeapon='rifle';`nlet rifleFireMode='auto';"
    )

    $oldHud = "document.getElementById('weaponName').textContent=currentWeapon==='rifle'?'HK416':'M9A4';"
    $newHud = "document.getElementById('weaponName').textContent=currentWeapon==='rifle'?``HK416 · `${rifleFireMode.toUpperCase()}``:'M9A4 · SEMI';"
    $game = Replace-Exact $game $oldHud $newHud "fire mode HUD"

    $switchFn = @'
function toggleFireMode(){
  if(currentWeapon!=='rifle'){toast('M9A4 · SEMI');return}
  rifleFireMode=rifleFireMode==='auto'?'semi':'auto';
  fireHeld=false;
  toast(`FIRE MODE · ${rifleFireMode.toUpperCase()}`);
  updateHud();
}
'@
    $game = $game.Replace(
        "function damagePlayer(amount){",
        $switchFn + "`nfunction damagePlayer(amount){"
    )

    $oldKeys = "if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon('rifle');"
    $newKeys = "if(e.code==='KeyR')reload();if(e.code==='KeyB'&&!e.repeat)toggleFireMode();if(e.code==='Digit1')switchWeapon('rifle');"
    $game = Replace-Exact $game $oldKeys $newKeys "B-key fire selector"

    $game = $game.Replace(
        "if(fireHeld&&currentWeapon==='rifle'&&!reloading)shoot();",
        "if(fireHeld&&currentWeapon==='rifle'&&rifleFireMode==='auto'&&!reloading)shoot();"
    )
}

# -------------------------------------------------------------------------
# 5. Add visible model diagnostics so future failures cannot hide silently.
# -------------------------------------------------------------------------
if (-not $game.Contains("function modelStatus(")) {
    $diag = @'
function modelStatus(name,state,detail=''){
  const prefix=`MODEL ${name}: ${state}`;
  console.log(prefix,detail);
  if(state==='FAILED')toast(`${prefix} — CHECK CONSOLE`);
}
'@
    $game = $game.Replace(
        "function loadGLTF(url){return new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject));}",
        "function loadGLTF(url){return new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject));}`n$diag"
    )

    $game = $game.Replace(
        "orientLongAxisToForward(r);modelTemplates.ar15=r;installWeaponModel(r,rifle,'rifle');",
        "orientLongAxisToForward(r);modelTemplates.ar15=r;installWeaponModel(r,rifle,'rifle');modelStatus('AR15','LOADED');"
    )
    $game = $game.Replace(
        "}else console.warn('AR-15 model fallback active',results[0].reason);",
        "}else{modelStatus('AR15','FAILED',results[0].reason);console.warn('AR-15 model fallback active',results[0].reason);}"
    )
    $game = $game.Replace(
        "orientLongAxisToForward(r);modelTemplates.m9=r;installWeaponModel(r,pistol,'pistol');",
        "orientLongAxisToForward(r);modelTemplates.m9=r;installWeaponModel(r,pistol,'pistol');modelStatus('M9','LOADED');"
    )
    $game = $game.Replace(
        "}else console.warn('M9 model fallback active',results[1].reason);",
        "}else{modelStatus('M9','FAILED',results[1].reason);console.warn('M9 model fallback active',results[1].reason);}"
    )
    $game = $game.Replace(
        "modelTemplates.soldier=r;pendingEnemyModels.splice(0).forEach(installSoldierModel);",
        "modelTemplates.soldier=r;pendingEnemyModels.splice(0).forEach(installSoldierModel);modelStatus('SOLDIER','LOADED');"
    )
    $game = $game.Replace(
        "}else console.warn('Soldier model fallback active',results[2].reason);",
        "}else{modelStatus('SOLDIER','FAILED',results[2].reason);console.warn('Soldier model fallback active',results[2].reason);}"
    )
}

# Build/version identifiers.
$game = $game.Replace("SPECTER 2.4.1", "SPECTER 2.4.4")
$index = [regex]::Replace($index, 'BUILD [^<"]+', 'BUILD 2.4.4-MODEL-ALIGNMENT')
$index = [regex]::Replace($index, 'game\.js\?v=[^"]+', 'game.js?v=2.4.4')
$index = $index.Replace(
    'R reload · 1 rifle · 2 pistol',
    'R reload · B fire mode · 1 rifle · 2 pistol'
)
$sw = [regex]::Replace(
    $sw,
    "const CACHE='[^']+';",
    "const CACHE='specter-3d-v2.4.4-model-alignment';"
)

Set-Content -Path $gamePath -Value $game -Encoding UTF8
Set-Content -Path $indexPath -Value $index -Encoding UTF8
Set-Content -Path $swPath -Value $sw -Encoding UTF8

Write-Host ""
Write-Host "SPECTER v2.4.4 hotfix applied successfully." -ForegroundColor Green
Write-Host "Backup saved to: $backup"
Write-Host ""
Write-Host "Upload these three modified files to the GitHub repository root:"
Write-Host "  game.js"
Write-Host "  index.html"
Write-Host "  service-worker.js"
Write-Host ""
Write-Host "Expected build label: BUILD 2.4.4-MODEL-ALIGNMENT"
Write-Host "Press B to switch HK416 SEMI / AUTO."
