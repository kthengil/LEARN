# Readiness check for the Ansible course lab (Windows). It installs nothing. The only file it writes is
# .env (read by Docker Compose) from LAB_PORT in config.env.
# Usage (PowerShell, in the lab folder):  powershell -ExecutionPolicy Bypass -File .\check.ps1
# Exit code 0: ready (warnings may remain). Exit code 1: at least one check failed.

$DefaultLabPort = 28201
$MinRamGb = 2
$RecRamGb = 4
$MinDiskGb = 5
$LabProject = 'ansible-lab'

Set-Location -Path $PSScriptRoot
$script:Fails = 0
$script:Warns = 0
function Ok([string]$Text) { Write-Host '  OK    ' -ForegroundColor Green -NoNewline; Write-Host $Text }
function Warn([string]$Text, [string]$Hint = '') {
  Write-Host '  WARN  ' -ForegroundColor Yellow -NoNewline; Write-Host $Text
  if ($Hint) { Write-Host "        $Hint" }
  $script:Warns++
}
function Fail([string]$Text, [string]$Hint = '') {
  Write-Host '  FAIL  ' -ForegroundColor Red -NoNewline; Write-Host $Text
  if ($Hint) { Write-Host "        $Hint" }
  $script:Fails++
}
function Docker-Info([string]$Format) {
  $out = & docker info --format $Format 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($out | Out-String).Trim()
}

Write-Host 'Ansible lab: readiness check' -ForegroundColor White
Write-Host ''

# 1. Lab contents
if ((Test-Path 'docker-compose.yml') -and (Test-Path 'lab.yaml') -and (Test-Path 'shared/workstation/Containerfile')) {
  Ok 'Lab files present'
} else {
  Fail 'Lab files missing' 'Run this script from the unzipped ansible-lab folder, and unzip the whole archive.'
}

# 2. Settings: read LAB_PORT from config.env, validate it, and write .env for Compose
function Get-Setting([string]$Key, [string]$Default) {
  $value = $null
  if (Test-Path 'config.env') {
    foreach ($line in (Get-Content -Path 'config.env' -Encoding UTF8)) {
      $l = $line.Trim().TrimStart([char]0xFEFF)
      if ($l -eq '' -or $l.StartsWith('#') -or -not $l.Contains('=')) { continue }
      $k, $v = $l.Split('=', 2)
      if ($k.Trim() -eq $Key) { $value = ($v -replace '\s+#.*$', '').Trim().Trim('"', "'") }
    }
  }
  if ($value) { return $value } else { return $Default }
}
function Test-ValidPort([string]$Value) { return ($Value -match '^\d+$') -and ([int]$Value -ge 1024) -and ([int]$Value -le 65535) }
if (-not (Test-Path 'config.env')) { Warn 'config.env not found' "Using the default lab port $DefaultLabPort." }
$LabPortText = Get-Setting 'LAB_PORT' "$DefaultLabPort"
$SettingsOk = $true
if (-not (Test-ValidPort $LabPortText)) {
  Fail "config.env: LAB_PORT=$LabPortText is not a valid port" 'Use a number from 1024 to 65535.'
  $SettingsOk = $false
}
if ($SettingsOk) {
  $LabPort = [int]$LabPortText
  $header = '# Written from config.env by check.sh / check.ps1. Edit config.env instead, then run the check again.'
  $utf8 = New-Object System.Text.UTF8Encoding $false
  try {
    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), "$header`n# Local image names (localhost/lab/...): the images are built on this machine, never pulled.`nLAB_REGISTRY=localhost`nLAB_PORT=$LabPort`n", $utf8)
    Ok "Settings applied from config.env: lab port $LabPort"
  } catch { Fail 'Could not write .env' 'Check that the lab folder is writable.' }
}

# 3. Docker CLI and engine
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail 'Docker is not installed' 'Install Docker Desktop with the WSL 2 backend: https://docs.docker.com/desktop/setup/install/windows-install/'
  Write-Host ''; Write-Host 'Not ready: install Docker, then run this check again.' -ForegroundColor Red; exit 1
}
Ok ("Docker CLI: " + ((& docker --version) | Out-String).Trim())
$serverVersion = Docker-Info '{{.ServerVersion}}'
if (-not $serverVersion) {
  Fail 'Docker engine is not reachable' 'Start Docker Desktop and wait until it reports that the engine is running.'
  Write-Host ''; Write-Host 'Not ready: start Docker Desktop, then run this check again.' -ForegroundColor Red; exit 1
}
Ok "Docker engine: $serverVersion"

# 4. Compose v2 (2.17 or newer) and Buildx
$cv = ((& docker compose version --short 2>$null) | Out-String).Trim().TrimStart('v')
if (-not $cv) {
  Fail 'Docker Compose v2 is missing' 'Docker Desktop includes it; update Docker Desktop.'
} else {
  $parts = $cv.Split('.')
  $major = [int]$parts[0]; $minor = [int]($parts[1] -replace '\D.*$', '')
  if ($major -gt 2 -or ($major -eq 2 -and $minor -ge 17)) { Ok "Docker Compose $cv" }
  else { Fail "Docker Compose $cv is too old" 'Version 2.17 or newer is needed: update Docker Desktop.' }
}
$bx = & docker buildx version 2>$null
if ($LASTEXITCODE -eq 0) { Ok ("Docker Buildx: " + (($bx | Out-String).Trim() -split '\s+')[1]) }
else { Fail 'Docker Buildx is missing' 'Docker Desktop includes it; update Docker Desktop.' }

# 5. Engine platform, cgroups, CPU and memory
$os = Docker-Info '{{.OSType}}'
$arch = Docker-Info '{{.Architecture}}'
if ($os -ne 'linux') {
  Fail "The engine runs $os containers" 'Switch Docker Desktop to Linux containers (tray icon menu).'
} elseif (@('x86_64', 'amd64', 'aarch64', 'arm64') -contains $arch) {
  Ok "Engine platform: linux/$arch"
} else {
  Warn "Engine platform linux/$arch is not tested" 'The lab is tested on amd64 and arm64.'
}
$cg = Docker-Info '{{.CgroupVersion}}'
if ($cg -eq '2') { Ok 'cgroup v2' }
else { Warn "cgroup version '$cg'" 'The lab machines run systemd and are tested on cgroup v2 (the WSL 2 backend provides it).' }
$cpus = [int](Docker-Info '{{.NCPU}}')
if ($cpus -ge 2) { Ok "CPUs available to Docker: $cpus" }
else { Warn "CPUs available to Docker: $cpus" '2 or more make the first build and the lab faster.' }
$memGb = [math]::Round([double](Docker-Info '{{.MemTotal}}') / 1GB, 1)
if ($memGb -ge ($RecRamGb - 0.3)) { Ok "Memory available to Docker: $memGb GB" }
elseif ($memGb -ge ($MinRamGb - 0.3)) { Warn "Memory available to Docker: $memGb GB" "$RecRamGb GB or more is recommended (WSL 2: memory= in %UserProfile%\.wslconfig)." }
else { Fail "Memory available to Docker: $memGb GB" "At least $MinRamGb GB is needed (WSL 2: memory= in %UserProfile%\.wslconfig)." }

# 6. Disk space
$drive = if ($env:SystemDrive) { Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')) -ErrorAction SilentlyContinue } else { $null }
if ($drive) {
  $freeGb = [math]::Floor($drive.Free / 1GB)
  if ($freeGb -ge $MinDiskGb) { Ok "Free disk on $($env:SystemDrive): $freeGb GB" }
  else { Warn "Free disk on $($env:SystemDrive): $freeGb GB" "About $MinDiskGb GB is needed for the images." }
} else {
  Warn 'Free disk: not checked' "Make sure about $MinDiskGb GB is free for Docker images."
}

# 7. Port availability
function Test-PortInUse([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    return ($task.Wait(1000) -and $client.Connected)
  } catch { return $false } finally { $client.Dispose() }
}
function Check-Port([int]$Port, [string]$What, [string]$Hint) {
  $owner = ((& docker ps --filter "publish=$Port" --format '{{.Names}}' 2>$null) | Select-Object -First 1)
  if ($owner) {
    if ($owner.StartsWith("$LabProject-")) { Ok "Port $Port ($What): already used by this lab ($owner)" }
    else { Fail "Port $Port ($What) is used by container $owner" $Hint }
  } elseif (Test-PortInUse $Port) { Fail "Port $Port ($What) is already in use" $Hint }
  else { Ok "Port $Port ($What) is free" }
}
if ($SettingsOk) {
  Check-Port $LabPort 'lab' 'Stop what uses it, or set another LAB_PORT in config.env and run the check again.'
}

# 8. Registries the first build pulls from
foreach ($reg in @('registry-1.docker.io', 'quay.io')) {
  $code = 0
  try {
    $resp = Invoke-WebRequest -Uri "https://$reg/v2/" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $code = [int]$resp.StatusCode
  } catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  }
  if ($code -eq 200 -or $code -eq 401) { Ok "Registry reachable: $reg" }
  else { Warn "Registry not reachable: $reg" 'The first start pulls base images from it. Behind a proxy, set the proxy in Docker Desktop: Settings > Resources > Proxies.' }
}

Write-Host ''
if ($script:Fails -gt 0) {
  Write-Host "Not ready: $($script:Fails) check(s) failed, $($script:Warns) warning(s). Fix the failures and run the check again." -ForegroundColor Red
  exit 1
}
Write-Host "Ready ($($script:Warns) warning(s)). Next:" -ForegroundColor Green
Write-Host '  docker compose up -d                 start (or restart) the Ansible lab'
$labNote = if ($LabPort -ne $DefaultLabPort) { " (the lessons show the default port, $DefaultLabPort)" } else { '' }
Write-Host "  open http://localhost:$LabPort$labNote"
exit 0
