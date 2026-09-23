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
