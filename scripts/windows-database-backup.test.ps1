# Offline process/ACL tests. No database connections or real scheduled tasks.
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'windows-database-backup.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('darakit-backup-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$bin = Join-Path $testRoot 'bin'
New-Item -ItemType Directory -Path $bin | Out-Null
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$utf8 = New-Object Text.UTF8Encoding($false)
$passed = 0

function Assert-BackupTest([bool]$Condition, [string]$Label) {
    if (-not $Condition) { throw "FAIL: $Label" }
    $script:passed++
}

function New-Fixture([string]$Name, [string]$HostName) {
    $folder = Join-Path $testRoot $Name
    New-Item -ItemType Directory -Path $folder | Out-Null
    $config = @{
        host = $HostName; database = 'synthetic_db'; role = 'synthetic_role'
        sslmode = 'require'; channel_binding = 'require'; binDirectory = $bin
    }
    [IO.File]::WriteAllText((Join-Path $folder 'settings.json'), ($config | ConvertTo-Json), $utf8)
    [IO.File]::WriteAllText((Join-Path $folder 'pgpass.conf'), ($HostName + ':5432:synthetic_db:synthetic_role:synthetic'), $utf8)
    return $folder
}

function Invoke-Fixture([string]$Folder, [string]$Driver = $scriptPath) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $powershell
    $start.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File `"$Driver`" -PrivateDirectory `"$Folder`""
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PGPASSWORD'] = 'synthetic-inherited-must-not-reach-child'
    $start.EnvironmentVariables['PGOPTIONS'] = 'synthetic-inherited-must-not-reach-child'
    $process = [Diagnostics.Process]::Start($start)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(60000)) { $process.Kill(); throw 'Fixture process timeout.' }
    $result = @{ Code = $process.ExitCode; Output = $stdout.GetAwaiter().GetResult() + $stderr.GetAwaiter().GetResult() }
    $process.Dispose()
    return $result
}

try {
    $fakeSource = @'
using System;
using System.IO;
using System.Linq;
public class OfflineBackupTool {
    public static int Main(string[] args) {
        string host = Environment.GetEnvironmentVariable("PGHOST");
        if (Environment.GetEnvironmentVariable("PGPASSWORD") != null || Environment.GetEnvironmentVariable("PGOPTIONS") != null) return 91;
        if (Environment.GetEnvironmentVariable("PGSSLMODE") != "require" || Environment.GetEnvironmentVariable("PGCHANNELBINDING") != "require") return 92;
        if (Environment.GetEnvironmentVariable("PGUSER") != "synthetic_role" || Environment.GetEnvironmentVariable("PGDATABASE") != "synthetic_db") return 93;
        if (!File.Exists(Environment.GetEnvironmentVariable("PGPASSFILE"))) return 94;
        bool dump = Path.GetFileName(Environment.GetCommandLineArgs()[0]).Equals("pg_dump.exe", StringComparison.OrdinalIgnoreCase);
        if (dump) {
            if (!args.Contains("--no-password") || !args.Contains("--format=custom")) return 95;
            string file = args.Single(a => a.StartsWith("--file=")).Substring(7);
            File.WriteAllText(file, host == "ep-empty.neon.tech" ? "" : "SYNTHETIC ARCHIVE ONLY");
            if (host == "ep-dump-fail.neon.tech") { Console.Error.WriteLine("Synthetic dump failure"); return 21; }
        } else {
            if (args.Length != 2 || args[0] != "--list" || !File.Exists(args[1])) return 96;
            if (host == "ep-archive-fail.neon.tech") { Console.Error.WriteLine("Synthetic unreadable archive"); return 22; }
            Console.WriteLine("Synthetic archive contents, not a real PostgreSQL archive");
        }
        return 0;
    }
}
'@
    Add-Type -TypeDefinition $fakeSource -OutputAssembly (Join-Path $bin 'pg_dump.exe') -OutputType ConsoleApplication
    Copy-Item -LiteralPath (Join-Path $bin 'pg_dump.exe') -Destination (Join-Path $bin 'pg_restore.exe')

    $successFolder = New-Fixture 'success' 'ep-success.neon.tech'
    $first = Invoke-Fixture $successFolder
    Assert-BackupTest ($first.Code -eq 0) 'successful offline tool chain exits zero'
    $archives = @(Get-ChildItem -LiteralPath $successFolder -Filter '*.dump')
    Assert-BackupTest ($archives.Count -eq 1) 'one completed archive promoted'
    $firstHash = (Get-FileHash -LiteralPath $archives[0].FullName).Hash
    Assert-BackupTest (Test-Path -LiteralPath ($archives[0].FullName + '.sha256')) 'checksum retained'
    Assert-BackupTest ((Get-Content -LiteralPath (Join-Path $successFolder 'backup-status.log') -Raw) -match 'SUCCESS') 'success status recorded'
    $second = Invoke-Fixture $successFolder
    Assert-BackupTest ($second.Code -eq 0 -and @(Get-ChildItem -LiteralPath $successFolder -Filter '*.dump').Count -eq 2) 'second run keeps two distinct backups'
    Assert-BackupTest ((Get-FileHash -LiteralPath $archives[0].FullName).Hash -eq $firstHash) 'earlier archive unchanged'

    foreach ($failure in @('dump-fail', 'archive-fail', 'empty')) {
        $folder = New-Fixture $failure ('ep-' + $failure + '.neon.tech')
        $oldFile = Join-Path $folder 'old-completed.dump'
        [IO.File]::WriteAllText($oldFile, 'SYNTHETIC OLD COPY', $utf8)
        $result = Invoke-Fixture $folder
        Assert-BackupTest ($result.Code -ne 0) "$failure exits nonzero"
        Assert-BackupTest (@(Get-ChildItem -LiteralPath $folder -Filter '*.dump').Count -eq 1) "$failure does not promote a failed backup"
        Assert-BackupTest ([IO.File]::ReadAllText($oldFile) -eq 'SYNTHETIC OLD COPY') "$failure preserves prior backup"
        Assert-BackupTest ((Get-Content -LiteralPath (Join-Path $folder 'backup-status.log') -Raw) -match 'FAILURE') "$failure logged"
        Assert-BackupTest ($result.Output -notmatch 'ep-|synthetic_role|synthetic-inherited') "$failure console excludes connection and credential fields"
    }

    $poolFolder = New-Fixture 'pool-rejected' 'ep-fixture-pooler.neon.tech'
    $poolResult = Invoke-Fixture $poolFolder
    Assert-BackupTest ($poolResult.Code -ne 0 -and @(Get-ChildItem -LiteralPath $poolFolder -Filter '*.dump').Count -eq 0) 'pooled host rejected before tools run'

    $lock = [IO.File]::Open((Join-Path $successFolder 'backup.lock'), [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $locked = Invoke-Fixture $successFolder
        Assert-BackupTest ($locked.Code -ne 0 -and @(Get-ChildItem -LiteralPath $successFolder -Filter '*.dump').Count -eq 2) 'overlapping invocation rejected'
    } finally { $lock.Dispose() }

    # Only registration is stubbed; real Windows cmdlets construct action/trigger/settings.
    $driver = Join-Path $testRoot 'setup-driver.ps1'
    $driverText = @'
param([string]$PrivateDirectory)
Import-Module ScheduledTasks -ErrorAction Stop
function Get-ScheduledTask { param($TaskName, $ErrorAction) return $null }
function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if ($AsSecureString) { return (ConvertTo-SecureString 'synthetic:a\b' -AsPlainText -Force) }
    if ($Prompt -like 'Unpooled HOST*') { return 'ep-success.neon.tech' }
    if ($Prompt -eq 'Database name') { return 'synthetic_db' }
    if ($Prompt -like 'Database role*') { return 'synthetic_role' }
    throw 'Unexpected offline input prompt'
}
function Register-ScheduledTask {
    param($TaskName, $Action, $Trigger, $Principal, $Settings, $Description)
    if ($Principal.LogonType -ne 'Interactive' -or $Principal.RunLevel -ne 'Limited') { throw 'Unexpected principal' }
    if (-not $Settings.StartWhenAvailable -or $Settings.MultipleInstances -ne 'IgnoreNew') { throw 'Unexpected settings' }
    if ($Action.Arguments -notmatch '-NonInteractive' -or $Trigger.Repetition.Interval -ne 'P1D' -or $Trigger.Repetition.Duration) { throw 'Unexpected schedule' }
    [IO.File]::WriteAllText((Join-Path $PrivateDirectory 'synthetic-registration.txt'), 'STUB ONLY')
}
& '__SCRIPT_PATH__' -Setup -PrivateDirectory $PrivateDirectory -BinDirectory '__BIN_PATH__'
exit $LASTEXITCODE
'@
    $driverText = $driverText.Replace('__SCRIPT_PATH__', $scriptPath.Replace("'", "''"))
    $driverText = $driverText.Replace('__BIN_PATH__', $bin.Replace("'", "''"))
    [IO.File]::WriteAllText($driver, $driverText, $utf8)
    $setupFolder = New-Fixture 'setup' 'ep-success.neon.tech'
    $setupResult = Invoke-Fixture $setupFolder $driver
    if ($setupResult.Code -ne 0) {
        $fixtureStatus = Join-Path $setupFolder 'backup-status.log'
        if (Test-Path -LiteralPath $fixtureStatus) {
            $fixtureFailure = (Get-Content -LiteralPath $fixtureStatus | Select-Object -Last 1) -replace [regex]::Escape($testRoot), '<synthetic-test-folder>'
            throw ('Offline setup fixture failed: ' + $fixtureFailure)
        }
        throw 'Offline setup fixture failed before status creation.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $setupFolder 'synthetic-registration.txt'))) {
        throw ('Offline task registration marker missing; fixture console: ' + $setupResult.Output)
    }
    Assert-BackupTest ($setupResult.Code -eq 0) 'setup verifies export before constructing daily task (registration stubbed)'
    $acl = Get-Acl -LiteralPath $setupFolder
    Assert-BackupTest $acl.AreAccessRulesProtected 'private folder inheritance disabled'
    $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')
    $unexpected = @($acl.Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed })
    Assert-BackupTest ($unexpected.Count -eq 0) 'private folder grants only current user, SYSTEM and administrators'
    $passAcl = Get-Acl -LiteralPath (Join-Path $setupFolder 'pgpass.conf')
    $unexpectedPass = @($passAcl.Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed })
    Assert-BackupTest ($unexpectedPass.Count -eq 0) 'password file inherits protected access'

    $firstSetupFolder = Join-Path $testRoot 'first-setup'
    $initialSetupResult = Invoke-Fixture $firstSetupFolder $driver
    Assert-BackupTest ($initialSetupResult.Code -eq 0 -and (Test-Path -LiteralPath (Join-Path $firstSetupFolder 'synthetic-registration.txt'))) 'interactive first setup verifies export before stubbed registration'
    $writtenPass = [IO.File]::ReadAllText((Join-Path $firstSetupFolder 'pgpass.conf')).Trim()
    Assert-BackupTest ($writtenPass -eq 'ep-success.neon.tech:5432:synthetic_db:synthetic_role:synthetic\:a\\b') 'first setup escapes colon and backslash in password file'
    $savedSettings = Get-Content -LiteralPath (Join-Path $firstSetupFolder 'settings.json') -Raw | ConvertFrom-Json
    Assert-BackupTest ($savedSettings.PSObject.Properties.Name -notcontains 'password') 'settings JSON excludes password'

    $failedSetupFolder = New-Fixture 'failed-setup' 'ep-dump-fail.neon.tech'
    $failedSetupResult = Invoke-Fixture $failedSetupFolder $driver
    Assert-BackupTest ($failedSetupResult.Code -ne 0 -and -not (Test-Path -LiteralPath (Join-Path $failedSetupFolder 'synthetic-registration.txt'))) 'failed initial export prevents schedule registration'

    Write-Output "PASS: $passed offline process, archive lifecycle, failure, overlap, task-definition and ACL assertions. Fake PostgreSQL tools; registration stubbed; no database/network/real scheduler acceptance."
} finally {
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    $resolvedTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedTestRoot.StartsWith($resolvedTempRoot, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($resolvedTestRoot).StartsWith('darakit-backup-tests-')) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    } else { throw 'Refusing to remove an unexpected test path.' }
}
