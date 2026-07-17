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
  [int]   $LocalPort     = 8080
)

if (-not $AppUrl)         { $AppUrl = "https://ngig.cloud" }
if (-not $RegisterSecret) { throw "OFFICE_REGISTER_SECRET is not set." }

$logDir = Join-Path $env:LOCALAPPDATA "ngig-office"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$tunnelLog = Join-Path $logDir "cloudflared.log"
$scriptLog = Join-Path $logDir "office-tunnel.log"

function Write-Log($message) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Add-Content -Path $scriptLog -Value $line
  Write-Output $line
}

# Wait for the Document Server to answer before publishing a tunnel to it —
# Docker may still be starting the container right after a reboot.
Write-Log "waiting for the document server on port $LocalPort"
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$LocalPort/healthcheck" -TimeoutSec 3 -UseBasicParsing
    if ($r.Content.Trim() -eq "true") { Write-Log "document server is up"; break }
  } catch { }
  Start-Sleep -Seconds 5
}

# Start the tunnel, sending its output to a file we can read the URL out of.
Remove-Item $tunnelLog -ErrorAction SilentlyContinue
Write-Log "starting cloudflared"
$proc = Start-Process -FilePath "cloudflared" `
  -ArgumentList @("tunnel", "--url", "http://localhost:$LocalPort", "--logfile", $tunnelLog) `
  -WindowStyle Hidden -PassThru

# cloudflared prints the assigned hostname a few seconds in.
$tunnelUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" |
             Select-Object -First 1
    if ($match) {
      $tunnelUrl = $match.Matches[0].Value
      break
    }
  }
}

if (-not $tunnelUrl) {
  Write-Log "ERROR: cloudflared never printed a URL; see $tunnelLog"
  if ($proc -and -not $proc.HasExited) { $proc.Kill() }
  exit 1
}
Write-Log "tunnel is at $tunnelUrl"

# Tell the app where the server lives now.
try {
  $body = @{ url = $tunnelUrl } | ConvertTo-Json -Compress
  $res = Invoke-RestMethod -Uri "$AppUrl/api/office/register" -Method Post `
    -Headers @{ Authorization = "Bearer $RegisterSecret" } `
    -ContentType "application/json" -Body $body -TimeoutSec 15
  Write-Log "registered with $AppUrl -> $($res.url)"
} catch {
  Write-Log "ERROR: could not register the URL: $_"
}

# Stay alive: the tunnel dies with this process, and the URL is only valid while
# cloudflared runs.
Write-Log "tunnel running (pid $($proc.Id)); waiting"
$proc.WaitForExit()
Write-Log "cloudflared exited"
