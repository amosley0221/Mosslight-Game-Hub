# Setting up Mosslight

This guide covers two things:

1. **Sync**, so every device shows the same library.
2. **The three agents** (Grok, Claude and Codex).

Do sync first, because your projects then follow you everywhere.

---

## 1. Sync across devices

Mosslight keeps your library in a **private GitHub repo** called [`amosley0221/mosslight-sync`](https://github.com/amosley0221/mosslight-sync). Each device reads and writes it with a GitHub token that can only touch that one repo.

### Step 1: create the sync token (once)

1. Open **https://github.com/settings/personal-access-tokens/new** while signed in as `amosley0221`.
2. **Token name**: `Mosslight sync`.
3. **Expiration**: pick the longest you're comfortable with. When it expires, sync stops and Mosslight shows an error; make a new token and pair again.
4. **Repository access**: choose **Only select repositories**, then pick **mosslight-sync**.
5. **Permissions → Repository permissions → Contents**: set it to **Read and write**. Leave everything else as it is; "Metadata: Read" is added automatically.
6. Click **Generate token** and copy it. It starts with `github_pat_`. GitHub only shows it once.

### Step 2: your first computer

1. Open Mosslight and go to **⚙ Settings → Sync across devices**.
2. The repo is already filled in (`amosley0221/mosslight-sync`). Paste the token.
3. Click **Turn on sync**. The status turns green and says "Synced just now".
4. Optionally, rename the device (for example "Studio PC") so it's easy to tell apart.

### Step 3: your phone

1. Install the latest `Mosslight_x.y.z_android.apk` from [Releases](https://github.com/amosley0221/Mosslight-Game-Hub/releases/latest).
2. On the computer, go to **Settings → Sync across devices → Pair a phone**. A QR code appears.
3. On the phone, open Mosslight, tap **⚙ → Scan pairing QR code**, and point it at the code.
   - The first time, Android may download Google's QR scanner. Just tap Scan again once it's done.
4. The phone shows your library within a few seconds.

If scanning isn't possible, use **Copy pairing link** on the computer, send it to yourself, and paste it into **"…or paste a pairing link"** on the phone.

### Step 4: another computer (a Mac or a second PC)

Install Mosslight. Then either:
- paste the token in Settings → Sync, or
- paste a **pairing link** copied from a device that's already set up.

> The QR code and pairing link contain your token. Only share them with your own devices.

### What syncs and what doesn't

| Synced to every device | Stays on each device |
|---|---|
| Projects, tasks, GDD, stack, activity | API keys (each device has its own) |
| Chat history and handoff approvals | Theme, Developer mode, Local/Remote agent choice |
| Cover images and concept art | Local project folders (the device that opened them owns them) |
| Test builds list, asset library index, usage | The asset files themselves |

### Where each build launches

- **Windows builds** (`.exe`, `.lnk`, `.bat`) launch only on Windows, and only on the PC that has the file.
- **Mac builds** (`.app`, `.command`) launch only on a Mac, and only on the Mac that has the file.
- **Android builds** (`.apk`) launch only on Android. When a computer with sync on finds an APK for a project (for example, one Codex just built), it uploads the APK to the sync repo automatically. On the phone, tap ▶: the first tap installs the game, and later taps launch it.
  - The first time, Android asks you to allow Mosslight to install apps. Allow it, then tap ▶ again.
- **Web builds** with an `https://` link open on any device.

Builds that can't run on the device you're holding are dimmed. Tap one to see where it can be played.

---

## 2. Setting up the agents

Each agent reaches its AI through an API key, or (Claude and Codex on desktop) through a command-line tool installed on your computer. Without either, it replies with a short note saying what to set up, and changes nothing in your project.

**How Claude and Codex connect on desktop:** each has an **Auto / Local / API** selector in ⚙ Settings → Agents.

| Mode | What it does |
|---|---|
| **Auto** (default) | Uses the local tool (`claude` or `codex`) when it's installed on this computer. Falls back to the API if the tool is missing or a run fails. |
| **Local** | Uses only the local tool. |
| **API** | Uses only the API key. |

Every reply is labelled **local** or **api** next to the agent's name, so you can see which was used. The Integrations page shows whether Claude Code and the Codex CLI were detected. The phone always uses the APIs.

The **Claude and Codex desktop apps can't be used**. They don't accept messages from other programs, so Local and Auto need the command-line tools below.

**Choosing models:** click **Load models** next to a model box to list the models your API key can use, straight from the provider, and pick one. **Custom…** accepts any exact model id. The Local row can stay on "CLI default" (your plan's model) or name a model to pass to the tool.

Keys are **not synced**, so add them on each device you want to chat from.

### Grok (ideas, story, concept art): xAI API

1. Go to **https://console.x.ai** and sign in.
2. Add credits under **Billing**. Image generation and chat both bill per use.
3. Go to **API Keys → Create API key** and copy the key (it starts with `xai-`).
4. In Mosslight: **⚙ Settings → Agents → Grok → Add API key**, paste the key, and click Save.
5. Test it: open a project and type *"Concept art for the main character"*. Grok replies, and up to two generated images appear in **Concept art**. They are also saved in the project's `concept/` folder on desktop, and synced to your other devices.

Grok's chat and image models are picked in its Settings row (Load models lists what your xAI key can use).

### Claude (code and systems)

**Option A: Remote, using the Anthropic API.** Works on desktop and phone.
1. Go to **https://console.anthropic.com**, then **Settings → API Keys → Create Key**. Add credits under **Billing**.
2. In Mosslight: **⚙ Settings → Agents → Claude → Add API key**, then paste the key (it starts with `sk-ant-`).
3. The API model defaults to `claude-opus-5`. Use **Load models** in the Claude row to pick a different one.

**Option B: Local, using Claude Code on your computer.** This works inside your project folder and can edit your code.
1. Install Claude Code:
   - **Windows (PowerShell)**: `irm https://claude.ai/install.ps1 | iex`
   - **macOS**: `curl -fsSL https://claude.ai/install.sh | bash`
   - or, with Node.js installed: `npm install -g @anthropic-ai/claude-code`
2. Run `claude` once in a terminal and sign in (with a Claude Pro/Max plan or an API account).
3. In Mosslight, leave Claude on **Auto** (or choose **Local**). Claude Code is detected automatically.
4. Open a project with **Open local folder**. Claude then runs inside that folder.

### Codex (visual design and test builds)

**Option A: Remote, using the OpenAI API.** Works on desktop and phone. Good for design direction; it can't build your game.
1. Go to **https://platform.openai.com/api-keys → Create new secret key**, and add billing credits.
2. In Mosslight: **⚙ Settings → Agents → Codex → Add API key**, then paste the key (it starts with `sk-`).
3. Use **Load models** in the Codex row to pick the model you want from the list your OpenAI account offers.

**Option B: Local, using the Codex CLI.** This is the one that actually packages test builds.
1. Install Node.js (LTS) from https://nodejs.org, then run: `npm install -g @openai/codex`
2. Run `codex` once in a terminal and sign in with your ChatGPT account (or an API key).
3. In Mosslight, leave Codex on **Auto** (or choose **Local**). The Codex CLI is detected automatically.
4. Open your project with **Open local folder**, then ask *"Package a fresh test build and put a shortcut on my desktop."* Codex works in the project folder.
   - When it finishes, the build appears under **Test builds**. It's registered automatically, and new shortcuts on your Desktop or in the project folder are also picked up within about 15 seconds.
   - If it's an Android APK, it's uploaded for your phone.

### Check everything works

- **Header pills**: each agent's call count goes up as you chat.
- **Project → Usage tab**: shows calls, tokens and estimated cost per agent, added up across all your devices.
- **An agent replies "isn't set up on this device yet"**: that agent has no key or CLI on this device. The message says what's missing.

---

## 3. GitHub: open, back up and create project repos

Mosslight can tie each project to its own GitHub repo:
- Existing projects open straight from their repo.
- Your work is backed up there.
- All three agents can read the code.
- New projects can get a new private repo automatically.

### Step 1: create a GitHub token for project repos (once per device)

This token is separate from the sync token, because it needs access to all your repos.

1. Open **https://github.com/settings/personal-access-tokens/new**.
2. **Token name**: `Mosslight projects`. Pick an expiration.
3. **Repository access**: choose **All repositories**.
4. **Repository permissions**:
   - **Contents**: Read and write, for cloning, reading and pushing backups.
   - **Administration**: Read and write, so Mosslight can create new repos.
   - "Metadata: Read" is added automatically.
5. Generate the token, then paste it into Mosslight: **⚙ Settings → GitHub (project repos) → Save**. It should say "Connected as @amosley0221".

Add the token on the phone too if you want to open repos or let agents read code from there.

On the computer, install **Git** (https://git-scm.com). Also install **Git LFS** (https://git-lfs.com), strongly recommended for Unreal, Unity and art-heavy projects.

### Opening a project you've already been working on

- **Library → Open from GitHub**, then pick the repo.
  - **On the computer**: choose where to put it. Mosslight clones it there, detects the engine and builds, and links the repo. The agents then work in that folder, and backups push back to the same repo.
  - **On the phone**: the project is added to your library, linked to the repo, so the agents can read its code from the phone.
- **Already have it on disk?** Use **Open local folder**. If the folder is a clone of a GitHub repo, Mosslight links it automatically.
- **Project exists but isn't linked?** On its Overview, use **GitHub → Link existing repo**.

### Creating a new project

In **New project**, leave **"Create a private GitHub repo"** ticked.
- On the computer, Mosslight also creates a folder in `~/Mosslight/Projects/<name>` and sets it up:
  - a `.gitignore` for your engine, so build and cache folders aren't uploaded
  - Git LFS for large art and audio files (if Git LFS is installed)
  - a first commit, pushed to the new repo
- For an existing project, use **GitHub → Create private repo** on its Overview.

### Backups

- **Back up now** (project Overview → GitHub) commits everything that changed and pushes it. If GitHub has newer commits, for example from another computer, Mosslight pulls them in first.
- **Auto backup** is on by default. It backs up after every local Claude or Codex run that could have changed files, and every 30 minutes, but only when something actually changed.
- The card shows when and from which device the last backup happened, the commit, and any error. For example, a file over GitHub's 100 MB limit shows an error; install Git LFS for those files.
- Backups run on the computer that has the project folder. Other computers can use **Clone to this computer**.

### How the agents use the repo

- **Local mode (Claude Code / Codex CLI)**: they work directly in the project folder, so they see and edit everything.
- **API mode, Grok, and the phone**: each message includes:
  - the repo's file list
  - the README
  - the contents of any file you mention by name, for example *"why does PlayerController.cs jitter?"*

  To have an agent look at a file, mention it.

---

## 4. How the chat works

### One message, one agent
Each message goes to a single agent. Mosslight picks by keywords, or you pick with the pills above the box (**Auto / Team / Grok / Codex / Claude**). If it can't tell, it asks you.

Agents work **in parallel**: while Claude is coding, you can ask Grok for art. A second message to a *busy* agent waits in that agent's queue and says so.

### Live progress
While an agent works you see:
- its reply streaming in;
- what a local tool is doing, step by step ("Reading Player.cs", "Running npm run build");
- a timer, and a **Stop** button.

After it finishes, the step list stays available (collapsed) under the reply.

### Handoffs: the Codex → Claude workflow
This is the workflow of asking Codex for design, then having it write the prompt for Claude Code:

1. Ask **Codex** for a layout or design.
2. Codex answers, and when the work needs code it adds a handoff card: *"Codex suggests Claude takes this"*, with a **ready-to-run prompt** for Claude — files, structure, exact values, acceptance criteria.
3. Read the prompt, optionally **Edit prompt**, then click **Approve & run**. Claude starts immediately, with live progress.

To skip the approval step, turn on **⚙ Settings → Agents → Auto-approve handoffs**.

It works in every direction: Claude hands visual work to Codex, Grok hands a concept to Codex to turn into a style guide, and so on.

### Team mode (bigger requests)
Choose the **Team** pill and describe something larger, for example *"add a fishing minigame with UI"*.

1. The **team lead** (Codex by default; change it in Settings) splits it into steps, one per agent, each with a full prompt.
2. You see the plan. Tap a step to read or edit its prompt, or drop a step.
3. **Run plan**: independent steps run at the same time, dependent ones wait for what they need, and each result is passed to the next agent.

### Sending files to an agent
Attach files to any message with the **📎** button, by dragging them onto the chat, or by pasting from the clipboard (⌘V / Ctrl+V after a screenshot). Up to 12 files at a time.

| What you attach | What the agent gets |
| --- | --- |
| Screenshots, PNG/JPG, PDFs | The actual picture or document — Claude, Codex and Grok look at it |
| Text and code files | The contents, quoted inline (first 20k characters) |
| Zips, mp3s, models, anything else | The file saved in `Mosslight/Inbox` in the project folder, with the exact path — a local Claude Code or Codex run can unzip or import it |

Attachments sync, so a screenshot you send from your phone is on the desktop too, and tapping one in the chat opens it. Big images are resized before they're sent, so a 4K screenshot doesn't cost a fortune in tokens.

### Telling the agents about a project that already has history
The chat's recent turns travel with each request (about the last 14, trimmed), so agents can act on "what Grok suggested" or "that plan". Older history is not sent, so anything that must hold for every request belongs somewhere durable:

1. **`AGENTS.md` in the project folder** — standing rules and current state: who owns what, branch rules, what's built and what isn't, which documents to trust. Local Claude Code and Codex read it themselves, and Mosslight also loads it (or `CLAUDE.md`, or `Docs/PROJECT-HANDOFF.md`) into *every* agent's context, so Grok and your phone get the same rules. The **Project instructions** card on Overview shows what was found.
2. **The Story summary** — a short baseline of what the game is and where it stands. It goes to every agent on every device.
3. **Tasks** — open tasks are listed in context, so nobody proposes work that's already queued.
4. **A linked GitHub repo** — only used for agents that *can't* see the folder (Grok, the phone, API fallbacks): they get the file list, the README, and any file you name by path in your message. Local runs read your disk directly.

With those in place, **Team** mode plans against the real project: the lead checks `AGENTS.md`, the docs folder and recent git history before proposing steps, and says when work is already underway instead of planning it twice.

### The loading screen (brand kit)
Every project can have the Mosslight screen that plays before the game boots. Tick **Add the Mosslight loading screen** when you create a project, or use the **Loading screen** card on any project's Overview.

It writes `Mosslight/Brand` into the game folder:

| File | What it's for |
| --- | --- |
| `loading.html` | The screen, ready to run. Your loader drives it: `window.mosslightLoading.progress(0–100)` and `.done()` |
| `SplashScreen.jsx` | The same screen as a React component (`mode="splash"` or `mode="loading"`) |
| `brand.css` | The tokens — colors dark and bone, fonts, the glow and rise animations |
| `assets/` | Monogram, icon, wordmark, full lockup |
| `README.md` | How to wire it into Unity, Unreal, Godot or a web game |

The game's name and pitch are already filled in; edit the `TIPS` list in `loading.html` to put real hints on the screen.

For Unity, Unreal or Godot the web files are the reference, not the implementation — **Ask Codex to wire it in** hands the agent the files plus the exact spec (colors, fonts, sizes, timings) and it rebuilds the screen in that engine against real load progress. All three agents carry the kit's path in their context, so they use it instead of inventing a look.

### What local agents can do
In Auto or Local mode on the computer, Claude Code and Codex run **inside the project folder** and can edit files. Claude Code can also run builds and tests if you turn on **Let Claude Code run commands** in Settings. With auto backup on, changes are committed and pushed to GitHub afterwards.

---

## 5. Art, music and guides

Each project has tabs for the things around the game, not just the code.

### Art
The **Art** tab shows images from the project folder, grouped by the folder they live in. A real game project has thousands of images across engine-capture folders, so use **Choose folders** to tick only the ones worth browsing — concepts, characters, key art. With a layout like:

```
F:\Vacancy\Art\Characters
F:\Vacancy\Art\Concepts
F:\Vacancy\Art\Maps
```

you get **Characters**, **Concepts** and **Maps** as groups, with counts. Click an image for the full-screen viewer (arrow keys move, Esc closes), where you can **Use as cover** or **Show in folder**. Build and cache folders are skipped.

Grok's generated concept art appears as its own group.

### Music
The **Music** tab is the game's soundtrack. Audio in the project folder is picked up automatically, and **Add songs** takes files from anywhere. Play from the list; the player bar at the bottom keeps going while you move around the app. Rename a track by clicking its name.

**The agents can see your tracks.** Their names and file paths go into every agent's context, so you can say *"use Roadside Theme for the main menu"* and local Claude Code or Codex can wire that exact file into the game.

### Story
The **Story** tab is the game's bible:

- **The story** — write it, paste it, or let Grok draft it.
- **Sections** you create: Characters, Maps, Locations, Vehicles, or your own.
- **Entries** inside each section — one per character or map — each with its own pictures, a main picture and notes. Pictures come from the project folder (searchable picker) or any file, and are copied to your other devices so they show on the phone.
- **Documents** at the bottom: your play guide and other PDFs, readable inside Mosslight.

### Seeing all of it on your phone
Art, music and guides live on the computer that holds the project folder. To see them on the phone, share them:

- **Art**: open a group and click **Share N images with my devices** (they're downscaled first).
- **Music**: **Share to my devices** on a track.
- **Guides**: **Share to my devices** on a document. (Story pictures are shared automatically.)

Shared items go into your private sync repo and then show, play and open on every paired device.

### New builds
When Codex makes a build — or a new shortcut appears in the project folder or on your Desktop — the project shows a banner naming it, with **▶ Play this one** and **★ Make it the one shown**. The project page shows just that one build; the rest live in **Test builds**, where a ★ picks which is on the project page.
