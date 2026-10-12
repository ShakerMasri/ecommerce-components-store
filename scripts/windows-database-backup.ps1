# Run -Setup once in your own PowerShell window, outside Codex.
# Production credentials and archives are stored outside the repository.
[CmdletBinding()]
param(
    [switch]$Setup,
    [string]$PrivateDirectory = (Join-Path $env:LOCALAPPDATA 'DaraKitBackups'),
    [string]$BinDirectory = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$taskName = 'DaraKit Daily Database Backup'
$privateRoot = [IO.Path]::GetFullPath($PrivateDirectory).TrimEnd('\')
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if ((Test-Path -LiteralPath (Join-Path $repositoryRoot '.git')) -and
    ($privateRoot -eq $repositoryRoot -or $privateRoot.StartsWith($repositoryRoot + '\', [StringComparison]::OrdinalIgnoreCase))) {
    throw 'Choose a private directory outside the application repository.'
}
if ($privateRoot -eq [IO.Path]::GetPathRoot($privateRoot).TrimEnd('\') -or $privateRoot.StartsWith('\\')) {
    throw 'Use a dedicated private folder on a local Windows drive.'
}

$configPath = Join-Path $privateRoot 'settings.json'
$passPath = Join-Path $privateRoot 'pgpass.conf'
$statusPath = Join-Path $privateRoot 'backup-status.log'
$utf8 = New-Object Text.UTF8Encoding($false)

function Set-PrivateFolderPermissions {
    New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null
    if ((Get-Item -LiteralPath $privateRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'The private folder must not be a link or junction.'
    }
    # Read/write only access rules. Reapplying a full security descriptor can
    # require SeSecurityPrivilege on a retry even though the user owns the folder.
    $acl = [IO.Directory]::GetAccessControl($privateRoot, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($existingRule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($existingRule) }
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    foreach ($sid in @($owner.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $identity = New-Object Security.Principal.SecurityIdentifier($sid)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $identity, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    [IO.Directory]::SetAccessControl($privateRoot, $acl)
}

function Write-BackupStatus([string]$Message) {
    [IO.File]::AppendAllText($statusPath, ([DateTime]::UtcNow.ToString('o') + ' ' + $Message + [Environment]::NewLine), $utf8)
}

function Escape-PasswordField([string]$Value) {
    return $Value.Replace('\', '\\').Replace(':', '\:')
}

function Read-BackupSettings {
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $passPath -PathType Leaf)) {
        throw 'Private settings are missing. Run this script with -Setup first.'
    }
    $settings = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($settings.host -notmatch '^ep-[a-zA-Z0-9.-]+\.neon\.tech$' -or $settings.host -match '-pooler\.') {
        throw 'Use the exact Neon unpooled hostname, without a URI or quotes.'
    }
    foreach ($name in @('database', 'role')) {
        if ([string]::IsNullOrWhiteSpace($settings.$name) -or $settings.$name -match '[\r\n*]') {
            throw 'Database and role must be nonempty exact values without wildcards or newlines.'
        }
    }
    if ($settings.sslmode -notin @('require', 'verify-ca', 'verify-full') -or $settings.channel_binding -ne 'require') {
        throw 'Keep TLS enabled and channel_binding=require for this Neon setup.'
    }
    if ($settings.PSObject.Properties.Name -contains 'password') {
        throw 'Do not put a password in settings.json.'
    }
    foreach ($tool in @('pg_dump.exe', 'pg_restore.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $settings.binDirectory $tool) -PathType Leaf)) {
            throw 'PostgreSQL command-line tools were not found in the configured folder.'
        }
    }
    return $settings
}

function Invoke-BackupTool([string]$Tool, [string]$Arguments, $Settings, [string]$ErrorFile) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $Settings.binDirectory $Tool
    $start.Arguments = $Arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    # Ignore inherited libpq overrides, including PGPASSWORD and PGSERVICE.
    foreach ($key in @($start.EnvironmentVariables.Keys)) {
        if ($key -like 'PG*') { $start.EnvironmentVariables.Remove($key) }
    }
    $start.EnvironmentVariables['PGHOST'] = $Settings.host
    $start.EnvironmentVariables['PGPORT'] = '5432'
    $start.EnvironmentVariables['PGDATABASE'] = $Settings.database
    $start.EnvironmentVariables['PGUSER'] = $Settings.role
    $start.EnvironmentVariables['PGSSLMODE'] = $Settings.sslmode
    $start.EnvironmentVariables['PGCHANNELBINDING'] = $Settings.channel_binding
    $start.EnvironmentVariables['PGPASSFILE'] = $passPath
    $start.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '30'
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    $started = $false
    try {
        if (-not $process.Start()) { throw 'Could not start PostgreSQL tool.' }
        $started = $true
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(3600000)) {
            $process.Kill()
            $process.WaitForExit()
            throw 'PostgreSQL tool exceeded the one-hour limit.'
        }
        $outputText = $stdout.GetAwaiter().GetResult()
        $errorText = $stderr.GetAwaiter().GetResult()
        if ($errorText.Length -gt 0) { [IO.File]::WriteAllText($ErrorFile, $errorText, $utf8) }
        if ($process.ExitCode -ne 0) { throw "$Tool failed with exit code $($process.ExitCode). Review its private error log locally." }
    } finally {
        if ($started -and -not $process.HasExited) {
            $process.Kill()
            $process.WaitForExit()
        }
        $process.Dispose()
    }
}

function New-DatabaseBackup {
    $lock = $null
    try {
        $lock = [IO.File]::Open((Join-Path $privateRoot 'backup.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch {
        throw 'Another backup is running, or the private folder is inaccessible.'
    }
    try {
        $settings = Read-BackupSettings
        $archiveName = 'darakit-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N')
        $partial = Join-Path $privateRoot ($archiveName + '.partial')
        $archive = Join-Path $privateRoot ($archiveName + '.dump')
        Invoke-BackupTool 'pg_dump.exe' "--no-password --format=custom --file=`"$partial`"" $settings (Join-Path $privateRoot ($archiveName + '-dump-error.log'))
        if (-not (Test-Path -LiteralPath $partial -PathType Leaf) -or (Get-Item -LiteralPath $partial).Length -eq 0) {
            throw 'Export did not create a nonempty archive.'
        }
        Invoke-BackupTool 'pg_restore.exe' "--list `"$partial`"" $settings (Join-Path $privateRoot ($archiveName + '-archive-error.log'))
        $digest = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
        # Never overwrite a previous completed backup or promote a failed export.
        [IO.File]::Move($partial, $archive)
        [IO.File]::WriteAllText(($archive + '.sha256'), ($digest + '  ' + [IO.Path]::GetFileName($archive)), $utf8)
        Write-BackupStatus ('SUCCESS archive=' + [IO.Path]::GetFileName($archive) + ' sha256=' + $digest)
        Write-Host 'Backup created and readable. Completed backups have the .dump extension.'
    } catch {
        Write-BackupStatus ('FAILURE - ' + $_.Exception.Message)
        throw
    } finally {
        $lock.Dispose()
    }
}

try {
    if ($Setup) {
        if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
            throw 'This named task already exists. Inspect it in Task Scheduler; it will not be overwritten.'
        }
        Set-PrivateFolderPermissions
        if (-not (Test-Path -LiteralPath $configPath)) {
            Write-Host 'Keep these entries private. Use the production Connect panel with pooling OFF.'
            Write-Host 'This setup uses port 5432, sslmode=require and channel_binding=require; stop if your Neon connection specifies different parameters.'
            $settings = [ordered]@{
                host = (Read-Host 'Unpooled HOST only (ep-...neon.tech), no quotes').Trim()
                database = (Read-Host 'Database name').Trim()
                role = (Read-Host 'Database role (for example neondb_owner)').Trim()
                sslmode = 'require'
                channel_binding = 'require'
                binDirectory = $BinDirectory
            }
            foreach ($value in @($settings.host, $settings.database, $settings.role)) {
                if ([string]::IsNullOrWhiteSpace($value) -or $value -match '[\r\n*]') { throw 'Use nonempty exact values without wildcards or newlines.' }
            }
            $securePassword = Read-Host 'Neon database password (hidden)' -AsSecureString
            $credential = New-Object Management.Automation.PSCredential($settings.role, $securePassword)
            $password = $credential.GetNetworkCredential().Password
            if ([string]::IsNullOrEmpty($password) -or $password -match '[\r\n]') { throw 'Password must be nonempty and on one line.' }
            $fields = @($settings.host, '5432', $settings.database, $settings.role, $password) | ForEach-Object { Escape-PasswordField $_ }
            [IO.File]::WriteAllText($passPath, (($fields -join ':') + [Environment]::NewLine), $utf8)
            $password = $null
            $credential = $null
            $securePassword.Dispose()
            [IO.File]::WriteAllText($configPath, ($settings | ConvertTo-Json), $utf8)
        }
        New-DatabaseBackup
        $installedScript = Join-Path $privateRoot 'windows-database-backup.ps1'
        if ([IO.Path]::GetFullPath($PSCommandPath) -ne $installedScript) {
            Copy-Item -LiteralPath $PSCommandPath -Destination $installedScript
        }
        $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File `"$installedScript`" -PrivateDirectory `"$privateRoot`""
        $trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddHours(24)) -RepetitionInterval (New-TimeSpan -Hours 24)
        $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
        $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $taskSettings -Description 'Daily owner-operated DaraKit backup. Requires this Windows account to be logged in and online.' | Out-Null
        Write-Host 'Task installed: repeat every 24 hours, starting 24 hours from setup. Keep this account logged in and the computer online.'
    } else {
        if (-not (Test-Path -LiteralPath $privateRoot -PathType Container)) { throw 'Run with -Setup first.' }
        New-DatabaseBackup
    }
} catch {
    # Never include connection details/passwords in the console or scheduler result.
    if (Test-Path -LiteralPath $privateRoot -PathType Container) {
        Write-BackupStatus ('SETUP/RUN FAILURE - ' + $_.Exception.Message)
    }
    Write-Host 'Backup/setup failed. Keep earlier backups; check private logs and setup inputs locally. No successful schedule installation is confirmed by this message.'
    exit 1
}
