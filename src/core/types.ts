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
  /** Last-modified time, used to merge edits from other devices. */
  u?: number;
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

export type Message = { ts?: number; u?: number } & (
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'agent'; agent: AgentId; text: string; pending: boolean; route: string; userText?: string; showOverride?: boolean; error?: boolean }
  | { id: string; type: 'handoff'; from: AgentId; to: AgentId; reason: string; status: 'pending' | 'approved' | 'declined'; userText: string }
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
  handoff?: { to: AgentId; reason: string };
  error?: boolean;
}
