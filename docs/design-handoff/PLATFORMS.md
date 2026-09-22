# Platform build notes

## Shared
1. `packages/core` (TypeScript): data model, router (`route(text)`), adapters' interfaces, sync client, seed data for first run. Port `hub-core.js` here; keep keyword lists in a JSON the user can edit from Settings later.
2. `packages/ui` (React + Vite): every screen in SCREENS.md, theme tokens as CSS variables, `data-theme` on root. Fluid layout: tiles `minmax(280px,1fr)`, chat rail collapsible.
3. Agent connectors:
   - Claude: Claude Code (local CLI `claude -p` with `--output-format json`, or remote session via the Claude Code SDK). Inject the system prompt template from `hub-core.js → respond()`.
   - Codex: Codex CLI / cloud tasks. Contract: Codex must call back `registerBuild({name,path,kind,platform})` after packaging.
   - Grok: xAI chat completions + image generation → save PNGs to `<project>/concept/`.
4. Storage: SQLite (better-sqlite3 in Electron / rusqlite in Tauri / Room on Android). Sync table with updated_at; last-write-wins is fine for a single user.
5. Secrets: OS keychain (Windows Credential Manager, macOS Keychain, Android Keystore).

## Windows
- Tauri 2 (or Electron) → MSIX + portable EXE. Sign with a code-signing cert to avoid SmartScreen.
- Launch builds: `ShellExecuteW` on `.lnk/.exe/.bat`; resolve .lnk targets with the Shell Link API for display.
- Watch `%USERPROFILE%\Desktop` and each project folder (ReadDirectoryChangesW / notify crate) for new shortcuts.
- Engines: Unreal `Engine\Build\BatchFiles\RunUAT.bat BuildCookRun -project=… -platform=Win64|Android`; Unity `Unity.exe -batchmode -quit -projectPath … -executeMethod BuildScript.Build`; Godot `godot.exe --headless --path … --export-release "Windows Desktop"|"Android"`.
- ADB: bundle platform-tools or detect `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. Support Wi-Fi debugging pairing (QR) so the phone can be off-cable.
- Register `mosslight://` URI scheme for deep links from agents/notifications.

## macOS
- Tauri 2 → .app in a notarized DMG (hardened runtime, notarytool). Universal binary (arm64 + x86_64).
- Launch builds: `open <path>` for .app/.command; `open -a Terminal <script>` for .sh when needed.
- FSEvents watcher on ~/Desktop and project folders. Request Desktop/Documents access up front (TCC prompt) and explain why.
- Engines: Unreal `RunUAT.sh`; Unity `/Applications/Unity/Hub/Editor/<ver>/Unity.app/Contents/MacOS/Unity -batchmode …`; Godot `Godot.app/Contents/MacOS/Godot --headless …`; Blender `/Applications/Blender.app/Contents/MacOS/Blender --background --python`.
- ADB via Android Studio SDK or Homebrew `android-platform-tools`.
- Menu bar: standard app menu, ⌘, for Settings, ⌘K to focus chat.

## Android companion
- Kotlin + Jetpack Compose, Material 3 with the Mosslight tokens as a custom ColorScheme (dark = tan primary/green tertiary; light = forest-green primary/tan tertiary). Dynamic color OFF.
- Min SDK 26, target latest. Permissions: `REQUEST_INSTALL_PACKAGES`, `INTERNET`, `CAMERA` (QR pairing), `POST_NOTIFICATIONS`.
- Pairing: scan QR shown by desktop Settings → exchanges sync endpoint + token. Store token in EncryptedSharedPreferences.
- Launching: download APK from the sync store (desktop uploads on `registerBuild`) → `PackageInstaller` session → on success `startActivity(getLaunchIntentForPackage(pkg))`. Web builds open in an in-app WebView (or Chrome Custom Tab if hosted).
- Screens: Games list, Game detail (Launch on this device, Stack, Up next, Concept art, Chat), Settings (theme, pairing). Handoff Approve/Decline works from the phone.
- Push notifications when Codex registers a new Android build ("Byteshift debug build ready — tap to install").
- Also viable: Capacitor wrapping `packages/ui` with a small native plugin for PackageInstaller. Choose native Compose if the team is comfortable with Kotlin.

## Definition of done (v1)
- Desktop imports a real Unreal/Unity/Godot/web folder, detects engine + shortcuts + libraries, shows them in Stack.
- Chat routes correctly on the seed examples; reroute and handoff approval work; Claude replies are live; code fences land in Dev.
- Clicking a build launches it (desktop), opens it (web), or installs+launches on a paired Android device.
- Light/Dark switch persists; agent Remote/Local toggles change the connector used.
- Integrations page detects installed tools and stores API keys in the keychain.
- Companion app shows the same library within 5s of a change on desktop.
