# INSTALLER.md — Windows Installer (Inno Setup)

Technical reference for the Library Manager V2 Windows installer.

---

## Table of Contents

1. [Overview](#overview)
2. [Build Prerequisites](#build-prerequisites)
3. [Building the Installer](#building-the-installer)
4. [Silent Install Reference](#silent-install-reference)
5. [Installation Layout](#installation-layout)
6. [Upgrade Behavior](#upgrade-behavior)
7. [Service Configuration](#service-configuration)
8. [Firewall Rule](#firewall-rule)
9. [Uninstall Behavior](#uninstall-behavior)
10. [Event Flow (Installer Lifecycle)](#event-flow-installer-lifecycle)
11. [Port Conflict Resolution](#port-conflict-resolution)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The installer produces a single `LibraryManager-Setup-{version}.exe` (~59 MB) that:

- Installs the pre-built standalone Next.js app to `%ProgramData%\LibraryManager`
- Registers a Windows service via the bundled `nssm.exe` (auto-start on boot)
- Opens the configured TCP port in Windows Firewall
- Generates a per-machine `.env.production` (random JWT secret, LAN IP, port)
- Creates Start Menu + desktop shortcuts that open the browser

**Target OS:** Windows 10/11 x64  
**Privileges:** Administrator required (service + firewall + ProgramData)

---

## Build Prerequisites

| Tool       | Version     | Purpose                                                         |
| ---------- | ----------- | --------------------------------------------------------------- |
| Node.js    | 20+         | `npm run release` (standalone build)                            |
| Inno Setup | 6.2+ or 7.x | Compiles the `.iss` script into `Setup.exe`                     |
| `ISCC.exe` | —           | CLI compiler; auto-detected at install paths or set `INNO_ISCC` |

### Where Inno Setup is searched

1. `INNO_ISCC` environment variable (if set)
2. `C:\Program Files (x86)\Inno Setup 7\ISCC.exe`
3. `C:\Program Files\Inno Setup 7\ISCC.exe`
4. `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`
5. `C:\Program Files\Inno Setup 6\ISCC.exe`

### Required file

- `installer/Arabic.isl` — Arabic translation for the installer UI (BOM-encoded UTF-8)

---

## Building the Installer

### Full release (recommended)

```bash
npm run release
```

This runs `scripts/build-release.mjs` which:

1. Validates TypeScript (`tsc --noEmit`) + lint (`eslint`)
2. Builds the Next.js standalone output (`next build`)
3. Copies `node.exe` + runtime DLLs into `release/app/`
4. Copies `scripts/standalone-launcher.js` as `release/app/start-server.js`
5. Strips `.nft.json`, `enriched/`, `data/`, `src/` to minimize size
6. Creates `release/LibraryManager-Setup-{version}.exe` (if ISCC is available)

### Manual installer compile (when release/app already exists)

```bash
"C:\Program Files (x86)\Inno Setup 7\ISCC.exe" /DMyAppVersion=0.1.0 installer\library-manager.iss
```

Output: `release/LibraryManager-Setup-0.1.0.exe`

### Verifying the build

```powershell
# File exists and has reasonable size
Get-Item release\LibraryManager-Setup-0.1.0.exe | Select Length,LastWriteTime

# Expected: ~59 MB, recent timestamp
```

### Build Data Separation (Known Issue)

**Problem:** `build-release.mjs` copies the developer's SQLite database and licenses into `release/app/data/`, then deletes enriched images. This conflates "building the application" with "packaging developer data."

**Current behavior:**
- Copies `data/media_library.db` + WAL + SHM into release (developer's test data)
- Copies `data/licenses/` into release (developer's licenses)
- Deletes `public/assets/images/enriched/` from standalone output

**Correct behavior (planned):**
- Application ships with: compiled code, fonts, placeholders, migrations, `node.exe`, `nssm.exe`
- Application does NOT ship with: SQLite database, enriched images, licenses
- First boot creates fresh database and runs migrations
- Enrichment downloads images from TMDB on customer's machine

**Impact:** Customers receive developer's test data but lose enriched image files that the database references.

---

## Silent Install Reference

All parameters are optional. When omitted, the installer uses the built-in defaults.

| Parameter              | Default                 | Description                            |
| ---------------------- | ----------------------- | -------------------------------------- |
| `/PORT=4000`           | `4000`                  | TCP port the server listens on         |
| `/IP=x.x.x.x`          | Auto-detected LAN IP    | Host IP for `NEXT_PUBLIC_APP_URL`      |
| `/SVCUSER=DOMAIN\user` | _(empty = LocalSystem)_ | Service logon account                  |
| `/SVCPASS=pass`        | _(empty)_               | Password for `SVCUSER`                 |
| `/VERYSILENT`          | —                       | No UI at all (required for automation) |
| `/SUPPRESSMSGBOXES`    | —                       | Suppress all dialog boxes              |
| `/NORESTART`           | —                       | Do not restart the computer            |

### Standard silent install

```powershell
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

### Custom port + IP

```powershell
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /PORT=4000 /IP=192.168.1.220
```

### Upgrade (same port)

```powershell
# Reads existing .env.production → pre-fills current port/IP
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

### Custom service account (for network share access)

```powershell
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART `
    /SVCUSER=MYPC\myuser /SVCPASS=mypassword
```

### Checking the service after install

```powershell
Get-Service LibraryManagerV2
# → Running, Automatic

# Verify port
netstat -ano | Select-String ":4000"

# Health check
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/api/health).Content
```

---

## Installation Layout

All files are installed to `%ProgramData%\LibraryManager`:

```
C:\ProgramData\LibraryManager\
├── .env.production          ← Generated by installer (JWT secret, port, IP)
├── start-server.js          ← Launcher: loads .env files, then runs server.js
├── server.js                ← Next.js standalone server
├── node.exe                 ← Bundled Node.js runtime
├── node_modules/            ← Production dependencies
├── .next/                   ← Next.js build output
├── public/                  ← Static assets
├── nssm.exe                 ← Service wrapper
├── data/
│   └── media_library.db     ← SQLite database (never overwritten on upgrade)
├── logs/
│   ├── service.log          ← stdout from the service
│   └── service-error.log    ← stderr from the service
└── src/backend/db/migrations/  ← SQL migration files
```

### What's NOT overwritten on upgrade

| Path              | Behavior                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `data/*`          | `onlyifdoesntexist` — never touches existing DB/WAL/license files |
| `.env.production` | Fully rewritten (new JWT secret each time)                        |
| Everything else   | Replaced with the new version                                     |

---

## Upgrade Behavior

The installer detects an upgrade when `{app}\.env.production` already exists on disk.

### What happens during an upgrade

1. **`PrepareToInstall`** — stops the running service, then removes it via `nssm remove confirm`. This happens **before** any files are copied, ensuring `nssm.exe` and `node.exe` are not locked.

2. **File copy** — new files are extracted. `data/*` is preserved via `onlyifdoesntexist`.

3. **`CurStepChanged`** (post-install):
   - Generates a fresh JWT secret
   - Rewrites `.env.production` with the port/IP from the wizard (pre-filled from the existing file)
   - Forces `InstallService` — re-registers the service with the correct configuration
   - Forces `AddFirewallRule` — updates the firewall rule to match the (potentially new) port

### Port continuity on upgrade

When upgrading without changing the port:

```powershell
# Existing .env.production has PORT=4000
# Installer pre-fills 4000 → service is re-created on 4000 → no disruption
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

When upgrading to a different port:

```powershell
# Existing .env.production has PORT=4000, but you want 5000
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /PORT=5000
# .env.production → PORT=5000, service listens on 5000
```

---

## Service Configuration

| Property          | Value                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Service name      | `LibraryManagerV2`                                                                     |
| Display name      | Library Manager V2                                                                     |
| Startup type      | Automatic                                                                              |
| Binary            | `%ProgramData%\LibraryManager\node.exe`                                                |
| Arguments         | `start-server.js`                                                                      |
| Working directory | `%ProgramData%\LibraryManager`                                                         |
| Restart delay     | 3000 ms                                                                                |
| Exit behavior     | Restart (nssm restarts on crash)                                                       |
| Logs              | `logs\service.log`, `logs\service-error.log` (CREATE_ALWAYS — truncated on each start) |
| Account           | LocalSystem (default) or custom via `/SVCUSER` + `/SVCPASS`                            |

### Service lifecycle commands

```powershell
# Status
sc query LibraryManagerV2
Get-Service LibraryManagerV2

# Stop / Start / Restart
nssm stop LibraryManagerV2
nssm start LibraryManagerV2

# Full removal
nssm stop LibraryManagerV2
nssm remove LibraryManagerV2 confirm

# View logs
Get-Content "C:\ProgramData\LibraryManager\logs\service.log" -Tail 50
Get-Content "C:\ProgramData\LibraryManager\logs\service-error.log" -Tail 50
```

---

## Firewall Rule

| Property   | Value                            |
| ---------- | -------------------------------- |
| Rule name  | `Library Manager V2`             |
| Direction  | Inbound                          |
| Protocol   | TCP                              |
| Action     | Allow                            |
| Profile    | Private only                     |
| Local port | Configured port (default `4000`) |

### Manual management

```powershell
# Check
netsh advfirewall firewall show rule name="Library Manager V2"

# Delete
netsh advfirewall firewall delete rule name="Library Manager V2"

# Re-add
netsh advfirewall firewall add rule name="Library Manager V2" `
    dir=in action=allow protocol=TCP localport=4000 profile=private
```

---

## Uninstall Behavior

The uninstaller (`Add/Remove Programs → Library Manager V2`):

1. Asks the user whether to keep `data\` (database, licenses, backups)
2. Stops and deletes the Windows service (`sc stop` + `sc delete`)
3. Removes the firewall rule
4. If user chose to keep data: moves `data\` to `LibraryManager-data-backup` before deleting `{app}`
5. Deletes the install directory
6. Removes the uninstall registry entry

---

## Event Flow (Installer Lifecycle)

```
┌─────────────────────────────────────────────────────────┐
│ Inno Setup Event Flow                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  InitializeWizard                                        │
│  ├─ Detect IsUpgrade (file exists?)                      │
│  ├─ Read existing PORT/IP from .env.production           │
│  ├─ Resolve: CLI param > existing > default              │
│  ├─ Create NetworkPage (pre-filled)                      │
│  └─ Create AccountPage                                   │
│                                                          │
│  NextButtonClick(NetworkPage)                            │
│  └─ Validate port range, IP non-empty                    │
│                                                          │
│  NextButtonClick(AccountPage)                            │
│  └─ Validate password if username provided               │
│                                                          │
│  PrepareToInstall                                        │
│  └─ [Upgrade only] nssm stop → nssm remove confirm       │
│     (stops service before file copy to avoid locks)      │
│                                                          │
│  ── File copy begins ──                                  │
│                                                          │
│  CurStepChanged(ssPostInstall)                           │
│  ├─ Generate random 48-char hex JWT secret               │
│  ├─ Write .env.production                                │
│  ├─ InstallService  (if task OR upgrade)                 │
│  │   ├─ nssm remove confirm (safety net)                 │
│  │   ├─ nssm install LibraryManagerV2 node.exe ...       │
│  │   ├─ nssm set AppDirectory, logs, restart, etc.       │
│  │   └─ nssm start LibraryManagerV2                      │
│  └─ AddFirewallRule  (if task OR upgrade)                │
│      ├─ netsh delete rule (cleanup old)                  │
│      └─ netsh add rule (new port)                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Port Conflict Resolution

### Priority order

1. **CLI parameter** (`/PORT=5000`) — highest priority; overrides everything
2. **Existing `.env.production` value** — read during upgrade via `ReadEnvValue('PORT', ...)`
3. **Built-in default** (`4000`) — used only on fresh installs without `/PORT`

### Common scenarios

| Scenario                            | Result                                     |
| ----------------------------------- | ------------------------------------------ |
| Fresh install, no `/PORT`           | Uses default `4000`                        |
| Fresh install, `/PORT=5000`         | Uses `5000`                                |
| Upgrade, no `/PORT`                 | Reads existing port from `.env.production` |
| Upgrade, `/PORT=5000`               | Uses `5000` (overrides existing)           |
| Upgrade after port change in wizard | Uses the value the user typed              |

### The port mismatch bug (fixed)

**Root cause:** On upgrades, Inno Setup skips the Tasks page. `WizardIsTaskSelected('service')` returned `False`, so `InstallService` was never called. Meanwhile, `WriteEnvFile` always ran — writing a new `.env.production` that might differ from the old service's port.

**Fix (three parts):**

1. `IsUpgrade` flag — `FileExists('{app}\.env.production')` in `InitializeWizard`
2. `PrepareToInstall` — stops and removes the running service **before** file copy (avoids file-in-use conflicts on `nssm.exe`)
3. `CurStepChanged` — forces `InstallService` + `AddFirewallRule` when `IsUpgrade` is true, regardless of the Tasks page state

---

## Troubleshooting

### Service not starting

```powershell
# Check logs
Get-Content "C:\ProgramData\LibraryManager\logs\service-error.log" -Tail 30

# Common causes:
# - PORT already in use by another process
# - .env.production has invalid values
# - node.exe cannot find start-server.js (wrong AppDirectory)
```

### Port mismatch after upgrade

```powershell
# Verify all three sources agree
Select-String -Path "C:\ProgramData\LibraryManager\.env.production" "^PORT="
netstat -ano | Select-String ":4000"
nssm get LibraryManagerV2 AppParameters
```

If they disagree:

```powershell
# Full convergence reset
nssm stop LibraryManagerV2
nssm remove LibraryManagerV2 confirm
nssm install LibraryManagerV2 "C:\ProgramData\LibraryManager\node.exe" "start-server.js"
nssm set LibraryManagerV2 AppDirectory "C:\ProgramData\LibraryManager"
nssm set LibraryManagerV2 Start SERVICE_AUTO_START
nssm set LibraryManagerV2 AppRestartDelay 3000
nssm set LibraryManagerV2 AppStdout "C:\ProgramData\LibraryManager\logs\service.log"
nssm set LibraryManagerV2 AppStderr "C:\ProgramData\LibraryManager\logs\service-error.log"
nssm start LibraryManagerV2
```

### Port 4199 still listening after upgrade

An orphan `node.exe` process may be lingering:

```powershell
# Find the PID
netstat -ano | Select-String ":4199"

# Kill it
taskkill /F /PID <PID>

# Verify port is free
netstat -ano | Select-String ":4199"
```

### Database locked by another process

```powershell
# Find who holds the .db file
handle.exe media_library.db    # Sysinternals Handle

# Stop service first, then retry
nssm stop LibraryManagerV2
```

### Reinstalling after a corrupted state

```powershell
# 1. Clean removal
nssm stop LibraryManagerV2
nssm remove LibraryManagerV2 confirm

# 2. Delete the install directory
Remove-Item -Recurse "C:\ProgramData\LibraryManager"

# 3. Remove firewall rule
netsh advfirewall firewall delete rule name="Library Manager V2"

# 4. Run installer
& .\LibraryManager-Setup-0.1.0.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

---

## Key Files

| File                                         | Purpose                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `installer/library-manager.iss`              | Main Inno Setup script (all wizard logic, service registration, firewall) |
| `installer/Arabic.isl`                       | Arabic translation for the installer UI                                   |
| `scripts/build-release.mjs`                  | Build pipeline (standalone + installer compilation)                       |
| `scripts/standalone-launcher.js`             | `.env` loader that bootstraps `server.js` at runtime                      |
| `release/LibraryManager-Setup-{version}.exe` | The compiled installer                                                    |
| `release/app/`                               | Standalone app directory (input to the installer)                         |
