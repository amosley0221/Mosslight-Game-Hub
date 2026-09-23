export type AgentId = 'grok' | 'codex' | 'claude';
export type AgentMode = 'auto' | 'local' | 'remote';
export type Platform = 'windows' | 'mac' | 'android' | 'web';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type BuildKind = 'desktop' | 'web' | 'android';

export interface Task { id: string; agent: AgentId; title: string; status: TaskStatus; ts: number }
export interface Art { id: string; title: string; prompt: string; imagePath?: string; ts: number }
export interface GddSection { id: string; title: string; body: string; agent: AgentId }
export interface Build {
  id: string; name: string; path: string; kind: BuildKind; platform: Platform; by: AgentId; ts: number;
  /** Device whose disk holds `path` (local files only launch there). */
  device?: string;
  /** APK uploaded to the sync repo so phones can install it. */
  remote?: { assetId: number; name: string; size: number };
}
export interface CodeEntry { id: string; agent: AgentId; title: string; file: string; lang: string; code: string; ts: number }
export interface Activity { id: string; agent: AgentId; text: string; ts: number }

export interface Project {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  engines: string[];
  platforms: Platform[];
  stack: { languages: string[]; libraries: string[]; tools: string[] };
  folder: { name: string; path?: string; device?: string } | null;
  coverArt?: string;
  coverImage?: string;
  tasks: Task[];
  art: Art[];
  gdd: GddSection[];
  builds: Build[];
  code: CodeEntry[];
  activity: Activity[];
  /** Build paths the user removed, so folder watching does not re-add them. */
  dismissed?: string[];
  /** Linked GitHub repository (backups + context for agents). */
  repo?: RepoLink;
  /** Longer story/summary of the game, shown on Overview. */
  summary?: string;
  /** Build shown next to the title (defaults to the newest). */
  featuredBuild?: string;
  /** Design docs, play guides, PDFs. */
  docs?: ProjectDoc[];
  /** Art copied into sync so every device (phone included) can see it. */
  sharedArt?: SharedArt[];
  /** Music written for the game. */
  music?: MusicTrack[];
  /** Story bible: characters, maps, locations — each entry with its own pictures. */
  story?: StorySection[];
  /** Folders (relative to the project folder) the Art tab shows; unset = all of them. */
  artFolders?: string[];
  /** The Mosslight loading screen, written into the game's folder. */
  brand?: { path: string; device?: string; ts: number; tips?: string[]; wired?: boolean };
  /** A just-arrived build worth pointing at. */
  spotlight?: { buildId: string; ts: number };
  /** Last-modified time, used to merge edits from other devices. */
  u?: number;
}

export interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'audio' | 'archive' | 'text' | 'pdf' | 'other';
  size: number;
  mime?: string;
  /** Absolute path on `device` — what local agents open. */
  path?: string;
  device?: string;
  /** img: reference in sync, so other devices can see it. */
  ref?: string;
  /** Small preview for the chat bubble (images only). */
  thumb?: string;
}

export interface StoryEntry {
  id: string;
  name: string;
  body?: string;
  /** Local paths or img: refs. */
  images: string[];
  cover?: string;
  ts: number;
}

export interface StorySection {
  id: string;
  title: string;
  entries: StoryEntry[];
  ts: number;
}

export interface MusicTrack {
  id: string;
  name: string;
  /** Absolute path on `device`. */
  path: string;
  device?: string;
  folder?: string;
  size?: number;
  /** img: reference once shared, so it plays on every device. */
  ref?: string;
  ts: number;
}

export interface SharedArt {
  id: string;
  name: string;
  group: string;
  /** img: reference in the sync store. */
  ref: string;
  /** Absolute path on the device that shared it, when it came from a folder. */
  from?: string;
  ts: number;
}

export interface ProjectDoc {
  id: string;
  name: string;
  /** Absolute path on `device`, or a synced img:/https: reference. */
  path: string;
  device?: string;
  kind: 'pdf' | 'image' | 'text' | 'other';
  /** img: reference once shared to the other devices. */
  ref?: string;
  size?: number;
  ts: number;
}

export interface RepoLink {
  owner: string;
  name: string;
  branch?: string;
  private?: boolean;
  /** Commit and push automatically after local agent runs and every 30 minutes. */
  auto?: boolean;
  lastBackup?: number;
  lastBackupDevice?: string;
  lastCommit?: string;
  lastError?: string;
}

export type AssetKind = 'animation' | 'model' | 'texture' | 'audio' | 'font' | 'script' | 'shader' | 'image' | 'other';

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  size: string;
  tags: string[];
  ts: number;
  usedBy: string[];
  path?: string;
  preview?: string;
  hash?: string;
  links?: Record<string, string>;
  /** Device that holds `path` (the library file). */
  device?: string;
  u?: number;
}

/** One step of a Team plan. `after` = indexes of steps whose results this one needs. */
export interface PlanStep { agent: AgentId; title: string; prompt: string; after: number[]; status?: 'waiting' | 'running' | 'done' | 'failed' | 'skipped'; messageId?: string }

export type Message = { ts?: number; u?: number } & (
  | { id: string; type: 'user'; text: string; attachments?: Attachment[] }
  | {
      id: string; type: 'agent'; agent: AgentId; text: string; pending: boolean; route: string; userText?: string; showOverride?: boolean; error?: boolean;
      /** Waiting for this agent to finish an earlier request. */
      queued?: boolean;
      startedAt?: number;
      finishedAt?: number;
      /** Live activity, e.g. "Reading src/Player.cs", "Running npm run build". */
      steps?: string[];
      /** Local run id, so the device running it can stop it. */
      runId?: string;
      runDevice?: string;
      stopped?: boolean;
    }
  | { id: string; type: 'handoff'; from: AgentId; to: AgentId; reason: string; status: 'pending' | 'approved' | 'declined'; userText: string; prompt?: string; auto?: boolean }
  | { id: string; type: 'plan'; lead: AgentId; summary: string; steps: PlanStep[]; status: 'drafting' | 'pending' | 'running' | 'done' | 'declined' | 'failed'; userText: string; error?: string }
  | { id: string; type: 'choose'; userText: string }
);

export interface Usage { calls: number; tokens: number }

export interface Settings {
  theme: 'light' | 'dark';
  devMode: boolean;
  /** auto = local CLI first (desktop), API if the CLI is missing or fails. Grok is always remote. */
  mode: Record<AgentId, AgentMode>;
  /** Legacy (0.1–0.3) Local/Remote switch, migrated into `mode`. */
  remote?: Record<AgentId, boolean>;
  /** API model per agent. */
  models: Record<AgentId, string> & { grokImage: string };
  /** Model passed to the local CLI; empty = the CLI's own default. */
  localModels: Partial<Record<AgentId, string>>;
  /** Run agent-to-agent handoffs without waiting for Approve. */
  autoHandoff?: boolean;
  /** Let local Claude Code run shell commands (builds, tests) without asking. */
  localCommands?: boolean;
  /** Agent that plans Team requests. */
  teamLead?: AgentId;
  device: { name: string; paired: boolean };
  tools: Record<string, boolean>;
  libraryDir?: string;
}

export interface HubData {
  projects: Project[];
  /** Agent usage counted per device, summed for display. */
  usageBy: Record<string, Record<AgentId, Usage>>;
  messages: Record<string, Message[]>;
  assets: Asset[];
  /** Deletion markers: "p:<id>" projects, "a:<id>" assets, "m:<id>" messages → time deleted. */
  deleted?: Record<string, number>;
  /** Devices that share this library. */
  devices?: Record<string, { name: string; os: Platform; lastSeen: number }>;
}

/** What an agent reply can do to the project (spec: "Side effects of replies"). */
export interface AgentResult {
  text: string;
  tasks?: { title: string; agent?: AgentId }[];
  art?: { title: string; prompt: string; imagePath?: string }[];
  builds?: { name: string; path: string; kind?: BuildKind; platform?: Platform }[];
  code?: { title: string; file?: string; lang?: string; code: string }[];
  gdd?: { title: string; body: string };
  handoff?: { to: AgentId; reason: string; prompt?: string };
  error?: boolean;
}
