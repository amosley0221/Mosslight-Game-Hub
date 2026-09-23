# Changelog

Every release's notes come from this file. Add a section for the new version
at the top before releasing — the release workflow refuses to run without one.

## [0.2.0] - 2026-09-22

### Added
- **Sync across all your devices.** Projects, tasks, GDD, concept art, cover images, builds, chat, handoffs, the asset library index and usage are all shared.
  - Every Windows PC, Mac and Android phone sees the same library, and changes appear on the others within about 5 seconds.
  - Sync goes through a private GitHub repo that only you can access. Turn it on in **Settings → Sync across devices**.
- **Phone pairing by QR code.** On a computer, go to Settings → Pair a phone. On the phone, go to ⚙ → Scan pairing QR code. You can also copy a pairing link to set up another computer.
- **Builds only launch on their own platform:**
  - Windows builds launch only on Windows.
  - Mac builds launch only on a Mac.
  - Android builds launch only on Android.
  - Web builds with a URL open anywhere.

  Builds that can't run on the current device are dimmed, and hovering or tapping explains where to play them.
- **Android builds reach the phone automatically.** When the desktop finds an APK for a project, it uploads the APK to your sync repo. Tapping ▶ on the phone installs the game, or launches it if it's already installed at that version.
- A device list in Settings shows every device sharing the library and when each was last seen. Each device can be renamed.
- The setup guide for sync and for the Grok, Claude and Codex agents is in [docs/SETUP.md](https://github.com/amosley0221/Mosslight-Game-Hub/blob/main/docs/SETUP.md).

### Changed
- Agent usage is counted per device and added up, so two devices don't overwrite each other's numbers.
- Local project folders and asset-library files belong to the device that added them. Folder watching, local agent CLIs and asset linking only use folders on the current device.
- Deleting a project, asset or chat message on one device now removes it everywhere. It no longer reappears on the next sync.

### Notes
- API keys stay on each device and are not synced. Add them on every device you chat from; see [docs/SETUP.md](https://github.com/amosley0221/Mosslight-Game-Hub/blob/main/docs/SETUP.md).

## [0.1.0] - 2026-09-22

First release of the Mosslight Game Hub for Windows, macOS and Android.

### Added
- **Project library**: game tiles with cover art, engine and platform chips, progress and quick-launch build buttons.
- **Multi-agent chat**: messages auto-route to Grok (ideas and concept art), Codex (visual design and builds) or Claude (code and systems). You can also pick an agent manually, reroute any reply, or approve or decline handoffs between agents.
- **Live agents**:
  - Claude runs through the Anthropic API or your local Claude Code CLI.
  - Codex runs through the OpenAI API or your local Codex CLI.
  - Grok runs through the xAI API, including image generation into the project's `concept/` folder.
  - API keys are stored in the system keychain.
- **Project tabs**: Overview, Tasks, Test builds, Concept art, GDD (with "Draft with…"), Stack, Dev (code log), Activity and Usage.
- **Open local folder** (desktop): detects Unreal, Unity, Godot and web projects, npm libraries, and shortcuts and builds. It keeps watching the folder and your Desktop for new builds.
- **Launch test builds**: `.lnk`/`.exe`/`.app` open natively, web builds open in the browser, and Android APKs install to a connected device over ADB.
- **Asset library** (desktop): upload once, skip duplicates, and link assets into any project's folder.
- **Integrations page**: detects installed engines and tools, and lets you add API keys for AI services.
- **Android companion app**: games list, game detail, task cycling and chat with handoff approval.
- Light and dark themes, and a splash screen.
- **Automatic updates**: the desktop apps update in place from GitHub Releases. The Android app offers new signed APKs that install over the existing app.
