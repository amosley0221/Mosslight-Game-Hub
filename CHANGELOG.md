# Changelog

Every release's notes come from this file. Add a section for the new version
at the top before releasing — the release workflow refuses to run without one.

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
