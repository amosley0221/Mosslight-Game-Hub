# Screens

Layout is a 56px header + a two-column body: main content (fluid, 24/28px padding) and a right chat rail (`clamp(300px, 32vw, 400px)`, collapsible via "Hide chat"). All cards: panel bg, 1px line border, 14px radius.

## Splash (desktop, on launch)
Full-window, theme background. Centered column: monogram (height min(46vh, 380px), drop-shadow 0 30px 60px rgba(0,0,0,.45)) → full wordmark lockup (height min(14vh,120px)) → three 6px accent dots blinking. Fades out after ~1.9s (600ms fade) or on click.

## Header
Left: Mosslight script wordmark (26px) as Home button · "/" · breadcrumb (Library / Integrations / project name). Right: three agent pills (16px colored circle with glyph G/X/C, name, mono call count), "Integrations", "Hide chat"/"Show chat", ⚙ settings (32px square).

## Library
Masthead: wordmark 52px + "GAME HUB" eyebrow (12px, accent, +0.22em) + subtitle "N projects · N test builds ready". Right: "Open local folder" (panel) and "New project" (accent, on-accent text).
Grid `repeat(auto-fill, minmax(280px, 1fr))`, gap 18. **Tile:** 16:10 cover image slot (drop/browse) with overlaid chips top-left (engine in mono, platforms) and "local" chip top-right if a folder is linked; body: name (16/600) + progress "done/total" mono; tagline (13, muted); stack line (mono 10, dim; engines + libraries, max 4); 4px progress bar (green fill); "Next · Agent: task" with agent dot; footer row of build buttons "▶ name · platform" (hover → codex color). Last cell: dashed "+ New project" tile (min-height 260).

## New project (modal, 600px)
Name (bold input), one-line pitch, Traits chips (multi-select, accent when on), Engines chips (★ prefix when suggested by traits; multi-select). Cancel / Create. Creates 3 starter tasks (Grok pitch, Codex mood board, Claude scaffold) and Pitch + Core loop GDD sections.

## Project
Header: 200px cover slot · name (30/600) + "📁 folder" chip · tagline (max 60ch) · chips (engines mono, platforms, traits) · progress bar split by agent color · one accent-colored "▶ Platform · build" button per build (codex color) · Remove.
Tabs (13/600, 2px green underline on active): Overview · Tasks · Test builds · Concept art · GDD · Stack · Dev (only if Developer mode) · Activity · Usage.

- **Overview:** "Up next" (up to 5 open tasks, doing first; click cycles status; dashed "Ask what to tackle next →" sends a plan request), "By agent" (3 progress bars) + "Test builds" list with ▶ Play, "Latest concept art" (4 slots, "See all →").
- **Tasks:** three columns, one per agent, 3px top border in agent color. Task row: 14px status circle (outline = todo, filled = done; click cycles), title (strike-through when done), ×. Footer dashed input "Add task, Enter to save".
- **Test builds:** explanation copy + "Ask Codex for a fresh build". Rows (44px ▶ button in codex color, name, mono path, platform chip, "Codex · when", ×). Dashed input to paste a shortcut/APK path + Add.
- **Concept art:** "Ask Grok for more art" (grok color). Cards: 4:3 image slot, title, prompt, "Grok · when", "Use as cover" / "★ Cover".
- **GDD:** editable section cards (title input, "Draft with <Agent>" sends a scoped request with that agent forced, textarea min 160px). "+ Section".
- **Stack:** two cards — Platforms chips (Windows/macOS/Android/Web) + Traits chips; Languages (mono chips), Libraries & plugins (removable chips + add input), Tools. "Tools wired to this project" card (subset of integrations, dot in depth color, "Manage integrations →"). Then Engines & frameworks grid: 13 engine cards (name, IN USE / SUGGESTED badge, language mono, blurb, tags, "★ Suggested — fits 3D, Web"). Click toggles engine; suggestions computed from traits.
- **Dev:** filter pills (All / Grok / Codex / Claude) + "N entries"; "Ask Claude to walk through the code" (claude color). Entry card: header (agent dot, title, mono file · lang, agent name, when, Copy, ×) + `pre` code block (mono 12, surface bg).
- **Activity:** single column list; 20px agent glyph, text, mono time.
- **Usage:** three cards (agent dot + name, $ cost 30/600, "N calls · Nk tokens" mono, share bar). Footnote about estimation.

## Asset library
Title + explanation + "N files · shared across all projects"; "Upload files" (accent). Full-width dashed drop zone (accent border/soft bg while dragging; click = browse). Filter pills per kind with mono counts (All / Animation / 3D model / Texture / Audio / Font / Script / Shader / Image / Other) + search input right-aligned. Grid `minmax(240px,1fr)`. Card: 16:9 preview (image slot for visual kinds, mono glyph ♪ { } ◈ Aa ▤ for others) with kind chip top-left; name (13/600, ellipsis) + size mono; tags "a · b"; "Used in X, Y" (green) or "Not used yet" (muted); row of project-name toggle buttons (click links/unlinks) + ×. Project Stack tab shows an "Assets from the library" card listing linked files with kind label and unlink ×, "Open asset library →".

## Integrations
Title + explanation with Deep/API/Launch legend; "N of 16 connected" mono. Grid `minmax(300px,1fr)`. Card: name (15/600) + category; depth badge (outlined, green=Deep, accent=API, muted=Launch); capability chips; mono command/API line; status (dot + "Connected" / "Detected · off" / "Needs API key" / "Not installed"); Connect / Disconnect / Add key button.

## Chat rail
Header: scope title ("Mosslight chat" or "<Project> · chat") + subtitle. Messages: user bubble (accent bg, on-accent text, 14/14/4/14 radius, right-aligned, max 88%); agent message (26px glyph circle, name in agent color, mono route label, "Reroute ▾" → row of "Send to X" outlined pills); typing dots; handoff card (border in target color, "X requests help from Y", reason, Approve (target color) / Decline); chooser card ("Couldn't tell who this is for. Who should take it?" + three outlined agent pills). Composer: pills Auto/Grok/Codex/Claude + live route preview (mono, colored), textarea 2 rows, 34px accent ↑ button (40% opacity while busy). Enter sends, Shift+Enter newline.

## Settings (modal, 560px)
Appearance: Light / Dark segmented. Developer mode toggle (38×22, knob 18). Agents: three rows (glyph, name, Local/Remote mono, hint, toggle in agent color when Remote). Android companion: "Paired · Pixel 8" (codex color) / "No device paired", "Open companion", "Pair device"/"Unpair".

## Android companion
Material device frame; same theme tokens. **Games:** wordmark 34px + subtitle, "Paired · device" pill; cards (96px square cover, name + progress, 2-line tagline, engine/platform chips, build buttons ≥32px tall). **Game:** 16:10 cover with "← Games" pill overlay; name 24/600; tagline; agent-split progress; "Launch on this device" rows (40px ▶ in codex color, name, "Codex · when", platform chip; min-height 60) + dashed "Ask Codex for an Android build" (44px); Stack chips; Up next (44px rows, click cycles); Concept art 2-col; Chat (last 6 messages incl. handoff approve/decline) + single-line composer with 36px ↑. Toast appears inside the frame above the nav bar. All hit targets ≥ 44px where possible, never below 32px.

## Toasts
Bottom-center pill, toast-bg/text tokens, 13/600, rises in, auto-dismiss 2.8s. Used for launches, folder detection results, connect/disconnect, cover set, validation.
