# Changelog

Every release's notes come from this file. Add a section for the new version
at the top before releasing — the release workflow refuses to run without one.

## [0.4.0] - 2026-09-23

### Added
- **Auto mode for Claude and Codex (the new default on desktop).** Mosslight uses your local Claude Code or Codex CLI when it's installed on the computer, and falls back to the API if the tool is missing or a run fails.
  - Each agent has an **Auto / Local / API** selector in ⚙ Settings → Agents, with a "Using: …" line showing what it will actually use.
  - Existing installs that were on Remote switch to Auto.
- Every reply is labelled **local** or **api**, so you can see which route answered. If a local run fails and the API answers instead, the reply says why.
- **Model picker for every agent.** **Load models** lists the models your API key can use, straight from Anthropic, OpenAI or xAI, so new models appear without an app update. **Custom…** accepts any exact model id.
  - Grok's image model has its own picker.
  - The local tools can use "CLI default" (your plan's model) or a model you choose.
- The Integrations page now shows whether **Claude Code (CLI)** and **Codex CLI** are installed on this computer.

### Fixed
- **Android: sync showed "Failed to fetch" after pairing.** The phone's repeated sync checks used a GitHub shortcut that Android's HTTP layer can't handle. The phone now does plain checks, with a cache-buster so it never reads a stale copy.
- If the phone genuinely can't reach GitHub, the status now says so and retries automatically.

## [0.3.0] - 2026-09-22

### Changed
- **The app now starts with an empty library.** The built-in demo content has been removed:
  - the Hollowmere, Byteshift and Orbital Drift projects and their tasks, art, code and builds
  - the sample asset-library files
  - the pre-filled usage numbers
  - the scripted welcome message

  Updating removes that demo content from existing installs once. The removal syncs, so it doesn't come back from another device. Projects you created yourself are kept.
- **No more fake agent replies.** An agent without an API key (or local CLI) no longer invents answers, tasks, art or code. Instead it says it isn't set up yet and what to add in Settings. These replies don't count toward usage.

### Added
- A welcome screen for an empty library on desktop and Android, with shortcuts to create a project, open a local folder, or open Settings to set up sync and agents.
- An empty chat explains how messages are routed to Grok, Codex and Claude.
- **Android**:
  - **New project** (the **+** button) so you can start a project from your phone.
  - **Remove project** at the bottom of each game page, with a confirmation.
- The desktop **Remove project** confirmation now makes clear that the project is removed on all synced devices and that files on disk aren't touched.

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
