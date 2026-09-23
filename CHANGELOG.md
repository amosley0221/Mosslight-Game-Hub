# Changelog

Every release's notes come from this file. Add a section for the new version
at the top before releasing — the release workflow refuses to run without one.

## [0.16.1] - 2026-09-23

### Fixed
- **The Android tab strip was squashed to a few unclickable pixels** once a tab had a long list under it (Builds with a dozen shortcuts). The strip now keeps its height, sticks to the top while you scroll, spans the full width, and has no stray scrollbar.

## [0.16.0] - 2026-09-23

### Changed
- **Android projects have tabs, like the desktop.** Overview, Tasks, Builds, Story, Art, Music, Chat and GitHub are a row of pills under the title instead of one endless scroll, so the chat isn't six screens below the cover. The tab you're on is shared with the desktop through sync.
  - **Overview** keeps the story, stack, what's up next and removing the project; **Tasks** lists every task and tapping one cycles its status.
- **Landscape uses the space.** Turned sideways (or on a tablet), the cover fills the left side whole — no cropping — with the title, progress and tabs scrolling on the right. Portrait keeps the banner-and-scroll layout.

## [0.15.0] - 2026-09-23

### Added
- **Pictures show up in the chat.** A reply that produced images now shows them under it as thumbnails, with **Add to Art**, **Open Art →** and a **cover** button on each one. Click a thumbnail to open it full size.
  - **Concept art Grok generates** appears in the reply that asked for it, instead of only turning up in the Art tab.
  - **Screenshots and renders a local run produced** are found too: files Claude Code or Codex wrote directly, plus anything new in the project's capture folders (`Saved/Screenshots`, `Screenshots`, `Captures`, `concept`, `Docs/Reviews`, `Tools/RuntimeReviews`, `export`, …) since the run started. So "run the capture tool and show me the fuel station" ends with the picture in the chat.
  - **Add to Art** pins them as project art, so they show even when the Art tab's folder filter would hide them.

## [0.14.1] - 2026-09-23

### Fixed
- **Handoffs written in markdown were silently lost.** An agent ending with `**HANDOFF:** claude — …` instead of a bare `HANDOFF:` fell through as plain text: no card, no Approve & run, and the teammate never saw it. Decorated `HANDOFF`, `TASK`, `ART` and `BUILD` lines are now read the same as plain ones, with the emphasis trimmed off the value. Covered by tests.

## [0.14.0] - 2026-09-23

### Added
- **Task cards on disk, so tasks are traceable.** Every task in a project with a local folder is mirrored to a Markdown card in `Docs/Tasks/` — `id`, `owner`, `status`, `created`, and a dated **## History** of every status change and who made it. The card is the record; the hub is a view of it.
  - **Agents read and write them.** The card's path travels with every request, and agents are told to check the card before claiming anything about a task, and to set its `status:` and add a history line when they finish one — so "what's the status of card X?" has an answer any of them can verify.
  - **It works both ways.** Cards you or an agent add to `Docs/Tasks/` by hand appear as tasks the next time you open the project, and a status changed in a card wins over the hub's copy. Ticking a task in the hub writes the change back to its card.
  - **Git keeps the trail.** Because cards are files in the repo, "who moved this to done, and when" is answered by `git log`, not by trusting a claim in chat.
  - Bodies are preserved: whatever you or the agents write under **## Objective** or **## Notes** stays, and only the front matter and history are maintained by the hub. **Tasks → Sync cards** reconciles on demand.

## [0.13.1] - 2026-09-23

### Fixed
- **Codex couldn't reach GitHub.** Its sandbox blocks the network by default, so `git fetch`, `git ls-remote` and `git push` failed and it could only verify local refs — reporting "remote Git verification failed" through no fault of your token. Codex now runs with network access, and **⚙ Settings → Agents → Let Codex reach the network** turns it back off if you want it fully offline.

## [0.13.0] - 2026-09-23

### Added
- **Agents can see what their teammates are working on.** Every request now carries a short list of the other agents' live and queued work on that project, with the instruction not to repeat it. Codex stops handing Claude a job Claude is already running, and says it's in progress instead.
- **The team lead sees the actual prompts.** When planning, the lead gets up to 700 characters of each in-flight request, so it can recognise the job it was about to assign — and either leave that step out or make its step depend on the running one.
- **Resume.** A run cut short by Mosslight closing now shows **Resume** next to it, which re-sends the original request to the same agent. No retyping, no digging through Reroute.
- **A warning before you stop live work.** Closing the window or hitting **Update now** while an agent is working asks first, and says plainly what survives: files already written to disk are kept, the unfinished reply is lost.

## [0.12.2] - 2026-09-23

### Fixed
- **A model name that isn't a model id no longer fails as a mystery 404.** A saved API model like "Claude" (a label, not `claude-opus-5`) is now replaced by that agent's default on launch, and if a provider does reject a model, the reply says which model and where to change it instead of showing `404 not_found_error`.

## [0.12.1] - 2026-09-23

### Fixed
- **The project instructions card could list the same file twice** (`Docs/PROJECT-HANDOFF.md + Docs/PROJECT-HANDOFF.md`), because Windows treats `Docs/` and `docs/` as the same path — which also sent the file to the agents twice and wasted their context budget.

## [0.12.0] - 2026-09-23

### Added
- **Your project's own instructions now reach every agent.** If the project folder has `AGENTS.md`, `CLAUDE.md` or `Docs/PROJECT-HANDOFF.md`, Mosslight reads it and sends it with every request — including to Grok, to agents running from your phone, and to API fallbacks that can't see your disk. A **Project instructions** card on Overview shows which files were found, lets you read them, and re-reads on demand. Keep the standing rules in one file in the repo; the hub keeps itself honest from there.
- **The team lead reads the project before it plans.** Running locally, the lead is now told to check `AGENTS.md`, the docs folder and recent git history first, to say when work is already underway instead of planning it again, and never to open with "write a pitch" for a project that clearly has work behind it.

### Changed
- **Chat history is kept in full and synced in full.** The per-thread sync cap went from 300 messages to 5,000, so a long project history reaches every device instead of being cut off. A library large enough to make one document unwieldy trims only that upload, never what's stored on your devices.
- **The phone keeps the whole history too.** It used to show the last 6 messages with no way back; now it renders the recent ones with **Show earlier messages**, and the desktop rail does the same past 120, so a thousand-message thread stays quick to open.

### Fixed
- **The library could stop saving without telling you.** It lived in browser local storage, which caps out around 5 MB and then throws — and that error was being swallowed, so new work would vanish on the next restart. The library now lives in IndexedDB (hundreds of MB), the old copy is migrated over on first launch, and if a save ever fails you get told instead of losing work quietly.

## [0.11.0] - 2026-09-23

### Fixed
- **Builds in subfolders were invisible.** Mosslight only looked at the top level of the project folder, so a Unity game with its player in `Builds/` (or Unreal's `WindowsNoEditor/`, Godot's `export/`) showed "0 builds found". Opening a folder now searches through it, and **Test builds → Scan folder for builds** does the same for projects you already added.
  - Engine caches and source folders are skipped, and the helpers that ship beside a game — UnityCrashHandler, CrashReportClient, crash pads, redistributables — are filtered out, so you get the game and not its plumbing.
  - Builds are listed newest first and named after the folder they came from, and the newest becomes the one shown on the project page.

## [0.10.0] - 2026-09-23

### Added
- **Brand kit: the Mosslight loading screen, in your games.** The studio screen — lantern monogram with a slow glow, "Mosslight Studios presents" in tracked brass, the game title in a display serif, a thin progress bar and your own tips — now ships inside Mosslight and can be written into any game's folder.
  - **New project** has an **Add the Mosslight loading screen** tick. The kit lands in `Mosslight/Brand` in the game folder from the start, with a task for Codex to wire it in.
  - **Any existing project** gets the same from a **Loading screen** card on Overview: **Add loading screen**, **Show in folder**, and **Ask Codex to wire it in**.
  - What's written: `loading.html` (runs as-is — your loader drives it with `window.mosslightLoading.progress()` / `.done()`, and the bar creeps until then so it never looks frozen), `SplashScreen.jsx` (the same screen as a React component), `brand.css` (the tokens, dark and bone), the four brand PNGs, and a `README.md` with per-engine instructions. The game's name and pitch are filled in already.
  - **Unity, Unreal and Godot get the same screen, rebuilt.** The templates are web, so for a native engine the agents are given the files as reference plus an exact spec — colours, fonts, sizes and timings — and build it in-engine against real load progress.
  - **The agents know the kit is there.** Its path and purpose are in their context, so "use the studio colours" or "add a tip about the tide" lands on these files instead of a new invented look.
- **The startup splash now shows on Android too**, not just desktop.

## [0.9.0] - 2026-09-23

### Changed
- **Agents read the story bible.** Every request now carries your story, your sections and each character, map or vehicle in them — names, notes and where their pictures are on disk — so Codex, Claude and Grok write to your canon instead of inventing their own.

### Added
- **Attach files to any chat message.** A 📎 button in the composer, drag-and-drop onto the chat, or paste straight from the clipboard — screenshots, mp3s, zips, PDFs, text and code files. Up to 12 files per message.
  - **Screenshots and PDFs go to the agent as real images**, so Codex, Claude and Grok can see what you see instead of guessing from a description.
  - **Zips, audio and other files are saved to `Mosslight/Inbox` inside the project folder** and the agent is told the exact path — so Claude Code and Codex CLI can unzip an animation pack or import a track themselves.
  - **Text and code files are quoted inline** (up to 20k characters) for every agent, including the ones running through an API.
  - **Attachments sync**, so a screenshot you send from the phone is on the desktop and vice versa. Tap an attachment in the chat to open it.
  - Images are resized before sending, which keeps token cost down on big screenshots.

## [0.8.0] - 2026-09-23

### Added
- **Story tab — the game's bible, not a file browser.**
  - **The story** at the top: write it, paste it, or have Grok draft it.
  - **Sections you make yourself**: Characters, Maps, Locations, Vehicles, Factions, or any name you type.
  - **Each entry is its own page**: a character or a map with its own pictures, a main picture, and notes. Click a card to open it.
  - **Pictures come from your project folder** through a picker with search and folder filters, or from any file. They're copied to your other devices automatically, so characters and maps show on the phone.
  - **Documents** (your play guide PDF and other docs) now live at the bottom of the Story tab.
- **Art: choose which folders to show.** A project with thousands of images across dozens of engine-capture folders is now something you can narrow: **Choose folders** lists every folder with its image count, and only what you tick shows up. Grok's art and anything shared always shows.

### Changed
- The Overview card now previews the story and its sections, and links to the Story tab.
- The Guides tab is gone; documents moved into Story, so everything about the game's fiction is in one place.

## [0.7.0] - 2026-09-23

### Added
- **Music.** A new tab for the game's soundtrack, on desktop and Android.
  - Audio in the project folder (`.mp3 .wav .ogg .flac .m4a .aac`) is found automatically; **Add songs** picks files from anywhere.
  - A player bar at the bottom keeps playing while you move between tabs, projects and the chat. Tracks can be renamed.
  - **Share to my devices** copies a song into sync so it plays on the phone.
  - **The agents can see your tracks** (names and file paths), so "use Roadside Theme for the main menu" works, and local Claude Code or Codex can wire the actual file into the game.
- **Art gallery from your project folder.** The Art tab now shows every image in the project folder, grouped by the folder it's in — Characters, Maps, Cars, Concepts and so on — with search, a full-screen viewer with arrow keys, **Use as cover** and **Show in folder**.
  - **Share with my devices** copies a group (downscaled) into sync so the same art shows on your phone.
  - Concept art generated by Grok appears as its own group.
- **Guides.** PDFs in the project folder show up automatically, and **Add a document** takes your play guide from anywhere. They open inside Mosslight, and **Share to my devices** makes them readable on the phone.
- **Story.** A summary card on the project Overview for what the game is about, editable by hand or draftable by Grok. It also shows on the library tile and on Android, and the agents get it as context.
- **New build spotlight.** When Codex produces a build, or a new shortcut appears in your project folder or Desktop, the project shows a banner naming it, with **▶ Play this one** and **★ Make it the one shown** (only when it isn't already).

### Changed
- **Library tiles are now posters**: the game's art fills the whole tile, with the name and progress over it and the rest (story, next task, build buttons) rising on hover. Dropping an image on a tile still sets the cover.
- **The "+ New project" tile is gone.** A round **+** button (like the Android one) now opens **New project / Open from GitHub / Open local folder**.
- **The project page shows one build** — the newest, or the one you star in Test builds — with "N more in Test builds →" next to it, instead of a wall of buttons.
- **The project cover is shown whole** (no cropping), with a discreet ✎ that appears on hover for **Change cover / Pick from Art / Remove cover**.

### Fixed
- Android: covers in the games list no longer stretch past their square.

## [0.6.0] - 2026-09-23

### Fixed
- **Clicking a project tile opened a file picker instead of the project.** Tiles now open the project. To change the cover, open the project and use **Change cover** (or drop an image on the cover).
- **Cover art overflowed its tile.** Images are now cropped to fit the cover area everywhere.

### Added
- **Handoffs now carry a ready-to-run prompt.** When one agent suggests another takes over — for example Codex finishing a layout and handing the coding to Claude — it writes a complete prompt for that agent: the files involved, structure, exact values and acceptance criteria.
  - The card shows the prompt. You can read it, **Edit prompt**, then **Approve & run**, and the other agent starts on it immediately.
  - **⚙ Settings → Agents → Auto-approve handoffs** runs them without waiting for you.
- **Live progress while an agent works**, like a terminal:
  - Replies stream in as they're written.
  - Local Claude Code and Codex show each step as it happens ("Reading Player.cs", "Running npm run build", "Edited 3 files"), with a running timer.
  - **Stop** cancels a run (and anything it started). Finished replies keep a collapsible step list.
- **Agents work at the same time.** Each agent has its own queue, so you can ask Grok for art while Claude is still coding. Extra messages for a busy agent queue up and say so.
- **Team mode**: pick **Team** next to the composer and describe a bigger feature. A lead agent (Codex by default, in Settings) splits it into steps for each agent, showing each step's prompt. Approve once with **Run plan**, and steps run in parallel where they're independent, or in order where one needs another's output — each result passed along.
- **⚙ Settings → Agents → Let Claude Code run commands**: lets local Claude Code run builds and tests as well as editing files.

### Changed
- Local Claude Code and Codex now work directly in the project folder (editing files), instead of only replying with code.
- Runs interrupted by closing Mosslight are marked instead of staying stuck on "typing".

## [0.5.0] - 2026-09-23

### Added
- **GitHub integration for projects.**
  - **Open from GitHub** (Library):
    - On a computer, pick one of your repos and Mosslight clones it into a folder you choose, detects the engine and builds, and links the repo.
    - On the phone, the project is added linked to the repo.
  - **Open local folder** links the folder's GitHub repo automatically when it's a clone.
  - **Link existing repo** or **Create private repo** from any project's Overview.
  - **New project** can create a private GitHub repo. On a computer, it also creates a working folder in `~/Mosslight/Projects` with an engine-specific `.gitignore`, Git LFS for large art and audio (if installed), and a first commit pushed to GitHub.
- **Backups.**
  - **Back up now** commits and pushes the project folder. It pulls newer GitHub commits first if another computer pushed.
  - **Auto backup** (on by default) runs after local Claude or Codex runs and every 30 minutes, only when files changed.
  - The project shows the last backup time, device, commit and any error, on every synced device.
- **Agents can read the repo.** In API mode, Grok and on the phone, agents get the repo's file list, README and any file you mention by name. Local Claude Code and Codex already work directly in the folder.
- **Clone to this computer**: projects created on the phone or another PC can be cloned onto the current computer.
- **⚙ Settings → GitHub**: connect with a GitHub token, stored in the keychain. Setup is in [docs/SETUP.md](https://github.com/amosley0221/Mosslight-Game-Hub/blob/main/docs/SETUP.md#3-github-open-back-up-and-create-project-repos).
- The project header shows the linked repo, and clicking it opens the repo on GitHub.

### Security
- Git receives your token through environment variables for github.com only. It never appears on a command line and is never written into the project's git config or remote URL.

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
