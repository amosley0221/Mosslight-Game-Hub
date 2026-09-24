# Changelog

Every release's notes come from this file. Add a section for the new version
at the top before releasing — the release workflow refuses to run without one.

## [0.33.1] - 2026-09-24

### Fixed
- **A branch stayed in the "not on GitHub yet" list after you pushed it.** The list compared against `refs/remotes/origin/*`, which is a local cache of the last fetch rather than GitHub itself — and inside an agent's clone that cache mirrors your project folder, not GitHub at all. The 0.32.0 push fix made it worse: pushing straight to the repo URL leaves the cache untouched, so a successful push changed nothing the list could see. It now asks GitHub what it holds, once per refresh, and compares against that. If GitHub can't be reached it falls back to the cache rather than calling everything unpushed.
## [0.33.0] - 2026-09-24

### Added
- **Agents now explain themselves, instead of reporting.** They work in your repository and answered in its vocabulary — branch heads, merge blockers, untracked copies — which is exact and unreadable if you didn't run the command yourself. They are now asked to say what a term means as they use it, never to leave a bare commit hash, branch or card id without saying what it is and why it matters, to separate what they checked from what they're guessing, to say what you need to do, and to use a table when comparing more than two things. Mistakes are reported in a fixed order: what happened, what caused it, whether anything was lost, what fixes it.
  - The old 170-word cap was most of the problem — there wasn't room to explain anything. Plain language allows 350 words, and full reasoning 600 with the evidence shown.
  - Settings → Agents → **How much they explain**: short and technical, plain language (the new default), or full reasoning.
## [0.32.0] - 2026-09-24

### Fixed
- **Pushing a branch from an agent's clone never reached GitHub.** An agent clones from your folder, so `origin` inside its clone is the folder — not GitHub. The push succeeded, moved the branch into your checkout, and stopped there, which is why a branch you just pushed kept appearing in the list. Pushes now name the project's GitHub repo instead of trusting `origin`. Nothing was lost: the commits are in your checkout, and pushing again sends them on.

### Added
- **A project lead.** One agent (Codex by default) reads the project when you open it and says what it would do next, without being asked. It sees the folder, `AGENTS.md`, the task cards and every branch GitHub hasn't seen, with real commit counts — not a screenshot of the hub, which is what an agent shown one will describe. Each step it proposes has an **Add** button to make it a task.
  - It is told it cannot reach GitHub, so it never proposes pushing. That stays your call.
  - It looks at most every 6 hours per project, and never while an agent is working.
  - Settings → Agents → **Project lead** changes who does it, or turns it off.
## [0.31.1] - 2026-09-24

### Fixed
- **Engine captures under a review folder still weren't found.** 0.31.0 searched `Tools/RuntimeReviews`, but the file walk prunes any folder named `Saved` — an engine's `Saved/` is mostly cache — and that is exactly where the editor writes its screenshots. Each review folder is now searched in its own right, which is how `Saved/Screenshots/WindowsEditor` becomes reachable. On this project that was most of the captures, not a corner case.
## [0.31.0] - 2026-09-24

### Added
- **Agents can put pictures in chat.** A local agent ends a line with `SHOT: <path to an image>` and it appears in the reply, with "Add to Art" like any other. It is told to show rather than describe — a capture it just took, or an image already on disk that backs up what it is saying. A comparison sends both.

### Fixed
- **Captures an agent took were not being found.** Two reasons, and the Arroyo playtest hit both: the folders searched didn't include `Art/Reports`, where review captures actually land; and a sandboxed agent works in its own clone under `Tools/Worktrees`, which was never searched at all. Both are covered now, and a capture that exists in your checkout and in the agent's clone is shown once, not twice.
## [0.30.0] - 2026-09-24

### Fixed
- **The `dotnet.exe` crash box during Unreal work.** `Exception 0xe0434352` is UnrealBuildTool dying at startup on `Could not find file ...\UnrealBuildTool\Trace.uba`. It is an Unreal bug — UBT checks the trace file exists, then moves it, and a second UBT started at the same moment moves it first — but Mosslight caused it by letting two agents build at once. The engine list now also reports a build in progress, so an agent can see it and wait.
  - The list matched editor windows only, so a build was invisible to everyone but the agent running it.
  - This is not cosmetic: the UBT that loses the race exits before compiling anything, so that build silently does not happen.
## [0.29.2] - 2026-09-24

### Fixed
- **Branches with nothing in them were offered for pushing.** The list asked whether a branch had an upstream, not whether it held any work — so one cut from `main` and never committed to appeared as "never pushed". It now counts commits the default branch doesn't have, and shows only branches that actually carry something. (Pushing an empty one was harmless — Push never merges and never touches `main` — but it would have left a remote branch identical to `main`.)
## [0.29.1] - 2026-09-23

### Fixed
- **The computer only reported in when sync started**, so after eight minutes it looked asleep to the phone even while running — and every request fell back to the API. It now reports in on each sync, throttled to a few minutes.
- **A dropped connection no longer throws away the whole run.** "stream ended without producing a Message with role=assistant" means the stream died mid-flight — common on a phone. Mosslight now asks once more without streaming instead of failing.
- **A request that fell back to the API says so.** When no computer claims a phone's request, the finished message keeps "no computer answered" in its label, so it's clear why it used API credit.
## [0.29.0] - 2026-09-23

### Added
- **The phone hands work to your computer.** Send from Android while the desktop is awake and Mosslight is open there, and the computer runs it — on Claude Code and Codex CLI, billed to your plans — instead of the phone calling the APIs. No setup, nothing to press: the request goes through your own sync repo, the computer claims it, and the steps and reply stream back to the phone as they happen.
  - The message says **Waiting for Windows PC to pick this up…**, then shows the run live with its steps.
  - **If no computer answers within 25 seconds** — asleep, or Mosslight closed — the phone runs it on the API as before, and the message says so.
  - Devices now report in every few minutes rather than hourly, so "awake" means the last 8 minutes.
  - Messages with attachments still run on the phone, since the files are there.
## [0.28.0] - 2026-09-23

### Fixed
- **Android landscape: the tabs sat in the scroll, so a long chat rode up above them.** The title, progress and tabs are now a fixed head on the right; only the tab's own content scrolls.
- **The cover filled its column with bars above and below it.** It now fills the whole left side.

### Added
- **Notifications when something needs you.** A run takes minutes, so the app is usually behind something else by the time it wants an answer. Mosslight now notifies you — on the desktop and on the phone — when a handoff is waiting for approval, when a team plan is ready to run, when the agents need you to pick who takes a request, and when a long run finishes or fails.
  - On the desktop it stays quiet while you're looking at the window, and says nothing about a reply that took a few seconds.
  - **⚙ Settings → Agents → Tell me when something needs me** turns it off. Permission is asked for once, the first time there's something worth saying.
## [0.27.1] - 2026-09-23

### Added
- **Push all**, when more than one branch is waiting.

### Fixed
- **A branch GitHub already has no longer reads "never pushed".** The list only knew about branches with upstream tracking configured, so one fetched by hand looked unpushed even when the remote held the same commit. It now compares against what `origin` actually has.
## [0.27.0] - 2026-09-23

### Fixed
- **Claude Code couldn't reach the worktree it was sent to.** Isolated work usually lives in a sibling checkout — `F:/Vacancy-render` beside `F:/Vacancy` — but Mosslight started Claude Code with only the project folder, so it stopped at "write access isn't granted yet" and asked you to run `/add-dir`. Every worktree of the project's repository is now passed to it automatically, so a task that names one can just proceed.
## [0.26.2] - 2026-09-23

### Changed
- **Codex is told not to contact GitHub.** Its sandbox runs as a separate Windows account with no access to your saved credentials, and the attempt crashes git's HTTPS helper — putting a Windows error dialog on your screen mid-run. It now commits on its own branch, says where it left the work, and stops; the hub pushes it from Overview → GitHub. Claude Code, which runs as you, is unaffected.
## [0.26.1] - 2026-09-23

### Fixed
- The unpushed-branch list now names the folder a branch lives in (`in Tools/Worktrees/MarketPlaytestReview`), which 0.26.0 collected but didn't show.
## [0.26.0] - 2026-09-23

### Added
- **Push an agent's branch from the hub.** Agents commit their work fine, but a sandboxed CLI can't reach your saved GitHub credentials, so its push fails with "no Schannel credentials" and the work sits on a local branch. Overview → GitHub now lists branches that aren't on GitHub yet — including ones committed inside an agent's own worktree, since worktrees share the repository — with a **Push** button each. It uses the hub's own token, which works, and never writes it to disk.
## [0.26.0] - 2026-09-23

### Added
- **Push an agent's branch from the hub.** Agents commit their work fine, but a sandboxed CLI can't reach your saved GitHub credentials, so its push fails with "no Schannel credentials" and the work sits on a local branch. Overview → GitHub now lists branches that aren't on GitHub yet — including ones committed inside an agent's own worktree, since worktrees share the repository — with a **Push** button each. It uses the hub's own token, which works, and never writes it to disk.
## [0.25.1] - 2026-09-23

### Fixed
- **A headless agent job looked like an abandoned session.** `UnrealEditor-Cmd.exe`, an offscreen render, Blender in `--background` — these have no window *by design*, and the Engine & GPU card called them "a session that never shut down", which is an invitation to kill an agent's work mid-run. They're now shown as a **headless job** with the log file they're writing, and ending one warns that it's very likely a run in progress. The agents' copy of the list says the same.
## [0.25.0] - 2026-09-23

### Changed
- **A run's steps are kept and can be read back.** While an agent works you see the last four, and **▾ N earlier steps** now expands the whole list in place. After it finishes, the line under the reply reads **show N steps** rather than a bare count, so it's clear the history is still there — every step of every run stays with its message.
- **Up to 200 steps are remembered per run** instead of 40, so a long local run doesn't lose its early work — which is usually where "read AGENTS.md", "searched for the branch" and the other decisions are.
## [0.24.1] - 2026-09-23

### Fixed
- **The Engine & GPU card vanished when nothing was running**, so "the slot is free" and "the feature isn't there" looked the same. It now always shows on a project, saying plainly that nothing is running and a capture can start.
## [0.24.0] - 2026-09-23

### Added
- **Engine & GPU card on the project page.** Shows every engine or heavy tool running on this computer — Unreal, Unity, Godot, Blender — with its PID, memory, when it started, and its window title. A process with **no window** is called out, because that's the usual cause of "something is still running" long after you closed it: a play session that never shut down, holding several gigabytes and the GPU. **End it** stops one, after telling you what you're ending.
- **The agents can see the slot too.** The same list goes into their context, with the rule that they must not start an engine or GPU capture while one is running, and must never end one themselves — they name it and leave the decision to you. That's the one part of your coordination contract nothing could enforce before.
## [0.23.1] - 2026-09-23

### Fixed
- **Codex refused to start on a real project: "The filename or extension is too long" (os error 206).** The prompt went to Codex as a command-line argument, and Windows caps a command line at about 32,000 characters — which a project with an `AGENTS.md`, a story bible, chat history and a long instruction passes easily. Codex now reads the prompt from standard input, the same as Claude Code since 0.21.1. Verified against Codex 0.156.
## [0.23.0] - 2026-09-23

### Changed
- **When a run falls back to the API and that fails too, you see both reasons.** Previously the local failure was thrown away and you got only the API's message — which made "You have no credits remaining" look like the CLI was out of credits.
- **Billing errors say whose balance ran out.** An API credit or quota error now spells out that it's the API key's own balance, not the ChatGPT/Claude plan the local CLI runs on, and points at Settings → Agents → Local to stop falling back to the paid API.
## [0.22.2] - 2026-09-23

### Fixed
- **A newly installed CLI could read as "not found" until Mosslight was launched fresh.** A process keeps the PATH it started with, and an app relaunched by its own updater inherits the old one — so adding Codex to your PATH and updating in place left it invisible. Mosslight now also looks where the official installers put things (`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`, the Anthropic equivalent), so installing a CLI doesn't depend on restarting anything.
## [0.22.1] - 2026-09-23

### Changed
- **Fewer documents mistaken for characters.** Reports and task cards whose names contain "profile" or "sheet" — `Docs/City-CPU-Profile54.md`, `Docs/Tasks/…-render-profile55-…md` — are no longer proposed: `Docs/Tasks`, `Docs/Reviews`, `Docs/Reports` and tool folders are skipped, names with digits or work words (profile, render, CPU, task, check, an agent's name) don't qualify, and a name has to be two to four words.
- **The agent's own verdict is used.** When it replies that a name "is not a character", that proposal arrives unticked with its explanation, rather than being hidden — you can still tick it if the agent got it wrong.
## [0.22.0] - 2026-09-23

### Fixed
- **Dialogs were trapped inside the card that opened them**, so their buttons could sit under the sections below — the Add button in Find in project was covered by the Documents tiles. Cards use `backdrop-filter`, which makes them the containing block for anything positioned `fixed`; dialogs now render at the top level, above everything, wherever they were opened from.
- **Documents were proposed as characters.** "Cast Biographies" and "Character Appearance Pass05" are collections, not people. Only files named after one person count as an entry (two or more words, none of them a category word); the collections are now passed to the agent as *where to read the bios from* instead.

### Added
- **Pick the main picture while reviewing.** Each proposal shows a strip of its pictures — click one to make it the entry's main picture, instead of taking whichever came first.

### Changed
- Proposals show their picture uncropped, so a full-body reference isn't cut off in the review list.
## [0.21.1] - 2026-09-23

### Fixed
- **Windows Defender killed local Claude Code runs.** Mosslight passed the whole context — the agent's role, your `AGENTS.md`, the story bible, the recent conversation — as a single command-line argument. A 20KB command line matches Defender's `Trojan:Win32/ClickFix` heuristic, so it terminated the run (and reported a severe threat) with nothing downloaded or executed. The context now goes in on standard input, which also keeps it clear of Windows' ~32KB argument limit that a long `AGENTS.md` plus history was heading for.

## [0.21.0] - 2026-09-23

### Fixed
- **Unreal installed on another drive was never found.** Detection only looked in `C:\Program Files\Epic Games\UE_5*`, so an engine the Epic launcher put on a second drive — `F:\Vacancy\Unreal\UE_5.8` — always read "Not installed". Mosslight now reads the launcher's own install records (`LauncherInstalled.dat`), so any engine it manages is found wherever it lives, newest first.

### Added
- **Locate… on every tool.** Point Mosslight at a program yourself when nothing finds it: a portable Blender (`F:\Vacancy\Tools\Blender\5.2.1\blender-launcher.exe`), a custom engine build, a tool on a drive nothing scans. The path is remembered per device and shown on the card.
## [0.20.0] - 2026-09-23

### Added
- **Find in project — it proposes, you approve.** A story section now offers to look through the whole project for what belongs in it: folders named after someone (`Characters/Cal Mercer/`), and documents named after someone anywhere in the repository (`Art/Deliveries/CastReferenceSheetsV1/cal-mercer-bio.md`). Each proposal arrives with its pictures, a bio condensed from the file it came from, and the source path — tick the ones you want, edit the name or notes inline, and **Add** writes only those. Nothing is created until you say so.
- **Type a name and it builds that profile.** In the same panel: type "Cal Mercer", press Build profile, and it gathers that person's pictures and whatever the project has written about them, ready to review.
- **New projects fill their own story bible.** When an agent names a character, location, map, vehicle or faction that the game will keep, it records it: `ENTRY: Characters | Ray Calder — drives the RV`. The entry appears in the Story tab as the project is planned, instead of being reconstructed later. Duplicates are ignored, five per reply, and the lines are stripped from what you read.

### Changed
- **Import from folder…** stays as the fallback for art kept somewhere unusual.
## [0.19.1] - 2026-09-23

### Added
- **Build from project.** A section named Characters (or Maps, Locations, Vehicles, Factions) finds the matching folder in the project — `Characters/`, `Cast/`, `Levels/` — and builds itself from it, no folder picker. **Import from folder…** is still there for anything kept elsewhere.

### Changed
- **Bios are taken from what you've already written.** The notes step now searches the whole project for each name in every spelling it might use — `Cal Mercer` → `cal-mercer-bio.md`, `cal_mercer`, `CalMercer` — anywhere in the repository, not just under `Docs/`. An existing bio is condensed faithfully rather than rewritten, and each entry reports the file it came from.

## [0.19.0] - 2026-09-23

### Fixed
- **"Draft with Grok" didn't write the story.** It sent the request to the chat and left the reply there, so the Story tab still said "No story yet" and you had to copy it across by hand. The draft now lands in the summary itself (and is still in the chat if you want the earlier attempt).

### Added
- **Build a section from your folders.** Any story section has **Import from folder…**: point it at the folder that holds one folder per character — `Characters/Ray Calder/*.png` — and every subfolder becomes an entry with its pictures attached and the first one as the main picture. Names already in the section are skipped, so you can run it again after adding art.
- **Write the missing notes.** Once entries exist, one button asks a local agent to write each missing bio *from the project's own documents* — it reads `Docs/` and the design files, keeps to 40–80 words, and marks what the documents don't say as unknown instead of inventing it. Entries you've already written are left alone, and everything stays editable by hand.

## [0.18.0] - 2026-09-23

### Fixed
- **Auto backup was committing agents' work to your default branch, and the agents got the blame.** Linking a repo turned auto backup on, and after every local run the hub ran `git add -A`, committed and pushed to whatever branch was checked out — usually `main`. So a run that carefully changed nothing still produced a commit, and the agent reading git afterwards saw work it hadn't done attributed to the project.
  - **Auto backup is now off by default** when you link or create a repo. Existing projects keep the setting they have — check it in Overview → GitHub.
  - **Automatic backups never touch the repo's default branch.** On `main` they're skipped; on a feature branch they work as before. A backup you press the button for still does exactly what you asked.
  - **Commits say who made them**, titled `Mosslight backup — …`, and when auto backup is on the agents are told so in their context, so a hub commit is never mistaken for theirs.

## [0.17.2] - 2026-09-23

### Fixed
- **Auto-routing matched fragments of words.** Keywords were compared as plain substrings, so "ui" matched inside "b**ui**ld" and sent build and engineering requests to the design agent — the route label would read `auto-routed · "ui"` on a message with no "ui" in it. Matching is now whole words (still allowing `-s`, `-es`, `-ing`, `-ed`), covered by tests.

## [0.17.1] - 2026-09-23

### Fixed
- **Codex couldn't change anything.** Recent Codex CLI versions removed `--full-auto`, so the whole command was rejected and Mosslight quietly fell back to a plain run — which uses Codex's **read-only** sandbox. It could look at your project but never write to it, and reported things like "the filesystem tool failed to start". Codex now runs with `-s workspace-write` (plus network access unless you've turned that off), and falls back to `--full-auto` only for older CLIs.

## [0.17.0] - 2026-09-23

### Added
- **Agents can see the conversation.** Until now every request was sent on its own, so "turn what Grok suggested into a task for Claude" meant nothing — the agent had never seen Grok's reply. Each request now carries the recent chat: your messages, the agents' replies, handoff cards with the prompt that was written, and team plans with their steps.
  - Roughly the last 14 turns, trimmed to about 7,000 characters with the newest kept first, so a long thread costs a predictable amount.
  - It's labelled as context, not as work to redo, and it tells the agent that "that plan", "the card" or "what Grok suggested" is in there — instead of asking you to paste it again.
  - The team lead gets it too, so a plan can build on what was already discussed.

## [0.16.1] - 2026-09-23

### Fixed
- **The Android tab strip was squashed to a few unclickable pixels** whenever a tab had tall content under it — Builds with a dozen shortcuts, but Art, Story and Chat too. The strip now keeps its height, sticks to the top while you scroll, spans the full width, and has no stray scrollbar.

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
