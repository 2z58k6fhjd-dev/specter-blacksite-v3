$ErrorActionPreference = 'Stop'

function Replace-Required {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Description
    )
    if (-not $Text.Contains($Old)) {
        throw "Could not find the expected code for: $Description. No files were changed."
    }
    return $Text.Replace($Old, $New)
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$gamePath = Join-Path $root 'game.js'
$indexPath = Join-Path $root 'index.html'
$swPath = Join-Path $root 'service-worker.js'

foreach ($path in @($gamePath, $indexPath, $swPath)) {
    if (-not (Test-Path $path)) {
        throw "Missing required file: $path`nPut this script beside game.js, index.html, and service-worker.js."
    }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backup-before-v2.4.3-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item $gamePath, $indexPath, $swPath -Destination $backup

$game = Get-Content $gamePath -Raw
$index = Get-Content $indexPath -Raw
$sw = Get-Content $swPath -Raw

# 1) Correct the optic rings. TorusGeometry already faces along the Z axis,
# so rotating the rings 90 degrees makes them cut across the sight picture.
$game = Replace-Required $game `
"const scopeRear=new THREE.Mesh(new THREE.TorusGeometry(.085,.012,10,28),gunDark);scopeRear.position.set(0,.22,-.095);scopeRear.rotation.x=Math.PI/2;scopeRear.userData.fallbackVisual=true;rifle.add(scopeRear);" `
"const scopeRear=new THREE.Mesh(new THREE.TorusGeometry(.085,.012,10,28),gunDark);scopeRear.position.set(0,.22,-.095);scopeRear.userData.fallbackVisual=true;rifle.add(scopeRear);" `
'optic rear ring alignment'

$game = Replace-Required $game `
"const scopeFront=new THREE.Mesh(new THREE.TorusGeometry(.088,.012,10,28),gunDark);scopeFront.position.set(0,.22,-.585);scopeFront.rotation.x=Math.PI/2;scopeFront.userData.fallbackVisual=true;rifle.add(scopeFront);" `
"const scopeFront=new THREE.Mesh(new THREE.TorusGeometry(.088,.012,10,28),gunDark);scopeFront.position.set(0,.22,-.585);scopeFront.userData.fallbackVisual=true;rifle.add(scopeFront);" `
'optic front ring alignment'

# 2) Add rifle fire-mode state.
$game = Replace-Required $game `
"let currentWeapon='rifle';" `
"let currentWeapon='rifle';`nlet rifleFireMode='auto';" `
'fire-mode state'

# 3) Show fire mode in the HUD.
$oldHud = "function updateHud(){document.getElementById('hp').textContent=Math.max(0,Math.round(hp));document.getElementById('armor').textContent=Math.max(0,Math.round(armor));document.getElementById('weaponName').textContent=currentWeapon==='rifle'?'HK416':'M9A4';document.getElementById('ammo').textContent=currentWeapon==='rifle'?`${ammo}/${reserve}`:`${pistolAmmo}/${pistolReserve}`;document.getElementById('secure').textContent=`${kills}/${AI.totalHostiles}`;document.getElementById('lightState').textContent=flashOn?'ON':'OFF';document.getElementById('powerState').textContent=powerOn?'ONLINE':'OFFLINE'}"
$newHud = "function updateHud(){document.getElementById('hp').textContent=Math.max(0,Math.round(hp));document.getElementById('armor').textContent=Math.max(0,Math.round(armor));document.getElementById('weaponName').textContent=currentWeapon==='rifle'?`HK416 · ${rifleFireMode.toUpperCase()}`:'M9A4 · SEMI';document.getElementById('ammo').textContent=currentWeapon==='rifle'?`${ammo}/${reserve}`:`${pistolAmmo}/${pistolReserve}`;document.getElementById('secure').textContent=`${kills}/${AI.totalHostiles}`;document.getElementById('lightState').textContent=flashOn?'ON':'OFF';document.getElementById('powerState').textContent=powerOn?'ONLINE':'OFFLINE'}"
$game = Replace-Required $game $oldHud $newHud 'HUD fire-mode display'

# 4) Add selector function and B-key binding.
$oldSwitch = "function switchWeapon(type){if(reloading||type===currentWeapon)return;currentWeapon=type;rifle.visible=type==='rifle';pistol.visible=type==='pistol';placeMuzzle();playSound('bolt');toast(type==='rifle'?'HK416 READY':'M9A4 READY');updateHud()}"
$newSwitch = @"
function switchWeapon(type){if(reloading||type===currentWeapon)return;currentWeapon=type;rifle.visible=type==='rifle';pistol.visible=type==='pistol';placeMuzzle();playSound('bolt');toast(type==='rifle'?`HK416 ${rifleFireMode.toUpperCase()}`:'M9A4 SEMI');updateHud()}
function toggleFireMode(){
  if(currentWeapon!=='rifle'){toast('M9A4 — SEMI ONLY');return}
  rifleFireMode=rifleFireMode==='auto'?'semi':'auto';
  fireHeld=false;
  playSound('bolt');
  toast(`HK416 — ${rifleFireMode.toUpperCase()}`);
  updateHud();
}
"@
$game = Replace-Required $game $oldSwitch $newSwitch 'fire-mode selector function'

$oldKeys = "addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){flashOn=!flashOn;flashlight.visible=flashOn;updateHud()}if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol')});addEventListener('keyup',e=>keys[e.code]=false);"
$newKeys = "addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'){flashOn=!flashOn;flashlight.visible=flashOn;updateHud()}if(e.code==='KeyR')reload();if(e.code==='KeyB'&&!e.repeat)toggleFireMode();if(e.code==='Digit1')switchWeapon('rifle');if(e.code==='Digit2')switchWeapon('pistol')});addEventListener('keyup',e=>keys[e.code]=false);"
$game = Replace-Required $game $oldKeys $newKeys 'B-key fire selector'

# 5) Continuous fire only in AUTO. Mousedown still fires exactly one initial round,
# which gives SEMI one shot per click.
$game = Replace-Required $game `
"if(fireHeld&&currentWeapon==='rifle'&&!reloading)shoot();" `
"if(fireHeld&&currentWeapon==='rifle'&&rifleFireMode==='auto'&&!reloading)shoot();" `
'automatic-fire loop'

# 6) Version and controls text.
$index = $index.Replace('BUILD 2.4.2-CORRECT-MODEL-PATHS', 'BUILD 2.4.3-OPTIC-FIRE-MODE')
$index = $index.Replace('E interact · F flashlight · R reload · 1 rifle · 2 pistol', 'E interact · F flashlight · R reload · B semi/auto · 1 rifle · 2 pistol')
$index = $index.Replace('./game.js?v=2.4.2', './game.js?v=2.4.3')

$sw = $sw.Replace("specter-3d-v2.4.2-correct-model-paths", "specter-3d-v2.4.3-optic-fire-mode")

Set-Content -Path $gamePath -Value $game -Encoding UTF8
Set-Content -Path $indexPath -Value $index -Encoding UTF8
Set-Content -Path $swPath -Value $sw -Encoding UTF8

Write-Host ''
Write-Host 'SPECTER v2.4.3 hotfix applied successfully.' -ForegroundColor Green
Write-Host "Backup created at: $backup"
Write-Host 'Upload game.js, index.html, and service-worker.js to GitHub.'
Write-Host 'In game: press B to switch HK416 SEMI/AUTO.'
