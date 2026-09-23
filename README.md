# Mosslight Game Hub

A multi-agent game development hub for **Mosslight Studios**. One chat sends work to three AI agents, across a library of game projects:
- **Grok**: ideas, story and concept art
- **Codex**: visual design and test builds
- **Claude**: code and systems

It ships as a **Windows app**, a **macOS app** and an **Android companion app**.

**Download:** [latest release](https://github.com/amosley0221/Mosslight-Game-Hub/releases/latest)

| Platform | File | Updates |
|---|---|---|
| Windows | `Mosslight_x.y.z_x64-setup.exe` | Automatic in-app update, installs over the existing app |
| macOS (Apple Silicon + Intel) | `Mosslight_x.y.z_universal.dmg` | Automatic in-app update, installs over the existing app |
| Android | `Mosslight_x.y.z_android.apk` | The app offers each new APK, which installs over the existing app |

All devices share one library through a private GitHub repo (Settings → Sync across devices). Each build only launches on its own platform: Windows builds on Windows, Mac builds on a Mac, Android builds on Android.

## First run

**Full setup guide (sync + agents): [docs/SETUP.md](docs/SETUP.md).**

1. Open **Settings (⚙)** and add API keys for the agents you want live. An agent without a key or local CLI replies with a short "not set up yet" note and changes nothing.
   - **Claude**: an Anthropic key, or switch Claude to **Local** to use your installed Claude Code CLI (`claude`) inside the project folder.
   - **Codex**: an OpenAI key, or switch Codex to **Local** to use the Codex CLI (`codex`). Local mode can actually build your game.
   - **Grok**: an xAI key. This also turns on concept-art image generation.

   Keys are stored in the Windows Credential Manager or the macOS Keychain.
2. Click **Open local folder** to import an Unreal, Unity, Godot or web project. The hub detects the engine, libraries and builds, and watches the folder and your Desktop for new shortcuts.
3. Chat. Messages auto-route to the right agent. You can reroute any reply and approve or decline handoffs between agents.

### Installing unsigned builds

These builds aren't code-signed with a paid certificate yet, so the first install needs one extra click:

- **Windows**: SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.
- **macOS**: open the DMG and drag Mosslight to Applications. The first time, **right-click → Open**. If macOS says the app is "damaged", run `xattr -dr com.apple.quarantine /Applications/Mosslight.app` once.
- **Android**: allow "Install unknown apps" for your browser when prompted.

After that, updates install in place.

## Releasing a new version

1. Add a section to the top of [CHANGELOG.md](CHANGELOG.md):
   ```md
   ## [0.2.0] - 2026-10-01
   ### Added
   - …
   ### Fixed
   - …
   ```
2. Commit and push it.
3. Go to **Actions → Release → Run workflow** and enter `0.2.0`.

The workflow:
- bumps the version and tags `v0.2.0`
- builds Windows, macOS (universal) and Android
- signs everything with the same keys as before, so it installs over the existing app
- publishes a GitHub Release with that CHANGELOG section as the notes

Installed apps then pick up the update.

You can also bump `package.json` yourself and push a `v0.2.0` tag.

### Signing keys

The release workflow reads these repository secrets:

| Secret | Used for |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing desktop update bundles, which the in-app updater verifies |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` | Signing the APK |

**Keep an offline backup of these keys.** If they're lost, installed apps can't update without an uninstall.

## Development

```bash
npm install
npm run tauri dev          # desktop app (needs Rust + Tauri prerequisites)
npm run dev                # UI only, in a browser
npm run build && npm run android:sync && npx cap open android   # Android Studio
```

The layout:

- `src/core`: data model, router, agent connectors, state store
- `src/ui`: desktop screens
- `src/mobile`: Android companion
- `src/platform`: the Tauri, Capacitor and web bridge
- `src-tauri`: the Rust shell. It handles folder scanning, launching, the keychain, ADB, local agent CLIs and the updater.

The design handoff is in [`docs/design-handoff`](docs/design-handoff).

## Not yet built

- Push notifications for new Android builds.
- Engine batch jobs (RunUAT, Unity `-batchmode`, Godot export) run from buttons. Today, Codex in Local mode runs them.
- 3D previews for GLB/FBX files in the asset library.
