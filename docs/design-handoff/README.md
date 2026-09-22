# Handoff: Mosslight Game Hub

Multi-agent game development hub for **Mosslight Studios**. One chat routes work to three AI agents — **Grok** (ideas, story, concept art), **Codex** (visual design, graphics, test builds), **Claude** (code & systems) — across a library of game projects. Ships as a **Windows app**, a **macOS app**, and an **Android companion app** sharing one data store.

## About the design files
The `.dc.html` files in `design/` are **design references built in HTML** — working prototypes that show intended look, behavior, routing rules, and data model. They are NOT production code. Recreate them in the target stack below using its idioms. The prototype logic (`design/hub-core.js`) is the behavioral spec: routing keywords, task/build/code data shapes, seed data, simulated agent replies. Read it before building.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final. Match them.

## Recommended stack (no existing codebase)
- **Desktop (Windows + macOS):** Tauri 2 (Rust core, web UI) — small binaries, native process spawning, file-system access, OS shell integration. Electron is acceptable if the team prefers Node in the main process.
- **UI:** React + TypeScript + Vite. CSS variables for theming exactly as in the prototype (`--bg --panel --accent …`). No UI framework required; Radix primitives optional.
- **Android companion:** Kotlin + Jetpack Compose (native), OR the same React UI in Capacitor. Native is preferred for APK install/launch permissions.
- **Shared core:** a small TypeScript package `@mosslight/core` (data model, router, adapters' interfaces) used by desktop and Capacitor; mirrored as Kotlin data classes if Compose is chosen.
- **Sync:** local-first SQLite per device + a sync service (Supabase/PocketBase/self-hosted) so the phone sees the desktop's projects, builds and chat. Auth: single-user device pairing (QR code) is enough for v1.

## Apps & responsibilities
| Capability | Windows | macOS | Android |
|---|---|---|---|
| Project library, tiles, cover art | ✓ | ✓ | ✓ (read + set cover) |
| Chat + auto-routing + reroute + handoff approval | ✓ | ✓ | ✓ |
| Task board, GDD, Concept art, Activity, Usage | ✓ | ✓ | read-only + cycle task status |
| Stack (engines, platforms, languages, libraries) | ✓ | ✓ | read-only |
| Dev tab (code log) | ✓ | ✓ | read-only |
| Open local folder / detect engines, shortcuts, package.json | ✓ | ✓ | — |
| Launch desktop test builds (.lnk/.exe/.bat, .app/.command) | ✓ | ✓ | — |
| Launch web builds (index.html / dev server) | ✓ | ✓ | ✓ (WebView) |
| Install + launch Android APK on device | via ADB (USB/Wi-Fi) | via ADB | ✓ locally (PackageInstaller) |
| Integrations page (connect/disconnect tools) | ✓ | ✓ | read-only |
| Asset library (upload, tag, link to projects) | ✓ | ✓ | browse + link |
| Settings: theme, developer mode, agent Remote/Local, device pairing | ✓ | ✓ | theme + pairing |

## Screens
See `SCREENS.md` for per-screen layout, components and copy. Screenshots in `screenshots/`.

## Agents & routing (behavioral spec)
- **Auto-route always.** Score each message against keyword lists per agent (`KW` in hub-core.js). Highest score wins; show the routing reason as a mono label (`auto-routed · "shader"`). Ties or zero score → show an inline "Who should take it?" chooser with the three agents.
- **Manual override:** agent pills above the composer (Auto / Grok / Codex / Claude) force the target. The preview label shows the destination live as the user types.
- **Reroute:** any agent reply has "Reroute ▾" → send the same request to another agent; mark the original `· rerouted`.
- **Handoffs:** an agent may request another agent's help. Render a card (bordered in the target agent's color) with Approve / Decline. Approve dispatches `[Handoff from X] <reason>\n\nOriginal request: …` to the target with route label `handoff · approved by you`. Never auto-execute a handoff.
- **Side effects of replies** (project-scoped chat only): add tasks (TASK: lines), log code (fenced blocks → Dev tab, with language), add concept art entries (Grok), register builds (Codex), append Activity entries, increment Usage (calls + tokens ≈ chars/4; cost = tokens/1000 × rate).
- **Claude** = Claude Code (remote or local). System prompt template is in `hub-core.js` → `respond()`; it injects project name, pitch, engines, traits, open tasks and asks for optional trailing `HANDOFF: grok|codex — reason` and `TASK: title` lines. Parse and strip those lines.
- **Codex** = Codex cloud/remote or local CLI. Responsible for visual design AND packaging test builds; when it produces a build it must register it (name, absolute path, kind, platform) so the hub can launch it.
- **Grok** = xAI API (chat + image generation). Concept art results save to `<project>/concept/` and appear in the gallery.
- Remote vs Local per agent is a Settings toggle. Persist API keys in the OS keychain.

## Data model (per project)
```ts
type Project = {
  id: string; name: string; tagline: string;
  tags: Trait[];                     // '3D','2D','Web','Mobile','PC / Console','Pixel art','Realistic','Stylized','Multiplayer','Open world','Fast prototype','No-code'
  engines: EngineId[];               // any number; see ENGINES in hub-core.js
  platforms: ('windows'|'mac'|'android'|'web')[];
  stack: { languages: string[]; libraries: string[]; tools: string[] };
  folder: { path: string } | null;   // local project root
  coverArt?: string;                 // art id or image path
  tasks: { id; agent: AgentId; title; status: 'todo'|'doing'|'done'; ts }[];
  art:   { id; title; prompt; imagePath?; ts }[];
  gdd:   { id; title; body; agent: AgentId }[];
  builds:{ id; name; path; kind: 'desktop'|'web'|'android'; platform; by: AgentId; ts }[];
  code:  { id; agent: AgentId; title; file; lang; code; ts }[];
  activity: { id; agent: AgentId; text; ts }[];
};
type Settings = { theme: 'light'|'dark'; devMode: boolean; remote: Record<AgentId, boolean>; device: { name; paired }; tools: Record<ToolId, boolean> };
```
Chat messages are stored per scope: `global` and one thread per project id.

## Local folder import (desktop)
On "Open local folder": scan the top level.
- `*.uproject` → Unreal; `Assets/ + ProjectSettings/` → Unity; `project.godot` → Godot; `package.json` or `index.html` → web engine (read `dependencies` and map known libs: three, @babylonjs/core, phaser, @dimforge/rapier3d, howler, gsap, pixi.js, vite, typescript, @capacitor/core…).
- Builds: `*.lnk *.exe *.bat *.cmd *.url` → windows; `*.app *.command *.sh` → mac; `*.apk *.aab` → android; `index.html` → web.
- Platforms: android if `android/`, `build.gradle`, `gradlew`, `capacitor.config*` or an APK exists; web if a web build or web engine; else windows.
- If a project with the same folder name exists, merge; otherwise create one. Show a toast summarizing what was detected. Keep watching the folder (fs watcher) so new shortcuts Codex drops appear automatically. Also watch the user's **Desktop** for `<ProjectName>*.lnk` — Codex currently drops shortcuts there.

## Launching builds
- **Windows:** `ShellExecute` the .lnk/.exe. **macOS:** `open <path>`. **Web:** start the dev server if a package.json has `dev`, else open `index.html` in an embedded webview/tab. **Android from desktop:** `adb install -r <apk> && adb shell monkey -p <pkg> 1` (read package id with `aapt dump badging`). **Android on device:** copy APK to app storage and fire `PackageInstaller`; launch via `getLaunchIntentForPackage`.
- Every launch appends an Activity entry (`Launched test build <name>`) and shows a toast.

## Integrations (adapter interface)
```ts
interface ToolAdapter { id; name; category; depth: 'deep'|'api'|'launch';
  detect(): Promise<{ installed: boolean; version?: string; path?: string }>;
  open?(projectPath: string, file?: string): Promise<void>;
  run?(job: string, args: Record<string, unknown>): Promise<JobHandle>;   // build, export, generate…
  capabilities: string[]; }
```
Ship adapters for: Unreal (UnrealEditor-Cmd, RunUAT BuildCookRun), Unity (-batchmode -executeMethod), Godot (--headless --export-release), Web (npm scripts, Capacitor), Blender (--background --python), Meshy / Tripo / image-gen / ElevenLabs / Suno (REST, keys in keychain), Aseprite (-b --sheet), Substance / Krita / Audacity (launch + folder watch), ADB, Git/Perforce. The Integrations page lists each adapter with depth badge, capabilities, the command/API used, status, and a Connect/Disconnect (or Add key) button. The Stack tab shows the subset relevant to the open project.

## Asset library (shared across projects)
A global store of files the user uploads once — animations (.fbx/.bvh/.anim), models (.glb/.fbx/.blend), textures, images, audio, fonts, scripts, shaders. Stored under `~/Mosslight/Library/<kind>/` (configurable) and indexed in SQLite: `{ id, name, kind, size, tags[], path, hash, ts, usedBy: projectId[] }`. Kind is inferred from extension and filename (see `kindOf` in hub-core.js); user can override.
- Upload: drag-drop zone + file picker + folder import. Deduplicate by hash.
- Link to a project: toggles on each asset card (and from the project's Stack tab). Linking **copies or symlinks** the file into the project's conventional folder (`Content/`, `Assets/`, `assets/`, `res://` for Godot) and logs an Activity entry. Unlinking removes the link, never the library file.
- Agents can query the library: expose `listAssets({kind, tags, query})` and `linkAsset(assetId, projectId)` as tools to Claude/Codex/Grok so "use the idle animation from the library" works in chat.
- Previews: thumbnails for images/textures; GLB/FBX rendered via a small three.js viewer; waveform for audio.
- Companion app: browse and link only (no upload in v1).

## Theming — design tokens
Two themes via CSS variables on the app root (`data-theme`). Agent colors are fixed brand-independent identities.

**Dark (default)**
- bg: radial-gradient(1100px 600px at 20% -10%, #1a2119 0%, #0d0f0d 45%, #080908 100%) · window fallback #0d0f0d
- surface rgba(214,196,160,.03) · panel rgba(214,196,160,.05) · well rgba(214,196,160,.05)
- text #efe6d3 · text-2 #cdbf9f · muted #8f8672 · dim #5c5749
- line rgba(214,196,160,.10) · line-2 .13 · line-3 .28
- accent (tan/brass) #c9a961 · on-accent #12140f · accent-soft rgba(201,169,97,.14)
- green #3f6b3a (progress fills, active tab underline, "Deep" badge)
- agents: grok #ff5fa2 · codex #38d6c4 · claude #ff8a3d · on-agent #111116
- toast bg #e6dcc6 / text #12140f · scrim rgba(0,0,0,.65) · panel blur 24px · danger #ff6b6b

**Light**
- bg #f3eee2 (bone) · surface #f9f5ea · panel #fdfaf2 · well #e8dfca
- text #1f261c · text-2 #46503f · muted #76705f · dim #a39c88
- line rgba(47,66,42,.10) · line-2 .13 · line-3 .28
- accent (forest green) #2f5a2b · on-accent #f7f1e1 · accent-soft rgba(47,90,43,.10) · tan secondary #b8924a
- agents: grok #c9377f · codex #0e8f82 · claude #c95c14 · on-agent #ffffff
- panel shadow 0 1px 2px rgba(31,38,28,.05), 0 8px 24px rgba(31,38,28,.06) · toast bg #1f261c / text #f7f1e1 · danger #c44536

**Type:** system stack (`-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif`; Segoe UI on Windows). Mono: `'SF Mono', Menlo, Consolas`. Sizes: page title 30/600/-0.025em; card title 15–16/600; body 13; meta 11–12; mono labels 10–11; section eyebrow 12/600 uppercase +0.08em. Weight never above 700.

**Shape:** cards 14px radius (tiles 16, modals 18), inputs 10, chips 6, pills 999. Borders 1px `--line`. Card padding 16–18. Grid gaps 14–18. Header 56px.

**Motion:** `rise` (opacity 0→1, translateY 6px→0, .25–.3s ease) on new cards/messages; typing dots `blink` 1s; theme change transitions background/color .3s; splash fades out .6s after ~1.9s (click to skip).

## Brand assets (`assets/`)
- `mosslight-logo.png` — MS monogram with lantern, transparent. Splash screen only (also app icon source).
- `mosslight-icon.png` — 128px monogram, app icon / notifications.
- `mosslight-wordmark.png` — "Mosslight" script, transparent. Header (26px tall) and library masthead (52px tall).
- `mosslight-wordmark-full.png` — "Mosslight STUDIOS" lockup. Splash + About.
Request vector originals from the studio for production; these are cut from JPGs.

## Files
- `design/Mosslight Game Hub.dc.html` — desktop prototype (all screens)
- `design/Mosslight Companion.dc.html` — Android companion prototype
- `design/hub-core.js` — behavioral spec: data model, routing, seed data, agent prompt, folder scan, adapters list
- `design/image-slot.js`, `design/android-frame.jsx`, `design/support.js` — prototype runtime helpers (not to be ported)
- `screenshots/` — light + dark desktop states and the Android companion
- `PLATFORMS.md` — per-platform build & packaging instructions
