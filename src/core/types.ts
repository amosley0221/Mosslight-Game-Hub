export type AgentId = 'grok' | 'codex' | 'claude';
export type Platform = 'windows' | 'mac' | 'android' | 'web';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type BuildKind = 'desktop' | 'web' | 'android';

export interface Task { id: string; agent: AgentId; title: string; status: TaskStatus; ts: number }
export interface Art { id: string; title: string; prompt: string; imagePath?: string; ts: number }
export interface GddSection { id: string; title: string; body: string; agent: AgentId }
export interface Build { id: string; name: string; path: string; kind: BuildKind; platform: Platform; by: AgentId; ts: number }
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
  folder: { name: string; path?: string } | null;
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
}

export type Message =
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'agent'; agent: AgentId; text: string; pending: boolean; route: string; userText?: string; showOverride?: boolean; error?: boolean }
  | { id: string; type: 'handoff'; from: AgentId; to: AgentId; reason: string; status: 'pending' | 'approved' | 'declined'; userText: string }
  | { id: string; type: 'choose'; userText: string };

export interface Usage { calls: number; tokens: number }

export interface Settings {
  theme: 'light' | 'dark';
  devMode: boolean;
  remote: Record<AgentId, boolean>;
  models: Record<AgentId, string> & { grokImage: string };
  device: { name: string; paired: boolean };
  tools: Record<string, boolean>;
  libraryDir?: string;
}

export interface HubData {
  projects: Project[];
  usage: Record<AgentId, Usage>;
  messages: Record<string, Message[]>;
  assets: Asset[];
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
