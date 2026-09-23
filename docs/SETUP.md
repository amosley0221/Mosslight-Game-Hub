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

Each agent needs either an API key (**Remote**) or a command-line tool installed on your computer (**Local**, desktop only). Without either, it replies with a short note saying what to set up, and changes nothing in your project.

Keys are **not synced**, so add them on each device you want to chat from. The phone always uses Remote.

### Grok (ideas, story, concept art): xAI API

1. Go to **https://console.x.ai** and sign in.
2. Add credits under **Billing**. Image generation and chat both bill per use.
3. Go to **API Keys → Create API key** and copy the key (it starts with `xai-`).
4. In Mosslight: **⚙ Settings → Agents → Grok → Add API key**, paste the key, and click Save.
5. Test it: open a project and type *"Concept art for the main character"*. Grok replies, and up to two generated images appear in **Concept art**. They are also saved in the project's `concept/` folder on desktop, and synced to your other devices.

The models are set in the Grok row: `grok-4` for chat and `grok-2-image` for images. If xAI renames a model, type the new name there.

### Claude (code and systems)

**Option A: Remote, using the Anthropic API.** Works on desktop and phone.
1. Go to **https://console.anthropic.com**, then **Settings → API Keys → Create Key**. Add credits under **Billing**.
2. In Mosslight: **⚙ Settings → Agents → Claude → Add API key**, then paste the key (it starts with `sk-ant-`).
3. The model defaults to `claude-opus-5`. You can change it in the Claude row, for example to `claude-sonnet-5` for cheaper, faster replies.

**Option B: Local, using Claude Code on your computer.** This works inside your project folder and can edit your code.
1. Install Claude Code:
   - **Windows (PowerShell)**: `irm https://claude.ai/install.ps1 | iex`
   - **macOS**: `curl -fsSL https://claude.ai/install.sh | bash`
   - or, with Node.js installed: `npm install -g @anthropic-ai/claude-code`
2. Run `claude` once in a terminal and sign in (with a Claude Pro/Max plan or an API account).
3. In Mosslight: **⚙ Settings → Agents → Claude**. Turn the switch **off** so it reads **Local**.
4. Open a project with **Open local folder**. Claude then runs inside that folder.

### Codex (visual design and test builds)

**Option A: Remote, using the OpenAI API.** Works on desktop and phone. Good for design direction; it can't build your game.
1. Go to **https://platform.openai.com/api-keys → Create new secret key**, and add billing credits.
2. In Mosslight: **⚙ Settings → Agents → Codex → Add API key**, then paste the key (it starts with `sk-`).
3. The model defaults to `gpt-5-codex`. If OpenAI rejects it, type a model your account lists into the Codex row.

**Option B: Local, using the Codex CLI.** This is the one that actually packages test builds.
1. Install Node.js (LTS) from https://nodejs.org, then run: `npm install -g @openai/codex`
2. Run `codex` once in a terminal and sign in with your ChatGPT account (or an API key).
3. In Mosslight: **⚙ Settings → Agents → Codex**. Turn the switch **off** so it reads **Local**.
4. Open your project with **Open local folder**, then ask *"Package a fresh test build and put a shortcut on my desktop."* Codex works in the project folder.
   - When it finishes, the build appears under **Test builds**. It's registered automatically, and new shortcuts on your Desktop or in the project folder are also picked up within about 15 seconds.
   - If it's an Android APK, it's uploaded for your phone.

### Check everything works

- **Header pills**: each agent's call count goes up as you chat.
- **Project → Usage tab**: shows calls, tokens and estimated cost per agent, added up across all your devices.
- **An agent replies "isn't set up on this device yet"**: that agent has no key or CLI on this device. The message says what's missing.
