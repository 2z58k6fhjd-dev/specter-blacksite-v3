param(
  [string]$CurrentProject=".",
  [string]$RefreshPackage=".\SPECTER-Blacksite-v3.0.1-Full-Refresh"
)

$ErrorActionPreference="Stop"
$timestamp=Get-Date -Format "yyyyMMdd-HHmmss"
$backup=Join-Path $CurrentProject "backup-before-v3.0.1-$timestamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$preserve=@("assets")
Get-ChildItem $CurrentProject -Force | Where-Object {
  $_.Name -notin @(".git","assets") -and $_.FullName -ne $backup
} | ForEach-Object {
  Copy-Item $_.FullName -Destination $backup -Recurse -Force
  Remove-Item $_.FullName -Recurse -Force
}

Get-ChildItem $RefreshPackage -Force | Where-Object {$_.Name -ne "assets"} | ForEach-Object {
  Copy-Item $_.FullName -Destination $CurrentProject -Recurse -Force
}

Write-Host "Full refresh applied." -ForegroundColor Green
Write-Host "Existing assets folder was preserved."
Write-Host "Backup: $backup"
