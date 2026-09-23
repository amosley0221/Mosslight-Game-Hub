import type { AgentId, AssetKind, Platform } from './types';

export const AGENTS: Record<AgentId, { id: AgentId; name: string; role: string; color: string; glyph: string; rate: number }> = {
  grok: { id: 'grok', name: 'Grok', role: 'Ideas & concept art', color: 'var(--ag-grok)', glyph: 'G', rate: 0.002 },
  codex: { id: 'codex', name: 'Codex', role: 'Visual design & builds', color: 'var(--ag-codex)', glyph: 'X', rate: 0.004 },
  claude: { id: 'claude', name: 'Claude', role: 'Code & systems', color: 'var(--ag-claude)', glyph: 'C', rate: 0.003 },
};
export const ORDER: AgentId[] = ['grok', 'codex', 'claude'];

/** Routing keywords. Longer keywords (> 5 chars) score 2, shorter score 1. */
export const KW: Record<AgentId, string[]> = {
  grok: ['idea', 'ideas', 'concept', 'brainstorm', 'pitch', 'story', 'lore', 'name for', 'names', 'theme', 'mood', 'world', 'character', 'narrative', 'plot', 'hook', 'genre', 'twist', 'artwork', 'concept art', 'key art', 'cover art', 'what if', 'setting', 'villain', 'quest', 'enemy', 'boss', 'level idea'],
  codex: ['ui', 'hud', 'shader', 'material', 'model', 'mesh', 'texture', 'sprite', 'vfx', 'particle', 'layout', 'lighting', 'visual', 'graphic', 'style guide', 'palette', 'menu', 'icon', 'font', 'render', 'post-process', 'environment art', 'rig', 'blockout', 'mockup', 'tileset', 'build', 'shortcut', 'test build', 'package', 'export'],
  claude: ['code', 'script', 'blueprint', 'c#', 'c++', 'gdscript', 'bug', 'implement', 'function', 'class', 'system', 'refactor', 'physics', 'controller', 'netcode', 'save', 'load', 'api', 'architecture', 'fix', 'error', 'compile', 'input', 'camera', 'inventory', 'state machine', 'pathfinding', 'optimize', 'performance', 'multiplayer', 'spawn', 'collision', 'javascript', 'typescript', 'logic', 'algorithm'],
};

export const TAGS = ['3D', '2D', 'Web', 'Mobile', 'PC / Console', 'Pixel art', 'Realistic', 'Stylized', 'Multiplayer', 'Open world', 'Fast prototype', 'No-code'];

export interface Engine { id: string; name: string; lang: string; tags: string[]; blurb: string }
export const ENGINES: Engine[] = [
  { id: 'unreal', name: 'Unreal Engine 5', lang: 'C++ · Blueprints', tags: ['3D', 'Realistic', 'PC / Console', 'Open world', 'Multiplayer'], blurb: 'AAA-grade rendering (Nanite, Lumen), huge worlds, built-in netcode. Heavy, but unmatched for realistic 3D.' },
  { id: 'unity', name: 'Unity', lang: 'C#', tags: ['3D', '2D', 'Mobile', 'PC / Console', 'Stylized', 'Multiplayer'], blurb: 'The generalist. Strongest mobile and cross-platform pipeline, massive asset store, works for 2D and 3D.' },
  { id: 'godot', name: 'Godot 4', lang: 'GDScript · C#', tags: ['2D', '3D', 'Pixel art', 'Fast prototype', 'Stylized', 'PC / Console'], blurb: 'Open source, tiny install, excellent 2D. Fast to iterate; 3D is solid for stylized games.' },
  { id: 'threejs', name: 'Three.js', lang: 'JavaScript', tags: ['Web', '3D', 'Fast prototype', 'Stylized'], blurb: 'Low-level WebGL scene graph. Ideal for browser-native 3D, playable prototypes and portfolio pieces.' },
  { id: 'babylon', name: 'Babylon.js', lang: 'TypeScript', tags: ['Web', '3D', 'Multiplayer'], blurb: 'Batteries-included web 3D: physics, GUI, audio, WebXR. More engine-like than Three.js.' },
  { id: 'playcanvas', name: 'PlayCanvas', lang: 'JavaScript', tags: ['Web', '3D', 'Mobile'], blurb: 'Browser-based collaborative editor for web 3D. A Unity-like editor for the web.' },
  { id: 'phaser', name: 'Phaser', lang: 'JavaScript', tags: ['Web', '2D', 'Pixel art', 'Fast prototype', 'Mobile'], blurb: 'The standard for 2D browser games. Sprites, tilemaps, arcade physics, instant deploy.' },
  { id: 'bevy', name: 'Bevy', lang: 'Rust', tags: ['3D', '2D', 'PC / Console', 'Fast prototype'], blurb: 'Data-driven ECS engine in Rust. Code-first, blazing performance, young ecosystem.' },
  { id: 'defold', name: 'Defold', lang: 'Lua', tags: ['2D', 'Mobile', 'Web', 'Pixel art'], blurb: 'Lightweight 2D engine with tiny builds. Loved for mobile and HTML5 releases.' },
  { id: 'gamemaker', name: 'GameMaker', lang: 'GML', tags: ['2D', 'Pixel art', 'PC / Console', 'Fast prototype'], blurb: 'Indie 2D workhorse behind many hits. Fast room-based workflow, easy console ports.' },
  { id: 'construct', name: 'Construct 3', lang: 'Visual events', tags: ['2D', 'No-code', 'Web', 'Fast prototype'], blurb: 'Event-sheet, no-code 2D engine in the browser. Quickest path from idea to playable.' },
  { id: 'love2d', name: 'LÖVE', lang: 'Lua', tags: ['2D', 'Pixel art', 'Fast prototype'], blurb: 'Minimal Lua framework. No editor, total control, perfect for jams and mechanics prototypes.' },
  { id: 'pico8', name: 'PICO-8', lang: 'Lua', tags: ['2D', 'Pixel art', 'Fast prototype'], blurb: 'Fantasy console with hard limits (128×128, 16 colors). Constraints breed finished games.' },
];
export const ENGINE_BY: Record<string, Engine> = Object.fromEntries(ENGINES.map(e => [e.id, e]));
export const engineName = (id: string) => (ENGINE_BY[id] || { name: id }).name;
export const WEB_ENGINES = ['threejs', 'babylon', 'phaser', 'playcanvas', 'construct'];

export type Depth = 'deep' | 'api' | 'launch';
export interface Tool { id: string; name: string; cat: string; depth: Depth; caps: string[]; how: string; keyName?: string }
export const TOOLS: Tool[] = [
  { id: 'unreal', name: 'Unreal Engine 5', cat: 'Engine', depth: 'deep', caps: ['Open project', 'Build & package', 'Launch build', 'Cook for Android'], how: 'UnrealEditor-Cmd / RunUAT BuildCookRun' },
  { id: 'unity', name: 'Unity', cat: 'Engine', depth: 'deep', caps: ['Open project', 'Batch build', 'Launch build', 'Android APK'], how: 'Unity -batchmode -executeMethod' },
  { id: 'godot', name: 'Godot 4', cat: 'Engine', depth: 'deep', caps: ['Open project', 'Headless export', 'Launch build', 'Android APK'], how: 'godot --headless --export-release' },
  { id: 'web', name: 'Web engines (Three.js, Babylon, Phaser, PlayCanvas)', cat: 'Engine', depth: 'deep', caps: ['npm run dev/build', 'Embedded preview', 'Push to phone (Capacitor)'], how: 'Node + Vite; Capacitor for Android' },
  { id: 'blender', name: 'Blender', cat: '3D', depth: 'deep', caps: ['Open .blend', 'Run Python scripts', 'Export FBX / GLB', 'Bake & retopo jobs'], how: 'blender --background --python' },
  { id: 'meshy', name: 'Meshy', cat: '3D · AI', depth: 'api', caps: ['Text → 3D', 'Image → 3D', 'Auto-texture', 'Save GLB to project'], how: 'REST API · key in keychain', keyName: 'meshy' },
  { id: 'tripo', name: 'Tripo', cat: '3D · AI', depth: 'api', caps: ['Image → 3D', 'Rig & animate'], how: 'REST API · key in keychain', keyName: 'tripo' },
  { id: 'imagegen', name: 'Image generation (xAI)', cat: 'Art · AI', depth: 'api', caps: ['Concept art', 'Textures', 'Key art variants'], how: 'xAI images API · drives the Concept art gallery', keyName: 'xai' },
  { id: 'elevenlabs', name: 'ElevenLabs', cat: 'Audio · AI', depth: 'api', caps: ['Voice lines', 'SFX'], how: 'REST API · key in keychain', keyName: 'elevenlabs' },
  { id: 'suno', name: 'Suno', cat: 'Audio · AI', depth: 'api', caps: ['Music tracks'], how: 'REST API · key in keychain', keyName: 'suno' },
  { id: 'substance', name: 'Substance 3D Painter', cat: 'Art', depth: 'launch', caps: ['Open with file', 'Watch folder for exports'], how: 'Process launch + folder watch' },
  { id: 'aseprite', name: 'Aseprite', cat: 'Art', depth: 'launch', caps: ['Open with file', 'CLI sheet export'], how: 'aseprite -b --sheet' },
  { id: 'krita', name: 'Krita', cat: 'Art', depth: 'launch', caps: ['Open with file'], how: 'Process launch' },
  { id: 'audacity', name: 'Audacity', cat: 'Audio', depth: 'launch', caps: ['Open with file'], how: 'Process launch' },
  { id: 'adb', name: 'Android device bridge', cat: 'Device', depth: 'deep', caps: ['Install APK', 'Launch on device', 'Logcat stream'], how: 'adb over USB / Wi-Fi' },
  { id: 'git', name: 'Git / Perforce', cat: 'Source', depth: 'deep', caps: ['Commit per agent task', 'Branch per feature', 'Diff in Dev tab'], how: 'git CLI · p4' },
  { id: 'claude', name: 'Claude Code (CLI)', cat: 'Agent · local', depth: 'deep', caps: ['Claude in Auto/Local mode', 'Works in the project folder', 'Uses your Claude plan'], how: 'claude -p (install: claude.ai/install)' },
  { id: 'codex', name: 'Codex CLI', cat: 'Agent · local', depth: 'deep', caps: ['Codex in Auto/Local mode', 'Packages test builds', 'Uses your ChatGPT plan'], how: 'codex exec (npm i -g @openai/codex)' },
];
export const DEPTH: Record<Depth, { label: string; hint: string }> = {
  deep: { label: 'Deep', hint: 'Open, build, run from the hub' },
  api: { label: 'API', hint: 'Called by agents; results land in the project' },
  launch: { label: 'Launch', hint: 'Opens the tool; hub watches the folder' },
};

export const ASSET_KINDS: Record<AssetKind, string> = { animation: 'Animation', model: '3D model', texture: 'Texture', audio: 'Audio', font: 'Font', script: 'Script', shader: 'Shader', image: 'Image', other: 'Other' };

export const kindOf = (n: string): AssetKind => {
  const e = (n.split('.').pop() || '').toLowerCase();
  if (['fbx', 'bvh', 'anim', 'glb'].includes(e) && /anim|walk|run|idle|jump|attack|mixamo/i.test(n)) return 'animation';
  if (['fbx', 'glb', 'gltf', 'obj', 'blend', 'usd', 'usdz'].includes(e)) return 'model';
  if (['png', 'jpg', 'jpeg', 'tga', 'exr', 'hdr', 'psd', 'webp'].includes(e)) return /normal|rough|albedo|metal|ao|height|_n\b|_r\b/i.test(n) ? 'texture' : 'image';
  if (['wav', 'mp3', 'ogg', 'flac'].includes(e)) return 'audio';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(e)) return 'font';
  if (['cs', 'cpp', 'h', 'gd', 'ts', 'js', 'py', 'lua'].includes(e)) return 'script';
  if (['hlsl', 'glsl', 'shader', 'usf', 'wgsl'].includes(e)) return 'shader';
  return 'other';
};

export const PLATFORMS: Platform[] = ['windows', 'mac', 'android', 'web'];
export const PLAT_LABEL: Record<Platform, string> = { windows: 'Windows', mac: 'macOS', android: 'Android', web: 'Web' };

export const LIB_HINTS: Record<string, string> = { three: 'Three.js', '@babylonjs/core': 'Babylon.js', phaser: 'Phaser', 'cannon-es': 'cannon-es', '@dimforge/rapier3d': 'Rapier', howler: 'Howler.js', gsap: 'GSAP', 'pixi.js': 'PixiJS', 'matter-js': 'Matter.js', zustand: 'Zustand', react: 'React', vite: 'Vite', typescript: 'TypeScript', 'socket.io': 'Socket.IO', colyseus: 'Colyseus', tweakpane: 'Tweakpane', 'lil-gui': 'lil-gui', playcanvas: 'PlayCanvas', '@capacitor/core': 'Capacitor' };

export const DEFAULT_MODELS = { claude: 'claude-opus-5', codex: 'gpt-5-codex', grok: 'grok-4', grokImage: 'grok-2-image' };

export const REPO = 'amosley0221/Mosslight-Game-Hub';
