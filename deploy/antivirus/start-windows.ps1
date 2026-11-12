[CmdletBinding()]
param(
    [string]$ClamAvDirectory = (Join-Path $env:LOCALAPPDATA 'FileJet/Antivirus/clamav'),
    [string]$RuntimeDirectory = (Join-Path $env:LOCALAPPDATA 'FileJet/Antivirus/runtime'),
    [ValidateRange(1, 65535)]
    [int]$Port = 3310
)
$ErrorActionPreference = 'Stop'
$clamExecutable = Join-Path $ClamAvDirectory 'clamd.exe'
$scanExecutable = Join-Path $ClamAvDirectory 'clamdscan.exe'
$freshExecutable = Join-Path $ClamAvDirectory 'freshclam.exe'
foreach ($executable in @($clamExecutable, $scanExecutable, $freshExecutable)) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw 'Install the official ClamAV Windows ZIP and pass its directory with -ClamAvDirectory. See deploy/antivirus/README.md.'
    }
}
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Check the existing antivirus service before starting another."
}
New-Item -ItemType Directory -Path $RuntimeDirectory -Force | Out-Null
$RuntimeDirectory = (Resolve-Path -LiteralPath $RuntimeDirectory).Path
$databaseDirectory = Join-Path $RuntimeDirectory 'database'
New-Item -ItemType Directory -Path $databaseDirectory -Force | Out-Null
$databaseSetting = $databaseDirectory.Replace('\', '/')
$clamConfigPath = Join-Path $RuntimeDirectory 'clamd.conf'
$freshConfigPath = Join-Path $RuntimeDirectory 'freshclam.conf'
# Windows PowerShell 5.1's Set-Content -Encoding utf8 adds a BOM that ClamAV rejects.
$utf8 = [System.Text.UTF8Encoding]::new($false)
$freshConfig = @"
DatabaseDirectory "$databaseSetting"
DatabaseMirror database.clamav.net
Checks 12
ConnectTimeout 20
ReceiveTimeout 120
LogTime yes
"@
[System.IO.File]::WriteAllText($freshConfigPath, $freshConfig + "`n", $utf8)
$clamConfig = @"
Foreground yes
DatabaseDirectory "$databaseSetting"
TCPSocket $Port
TCPAddr 127.0.0.1
MaxThreads 2
MaxQueue 16
StreamMaxLength 1024M
MaxFileSize 1024M
MaxScanSize 1536M
MaxRecursion 16
MaxFiles 10000
MaxScanTime 120000
ReadTimeout 180
AlertExceedsMax yes
AlertEncrypted yes
SelfCheck 600
LogTime yes
"@
[System.IO.File]::WriteAllText($clamConfigPath, $clamConfig + "`n", $utf8)
& $freshExecutable "--config-file=$freshConfigPath" --quiet
if ($LASTEXITCODE -ne 0) { throw 'ClamAV signature update failed. The antivirus service was not started.' }

$clamErrorLog = Join-Path $RuntimeDirectory 'clamd-error.log'
$clamProcess = Start-Process -FilePath $clamExecutable -ArgumentList "--config-file=`"$clamConfigPath`"" -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RuntimeDirectory 'clamd-output.log') -RedirectStandardError $clamErrorLog -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds(120)
try {
    while (-not (Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort $Port -OwningProcess $clamProcess.Id -ErrorAction SilentlyContinue)) {
        if ($clamProcess.HasExited) { throw "Clamd exited with code $($clamProcess.ExitCode). See $clamErrorLog" }
        if ([DateTime]::UtcNow -ge $deadline) { throw "Clamd did not listen on 127.0.0.1:${Port} within 120 seconds. See $clamErrorLog" }
        Start-Sleep -Seconds 1
    }
    $reply = & $scanExecutable "--config-file=$clamConfigPath" --ping=1
    if ($LASTEXITCODE -ne 0 -or $reply -cnotcontains 'PONG') {
        throw "Clamd did not respond to its readiness check. See $clamErrorLog"
    }
} catch {
    Stop-Process -InputObject $clamProcess -ErrorAction SilentlyContinue
    throw
}

Start-Process -FilePath $freshExecutable -ArgumentList "--config-file=`"$freshConfigPath`" --daemon --quiet" -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RuntimeDirectory 'freshclam-output.log') -RedirectStandardError (Join-Path $RuntimeDirectory 'freshclam-error.log')
Write-Output "ClamAV is ready on 127.0.0.1:$Port. Runtime and logs: $RuntimeDirectory"
