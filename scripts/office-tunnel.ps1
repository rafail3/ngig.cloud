# Keeps the OnlyOffice Document Server reachable from production.
#
# The container runs on this machine, which has no public IP, so a Cloudflare
# quick tunnel fronts it with HTTPS. Those tunnels hand out a NEW random URL
# every time they start — so rather than anyone editing config by hand, this
# script reads the URL cloudflared just printed and tells the app where the
# server moved to (POST /api/office/register). The app stores it as a runtime
# setting and picks it up within seconds. Nothing to click, nothing to redeploy.
#
# Run it at logon via Task Scheduler (see README note at the bottom).
#
# Requires: cloudflared on PATH, and OFFICE_REGISTER_SECRET matching the value
# set in the app's environment.

param(
  [string]$AppUrl        = $env:OFFICE_APP_URL,
  [string]$RegisterSecret = $env:OFFICE_REGISTER_SECRET,
  [int]   $LocalPort     = 8080,
  [string]$Cloudflared   = $env:OFFICE_CLOUDFLARED
)

if (-not $AppUrl)         { $AppUrl = "https://ngig.cloud" }
if (-not $RegisterSecret) { throw "OFFICE_REGISTER_SECRET is not set." }

# Resolve cloudflared ourselves rather than trusting PATH: Task Scheduler starts
# us with a leaner environment than a login shell, and a missing PATH entry would
# only show up as a tunnel that silently never came back.
if (-not $Cloudflared) {
  $Cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
}
if (-not $Cloudflared) {
  $Cloudflared = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Cloudflared) { throw "cloudflared not found. Pass -Cloudflared <path>." }

$logDir = Join-Path $env:LOCALAPPDATA "ngig-office"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$tunnelLog = Join-Path $logDir "cloudflared.log"
$scriptLog = Join-Path $logDir "office-tunnel.log"

function Write-Log($message) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Add-Content -Path $scriptLog -Value $line
  Write-Output $line
}

function Wait-DocumentServer {
  Write-Log "waiting for the document server on port $LocalPort"
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$LocalPort/healthcheck" -TimeoutSec 3 -UseBasicParsing
      if ($r.Content.Trim() -eq "true") { Write-Log "document server is up"; return $true }
    } catch { }
    Start-Sleep -Seconds 5
  }
  return $false
}

# Start a fresh tunnel and tell the app where it landed. Returns the cloudflared
# process + its public URL, or $null if it never came up.
function Start-Tunnel {
  # Clear any tunnel from a previous session first — after the laptop wakes from
  # sleep the old process often lingers ALIVE but disconnected, its URL dead. If
  # we didn't kill it we'd stack tunnels and leave a stale URL registered.
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item $tunnelLog -ErrorAction SilentlyContinue

  Write-Log "starting cloudflared ($Cloudflared)"
  $proc = Start-Process -FilePath $Cloudflared `
    -ArgumentList @("tunnel", "--url", "http://localhost:$LocalPort", "--logfile", $tunnelLog) `
    -WindowStyle Hidden -PassThru

  # cloudflared prints the assigned hostname a few seconds in.
  $url = $null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" |
           Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value; break }
    }
  }
  if (-not $url) {
    Write-Log "ERROR: cloudflared never printed a URL; see $tunnelLog"
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
    return $null
  }
  Write-Log "tunnel is at $url"

  try {
    $body = @{ url = $url } | ConvertTo-Json -Compress
    $res = Invoke-RestMethod -Uri "$AppUrl/api/office/register" -Method Post `
      -Headers @{ Authorization = "Bearer $RegisterSecret" } `
      -ContentType "application/json" -Body $body -TimeoutSec 15
    Write-Log "registered with $AppUrl -> $($res.url)"
  } catch {
    Write-Log "ERROR: could not register the URL: $_"
  }
  return [pscustomobject]@{ Process = $proc; Url = $url }
}

# Is the tunnel actually SERVING (not just a live process)? A quick tunnel often
# survives a sleep as a process while its connection is dead, so we check the
# public URL, not just $proc.HasExited.
function Test-Tunnel($url) {
  try {
    $r = Invoke-WebRequest -Uri "$url/healthcheck" -TimeoutSec 8 -UseBasicParsing
    return $r.Content.Trim() -eq "true"
  } catch { return $false }
}

# ── Supervise ────────────────────────────────────────────────────────────────
# Run once at logon and stay alive, self-healing: if the tunnel stops serving —
# a sleep/wake, a network blip, cloudflared dying — rebuild it and re-register.
# That's what makes the whole thing survive a closed lid without anyone touching
# it.
Wait-DocumentServer | Out-Null
$tunnel = Start-Tunnel
$fails = 0

while ($true) {
  Start-Sleep -Seconds 12

  if (-not $tunnel -or $tunnel.Process.HasExited -or -not (Test-Tunnel $tunnel.Url)) {
    $fails++
    Write-Log "tunnel not serving (strike $fails)"
    # Two strikes (~24s) to ride out a brief blip without rebuilding on a
    # transient, but quick enough that a wake-from-sleep recovers fast.
    if ($fails -ge 2) {
      Write-Log "rebuilding the tunnel"
      Wait-DocumentServer | Out-Null
      $tunnel = Start-Tunnel
      $fails = 0
    }
  } else {
    $fails = 0
  }
}
