# FolderPickerAgent

Minimal native folder picker / opener tool for the Library Management admin dashboard and viewer.
- `GET /pick-folder` — opens a `FolderBrowserDialog` on the machine and returns the selected path via HTTP.
- `GET /open-folder?path=<urlencoded>` — opens an existing folder (local or UNC share) on the machine in Explorer.

## Compatibility

| | Version |
|--|---------|
| Windows | 7 SP1, 8, 8.1, 10, 11 |
| Architecture | x86 (32-bit) and x64 |
| Runtime | AutoHotkey v2 (compile to standalone exe) |

## Build

Requires [AutoHotkey v2](https://www.autohotkey.com/) (install) + [Ahk2Exe](https://www.autohotkey.com/docs/v2/Scripts.htm#ahk2exe).

```powershell
# Via Ahk2Exe GUI: open folder-picker-agent.ahk → Convert to .exe
# Or command line:
& "C:\Program Files\AutoHotkey\v2\Ahk2Exe.exe" /in folder-picker-agent.ahk /out folder-picker-agent.exe
```

Output: `folder-picker-agent.exe` (~1.5 MB, single file, no runtime)

> After changing `folder-picker-agent.ahk`, recompile and re-run `install-agent.bat`
> on every client machine so the updated `.exe` is copied and restarted.

## Usage

### Pick a folder (admin dashboard — unchanged)

1. Run `folder-picker-agent.exe` on the admin's machine
2. The admin Dashboard Library Form sends `GET http://localhost:5199/pick-folder`
3. Native `FolderBrowserDialog` opens on the admin's machine
4. Returns:
   - `200 { "path": "\\server\share\..." }` on selection
   - `204` (no body) on cancel

### Open a folder (viewer "فتح المجلد")

1. Run `folder-picker-agent.exe` on the client machine (same device as the browser)
2. The viewer sends `GET http://localhost:5199/open-folder?path=%5C%5Cserver%5Cshare%5Cfolder`
   - `path` must be fully percent-encoded UTF-8 (`encodeURIComponent(path)` in JS)
3. The agent opens the folder on the client machine in Explorer
4. Returns:
   - `200 { "ok": true }` on success
   - `400 { "error": "Missing path parameter" }` when `path` is empty
   - `404 { "error": "Path not found" }` when the path does not exist / is unreachable
   - `500 { "error": "Failed to open path" }` when Explorer could not open it

## How it works

```
[Admin Browser] -- GET /pick-folder --> [folder-picker-agent.exe] --> FileSelectFolder --> { "path": "..." }
[Client Browser] -- GET /open-folder?path=... --> [folder-picker-agent.exe] --> Run explorer --> { "ok": true }
```

Built on WinSock (`ws2_32.dll`), raw TCP server with manual HTTP parsing.
No .NET, no ASP.NET, no PowerShell. Zero runtime dependencies.
