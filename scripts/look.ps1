<#
.SYNOPSIS
  Collect the newest screenshots / screen recordings so Claude can look at them.

.DESCRIPTION
  Claude cannot run the iOS app — no Mac, no simulator — so the feedback loop is
  "Magne captures, Claude looks". This removes the manual copying from that loop.

  It scans the usual landing spots for recent image/video files, copies them into
  scratch\look\ under predictable names, and for videos extracts a strip of
  frames (cropped to the bottom of the screen by default, which is where the tab
  bar and sheets live). Claude then reads the PNGs directly.

  scratch\ is gitignored, so nothing here is ever committed.

.EXAMPLE
  .\scripts\look.ps1
  Collect anything captured in the last 30 minutes.

.EXAMPLE
  .\scripts\look.ps1 -Minutes 120 -Full
  Look further back, and keep whole frames instead of cropping to the bar.
#>
[CmdletBinding()]
param(
  # How far back to look for new captures.
  [int]$Minutes = 30,
  # Extract whole frames rather than cropping to the bottom of the screen.
  [switch]$Full,
  # How many frames to pull out of each video.
  [int]$Frames = 6,
  # Extra folders to scan.
  [string[]]$Path = @()
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $repo 'scratch\look'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# ffmpeg is installed per-user by winget and its shim is not always on PATH.
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $ffmpeg) {
  $guess = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName
  if ($guess) { $ffmpeg = $guess }
}

$roots = @(
  (Join-Path $repo 'scratch'),
  "$env:USERPROFILE\Pictures\Screenshots",
  "$env:USERPROFILE\Downloads",
  "$env:USERPROFILE\Desktop",
  "$env:USERPROFILE\Pictures"
) + $Path | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$since = (Get-Date).AddMinutes(-$Minutes)
$exts  = @('.png','.jpg','.jpeg','.heic','.mp4','.mov','.m4v')

$items = foreach ($r in $roots) {
  Get-ChildItem -LiteralPath $r -File -Recurse -Depth 2 -ErrorAction SilentlyContinue |
    Where-Object {
      $exts -contains $_.Extension.ToLower() -and
      $_.LastWriteTime -gt $since -and
      # Skip anything this script produced on a previous run, or intermediate
      # copies — otherwise every round doubles the number of "new" captures.
      $_.FullName -notlike "$out*" -and
      $_.DirectoryName -notlike "*\scratch\vid*" -and
      $_.DirectoryName -notlike "*\scratch\look*"
    }
}

$items = $items | Sort-Object LastWriteTime

if (-not $items) {
  Write-Host "Nothing captured in the last $Minutes minutes."
  Write-Host "Scanned:"
  $roots | ForEach-Object { Write-Host "  $_" }
  Write-Host "Try a bigger -Minutes, or drop the file into scratch\ yourself."
  return
}

# Start clean so Claude never reads a stale capture from a previous round.
Get-ChildItem $out -File -ErrorAction SilentlyContinue | Remove-Item -Force

$i = 0
foreach ($f in $items) {
  $i++
  $stamp = $f.LastWriteTime.ToString('HHmm')
  $isVideo = @('.mp4','.mov','.m4v') -contains $f.Extension.ToLower()
  $base = "{0:d2}_{1}" -f $i, $stamp

  if ($isVideo) {
    if (-not $ffmpeg) { Write-Warning "ffmpeg not found; skipping video $($f.Name)"; continue }
    $dest = Join-Path $out "$base.mp4"
    Copy-Item -LiteralPath $f.FullName -Destination $dest -Force

    # Frame height is unknown up front, so crop relative to the source using
    # ffmpeg's own in/ih variables rather than hardcoding a phone resolution.
    $crop = if ($Full) { 'crop=iw:ih:0:0' } else { 'crop=iw:ih*0.18:0:ih*0.80' }
    $strip = Join-Path $out "$base`_strip.png"
    $vf = "$crop,fps=$([math]::Round($Frames / 12, 3)),scale=1100:-2,tile=1x$Frames"
    & $ffmpeg -y -v error -i $dest -vf $vf -frames:v 1 $strip 2>&1 | Out-Null
    if (Test-Path $strip) {
      Write-Host "VIDEO  $($f.Name)"
      Write-Host "       -> $strip"
    } else {
      Write-Warning "Could not build a frame strip for $($f.Name)"
    }
  }
  else {
    $dest = Join-Path $out "$base$($f.Extension.ToLower())"
    # HEIC is not readable directly; convert if we can.
    if ($f.Extension.ToLower() -eq '.heic' -and $ffmpeg) {
      $dest = Join-Path $out "$base.png"
      & $ffmpeg -y -v error -i $f.FullName $dest 2>&1 | Out-Null
    } else {
      Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
    }
    Write-Host "IMAGE  $($f.Name)"
    Write-Host "       -> $dest"
  }
}

Write-Host ""
Write-Host "Collected in: $out"
Write-Host "Tell Claude to look."
exit 0
