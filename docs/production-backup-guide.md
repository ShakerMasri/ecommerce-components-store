# Production database backup and recovery guide

Prepared: 2026-10-11. **Instructions only; no backup or restore completion is confirmed, and no production operation has been executed by the agent.** This guide assumes the production database is on Neon Free, consistent with the previous setup. Confirm the provider/project before using it. Staging remains paused.

Updated: 2026-10-12. Owner reports Neon and installed `pg_dump`/`pg_restore` are **18.6**. Backup completion is not yet confirmed. URI input/validation below has been checked locally using synthetic values only.

**Current requirement/choice:** automatic backups once every 24 hours on the owner's Windows computer, with no added service cost. Use the one-command script setup in **section 8**. Sections 2–6 remain a manual export/restore reference; section 7 records the alternatives. The production schedule is not installed or live-tested by the agent.

## 1. Find the production recovery history

1. Sign in to the [Neon Console](https://console.neon.tech).
2. Open the project used by the production Render service for `darakit.com`. Compare the endpoint in Render's production database settings privately; the project name alone is not proof. Keep credentials out of chat.
3. Open **Settings** in the project sidebar.
4. Select **Postgres**.
5. Find **History window** and read the current value. Record it without changing it yet.
6. Check that the organization/project is using the Free plan. Free currently defaults to six hours and allows at most six hours, capped at 1 GB of history. A zero window disables instant restore. The setting applies to the whole project, including all branches. [Neon history-window documentation](https://neon.com/docs/postgres/backup-restore/history-window).

The first result to share is only the configured duration. A history window is a provider recovery feature; it does not establish that a retained backup or restoration has been tested.

## 2. Prepare an owner-controlled backup machine

The following commands are for an owner-controlled administration machine outside this Codex environment. Production credentials and database archives must stay outside this environment and Git.

1. Use PostgreSQL client tools matching the database's major version. The Neon project shows its PostgreSQL version. On Windows, obtain the tools through the [official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/); the installer includes command-line tools.
2. Open PowerShell with the PostgreSQL `bin` directory on PATH, then check:

```powershell
pg_dump --version
pg_restore --version
```

3. In Neon, select the production project, branch, database and role. Open **Connect** and turn connection pooling off for this operation. Neon requires an [unpooled connection for dump/restore](https://neon.com/docs/import/migrate-from-postgres).
4. Prepare a password-free copy of that connection URI privately. Change the `ROLE:PASSWORD@HOST` portion to `ROLE@HOST`; retain the actual host, database and all Neon-provided TLS/channel-binding parameters. The commands below prompt for the password separately.
5. Set a private destination outside the repository, on the administration machine:

```powershell
$backupFolder = 'C:\DaraKit-private-backups'
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
$backupFile = Join-Path $backupFolder ('darakit-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
if (Test-Path -LiteralPath $backupFile) { throw 'Choose a new backup filename.' }
```

6. Run this line **on its own**, wait for the prompt, then paste the complete password-free URI **without surrounding quotation marks** and press Enter. Do not paste the URI as a PowerShell command or share it in chat.

```powershell
$productionConnection = (Read-Host 'Production unpooled URI with password removed').Trim()
```

7. Validate the input before exporting:

```powershell
$productionUri = $null
if (-not [uri]::TryCreate($productionConnection, [UriKind]::Absolute, [ref]$productionUri)) {
    throw 'Enter the complete URI without surrounding quotes at the Read-Host prompt.'
}
if ($productionUri.Scheme -notin @('postgresql', 'postgres') -or
    [string]::IsNullOrWhiteSpace($productionUri.Host) -or
    [string]::IsNullOrWhiteSpace($productionUri.UserInfo) -or
    $productionUri.AbsolutePath -in @('', '/')) {
    throw 'The URI must contain the PostgreSQL scheme, role, host and database.'
}
if ($productionUri.UserInfo.Contains(':')) { throw 'Remove the password and its preceding colon from the URI.' }
Write-Host 'Connection format checked; no database connection made.'
```

The earlier null-valued-expression error can occur with empty input or a quoted URI parsed as relative. This guard first requires an absolute URI using [Microsoft's `Uri.TryCreate`](https://learn.microsoft.com/en-us/dotnet/api/system.uri.trycreate). Format validation does not establish the endpoint's identity or connectivity; privately confirm the production target and unpooled host. Keep all original TLS/channel-binding parameters unchanged.

Use owner-controlled private storage and its access/encryption protections. An untracked archive in the application workspace or Render's ephemeral filesystem is not retained backup storage.

## 3. Export a retained database backup

Run on the administration machine:

If the tools are not on PATH, invoke their executable paths; for this owner's installation use `& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"` in place of `pg_dump`, and the corresponding `pg_restore.exe` path in place of `pg_restore` below.

```powershell
pg_dump --dbname $productionConnection --password --format=custom --file $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop and review the error privately.' }
```

Enter the production database password at the prompt. This exports schema and data without changing the source database. The export represents a consistent point-in-time view; later writes are not included. Avoid running it during schema changes. [PostgreSQL pg_dump documentation](https://www.postgresql.org/docs/current/app-pgdump.html).

Check the archive and record its digest:

```powershell
pg_restore --list $backupFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Archive could not be read; stop.' }
Get-FileHash -LiteralPath $backupFile -Algorithm SHA256
```

Retain the archive, timestamp and digest privately. Successful listing/digest checks do not replace a real restore test. Store an additional protected copy on owner-controlled durable storage, outside the administration machine if possible. No new paid service is required by this guide.

## 4. Identify a separate empty recovery target

1. Choose a separate owner-controlled recovery project using the same PostgreSQL major version, within the available Free limits. Confirm its exact project/branch/database and approve that target before creating or restoring anything. Keep it isolated from staging and storefront traffic.
2. In that recovery project's selected branch, open **Postgres database → Databases → Add database**.
3. Create a new empty database, for example `darakit_recovery_20261011`, with a recovery role you control. If that name already exists or has data, choose a new target; this guide does not clear existing databases. [Neon database creation](https://neon.com/docs/manage/databases).
4. Select this recovery database in Neon's SQL Editor and run:

```sql
SELECT current_database();

SELECT count(*) AS application_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

Confirm the database name is the chosen recovery name and the application-table count is zero. Check the project/branch/endpoint too: names can repeat across projects. This target must differ from the production endpoint/database.
5. Open **Connect** for the recovery database with pooling off. Prepare its password-free URI, preserving its own TLS settings, as in step 2.

## 5. Restore only into the confirmed recovery database

On the administration machine:

Run this input line on its own and paste the recovery URI without surrounding quotes at the prompt:

```powershell
$recoveryConnection = (Read-Host 'Confirmed empty recovery database URI with password removed').Trim()
```

Then validate and restore only after confirming the separate empty target:

```powershell
$recoveryUri = $null
if (-not [uri]::TryCreate($recoveryConnection, [UriKind]::Absolute, [ref]$recoveryUri)) {
    throw 'Enter the complete URI without surrounding quotes at the Read-Host prompt.'
}
if ($recoveryUri.Scheme -notin @('postgresql', 'postgres') -or
    [string]::IsNullOrWhiteSpace($recoveryUri.Host) -or
    [string]::IsNullOrWhiteSpace($recoveryUri.UserInfo) -or
    $recoveryUri.AbsolutePath -in @('', '/')) {
    throw 'The URI must contain the PostgreSQL scheme, role, host and database.'
}
if ($recoveryUri.UserInfo.Contains(':')) { throw 'Remove the password and its preceding colon from the URI.' }
if ($recoveryConnection -eq $productionConnection) { throw 'Recovery target must differ from production.' }
pg_restore --dbname $recoveryConnection --password --no-owner --no-privileges --single-transaction --exit-on-error $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; stop and review the error privately.' }
```

Enter the recovery role's password. The connection-string equality check is an additional guard, not a replacement for project/branch/database inspection. These options restore under the recovery role, omit source ownership/grants, and roll back on error. [PostgreSQL pg_restore documentation](https://www.postgresql.org/docs/current/app-pgrestore.html).

This is a rehearsal in a separate database. Leave production's Render environment and database destination unchanged.

## 6. Verify the recovered data

In the recovery database's SQL Editor:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM public."_prisma_migrations"
ORDER BY started_at;
```

Compare migration names and completion status to the source's recorded history. This repository currently contains 15 committed migrations; a count alone cannot establish that the right migrations were restored.

Verify known catalog and inventory records, user/order/item relationships, historical product/option labels and prices, and cart references against the backup's recorded state. Perform these checks privately; no customer records or authentication tables should be pasted into chat. If the source is empty, record that boundary: an empty-database restore does not verify order recovery. If production changed after the export, the live source is newer; retain those later records rather than overwriting production to force a match.

Record sanitized evidence: source/target identity confirmed, backup time/digest, export/restore exit status, migration comparison and data/reference checks. This closes only the evidenced database-recovery slice. Compatible application rollback, cancellation/restocking and preservation of orders created after a release still require their own acceptance.

## 7. Establish ongoing retention before launch

The owner requests **one automatic backup every 24 hours**. Each successful run must create a distinct retained recovery point, rather than overwrite the only copy. The manual password-prompting commands above run once per invocation and cannot run unattended as written.

Choose an execution/storage approach:

| Option | Added service cost | Works while the owner's computer is off? | Setup and limits |
|---|---|---|---|
| Neon scheduled snapshots | Paid Neon plan; usage-based charges | Yes | Simplest managed option: daily snapshots and retention inside Neon. Free does not include scheduled snapshots. These are provider snapshots, not portable dump archives. |
| Render cron job + protected durable storage | Minimum $1/month for the cron job, plus applicable usage/storage charges | Yes | Run a PostgreSQL 18 export daily, validate it and upload to privately chosen storage. Cron jobs cannot use a persistent disk; files left on Render are not retained backups. |
| Windows Task Scheduler + protected backup storage | No added scheduler service fee | No | Run a noninteractive export under the configured Windows account. Computer and network must be available; configure missed-run handling. A local file alone does not survive loss of that computer. |

Sources checked 2026-10-12: [Neon pricing](https://neon.com/pricing), [Neon paid-plan scheduling API](https://api-docs.neon.tech/reference/setsnapshotschedule), [Render cron jobs](https://render.com/docs/cronjobs) and [Windows missed-run handling](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable). The exact source/target, provider/budget choice and storage remain owner decisions. No upgrade, service provisioning, credential installation or scheduler activation is authorized by this comparison.

Owner chose the Windows option on 2026-10-12. The script below retains all completed copies; automatic deletion/30-day retention and an off-device copy have not been configured.

Recommended configuration for review after choosing the approach:

1. **Frequency:** once per day. For a Render job, `0 0 * * *` means midnight UTC every day; all Render cron schedules use UTC. Choose a fixed UTC time if an exact 24-hour interval is required.
2. **Retention:** propose 30 daily recovery points, subject to storage cost and the owner's desired recovery period. Do not automatically delete existing backups before a specific retention policy is approved.
3. **Authentication:** unattended jobs must not use `Read-Host` or password prompts. Configure private noninteractive credentials on the chosen operator/provider only, outside this workspace/chat/Git. Preserve unpooled connections and the provider's TLS parameters for dump-based jobs.
4. **Success:** confirm the actual snapshot or export finished; for archives, check readability and durable upload completion. Retain sanitized timestamps/status/checksums and keep older successful copies when a new run fails.
5. **Monitoring:** arrange failure/missed-backup notification and check the newest successful recovery point's age. Notification channel and any external messages need explicit configuration; none is installed here.
6. **Restore acceptance:** rehearse restoring a retained recovery point into a separately approved target. The archive steps above apply to `pg_dump`/`pg_restore`; Neon snapshots need their provider restore workflow into a separate recovery branch. A scheduled run alone is not restoration evidence.

If every daily run succeeds, a daily backup alone can omit nearly 24 hours of later orders; a missed run extends that gap. Keep the actual Neon recovery history configured as an additional recovery mechanism and choose frequency/retention based on acceptable order-data loss and detection time. A six-hour history window does not replace retained daily backups. No schedule or storage service has been installed by this guide.

Database backups contain Cloudinary image references, not the image files or provider configuration. Retain separate private provider/settings recovery records. For a live incident, freeze affected writers and preserve/reconcile all later orders and cancellations before any production cutover; never restore an old archive directly over newer orders.

## 8. Run the Windows backup script

Prepared [script](../scripts/windows-database-backup.ps1) and [offline tests](../scripts/windows-database-backup.test.ps1). Run the operator commands below yourself in a private PowerShell window; do not enter production credentials in Codex or paste them into chat. No website code, dependency or paid service is needed.

### First run: setup, backup and daily task

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "D:\ecommerce-components-store\scripts\windows-database-backup.ps1" -Setup
```

The process-scoped `RemoteSigned` policy does not change your computer/user policy or override managed Group Policy. [Microsoft execution-policy documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-5.1).

Enter four private values at the prompts, without surrounding quotes:

1. **Unpooled host:** from Neon production **Connect**, with pooling off; only the hostname between `@` and `/`, not the whole URI. A `-pooler` hostname is rejected.
2. **Database:** the database name after `/` and before `?` in the connection URI.
3. **Role:** the username before `@` in the password-free URI; commonly `neondb_owner`, but use your actual role.
4. **Password:** the database password from Neon; enter it at the hidden password prompt. It is never printed or passed in command-line arguments.

This script is scoped to the connection already discussed: PostgreSQL 18 tools at `C:\Program Files\PostgreSQL\18\bin`, port `5432`, `sslmode=require` and `channel_binding=require`. Stop and privately compare settings if your provider URI has other required parameters. A custom installed tool folder can be supplied with `-BinDirectory`. Privately confirm that host/database/role are the intended production source before running.

The script creates `%LOCALAPPDATA%\DaraKitBackups` outside Git and restricts its NTFS access to the current Windows account, SYSTEM and local administrators. Its `pgpass.conf` contains the database password in plaintext under those permissions; use the computer's disk encryption and keep the folder private. The supported PostgreSQL password-file format and colon/backslash escaping allow unattended authentication. [PostgreSQL password-file documentation](https://www.postgresql.org/docs/18/libpq-pgpass.html).

Setup exports a first custom-format backup, checks that it is nonempty and readable with `pg_restore --list`, and writes a SHA-256 sidecar and private status log. **Only after this succeeds** does it copy the script into the private folder and install **DaraKit Daily Database Backup**. It repeats every **24 hours**, first scheduled run 24 hours after setup. It does not overwrite a task with that name. A setup failure is not a successful installation; review the private logs locally. If no task exists, correct the private settings/tool path and rerun `-Setup`.

### Later runs and monitoring

For an extra manual backup, omit `-Setup`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "D:\ecommerce-components-store\scripts\windows-database-backup.ps1"
```

The installed task runs the private copy of the script and does not depend on the repository staying open or at the same revision. Files ending in `.dump` are completed readable archives; `.partial` files are incomplete attempts. Each name contains a UTC timestamp and a unique suffix. Completed copies are never overwritten or automatically deleted. A file lock and Task Scheduler's `IgnoreNew` setting prevent overlapping jobs. Failed tools have nonzero exit status, retain previous successful copies, and save diagnostics privately.

Check the task without sharing credentials:

```powershell
Get-ScheduledTaskInfo -TaskName 'DaraKit Daily Database Backup' |
    Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult` should be `0` after a completed run. Inspect the newest `.dump` timestamp and `backup-status.log` privately, and verify the first scheduled run as well as the initial manual run. Detailed private diagnostics may contain provider or data details; share only sanitized status/error categories in chat. No external failure alert or off-device copy is installed. Watch failed/missed runs and available disk space; retaining all copies means storage use grows.

The task runs under the current Windows account with an **Interactive** logon type: **the computer must be on, connected and that account logged in**. Locking the screen is fine; signing out is not. Missed-run catch-up and wake requests are enabled, but cannot guarantee backups while powered off/offline. A different security context for running while signed out requires separately configuring Windows task credentials; this setup does not store your Windows login password. [Microsoft task principal](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal?view=windowsserver2025-ps) and [missed-run documentation](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable).

Retain an additional protected copy on an owner-controlled separate device/storage when available. Test restoration into the separate empty target in sections 4–6. Local scheduled backups alone do not protect against loss of this computer, and archive listing is not a tested restore.

### Verification boundary

**Interrupted setup retry fix — 2026-10-12:** an interrupted prompt can leave an already-protected folder. The original full-descriptor ACL update failed with `SeSecurityPrivilege` on a synthetic retry before prompts resumed. The script now reads/writes only access rules through .NET's [section-specific access-control API](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getaccesscontrol?view=netframework-4.8.1); ownership/auditing are not changed and the same private user/SYSTEM/administrator grants remain. Run the normal `-Setup` command again using the updated repository script; do not delete private files or backups. A task already installed still requires inspection rather than replacement. The updated suite passes **33 offline assertions**, including simulated prompt interruption and retry. Owner's private failure log and production data were not inspected; live retry remains owner-operated.

The script passed **31 offline assertions** using synthetic credentials/tools: first setup, password escaping, archive promotion/checksum, distinct repeated copies, failures preserving earlier backups, pooled-host rejection, overlap rejection, actual Windows task-definition construction and NTFS permissions. PostgreSQL tools and task registration were stubbed: no live database, production export/restore or recurring-run acceptance is claimed. An initial test-harness module-loading issue created a temporary synthetic task; its exact test action was checked, that task was removed, and the corrected tests load the Windows module before stubbing registration.
