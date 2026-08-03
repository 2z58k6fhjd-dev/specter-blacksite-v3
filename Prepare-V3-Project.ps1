param([string]$OldProject=".",[string]$NewProject="./SPECTER-v3")
$ErrorActionPreference="Stop"
New-Item -ItemType Directory -Force -Path $NewProject | Out-Null
Copy-Item ".\index.html",".\styles.css",".\service-worker.js",".\manifest.webmanifest",".\README.md" -Destination $NewProject
Copy-Item ".\src" -Destination $NewProject -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $NewProject "assets") | Out-Null
foreach($name in @("ar15","m9","soldier")){
  $source=Join-Path $OldProject "assets\$name"
  if(Test-Path $source){Copy-Item $source -Destination (Join-Path $NewProject "assets") -Recurse -Force;Write-Host "Copied $name" -ForegroundColor Green}
  else{Write-Warning "Missing $source — copy it manually before uploading."}
}
Write-Host "SPECTER v3 project prepared at $NewProject" -ForegroundColor Cyan
