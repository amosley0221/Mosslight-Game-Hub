(function () {
const AGENTS = {
  grok:   { id:'grok',   name:'Grok',   role:'Ideas & concept art',      color:'var(--ag-grok)', glyph:'G', rate:0.002 },
  codex:  { id:'codex',  name:'Codex',  role:'Visual design & builds',   color:'var(--ag-codex)', glyph:'X', rate:0.004 },
  claude: { id:'claude', name:'Claude', role:'Code & systems',           color:'var(--ag-claude)', glyph:'C', rate:0.003 },
};
const ORDER = ['grok','codex','claude'];
const KW = {
  grok:['idea','ideas','concept','brainstorm','pitch','story','lore','name for','names','theme','mood','world','character','narrative','plot','hook','genre','twist','artwork','concept art','key art','cover art','what if','setting','villain','quest','enemy','boss','level idea'],
  codex:['ui','hud','shader','material','model','mesh','texture','sprite','vfx','particle','layout','lighting','visual','graphic','style guide','palette','menu','icon','font','render','post-process','environment art','rig','blockout','mockup','tileset','build','shortcut','test build','package','export'],
  claude:['code','script','blueprint','c#','c++','gdscript','bug','implement','function','class','system','refactor','physics','controller','netcode','save','load','api','architecture','fix','error','compile','input','camera','inventory','state machine','pathfinding','optimize','performance','multiplayer','spawn','collision','javascript','typescript','logic','algorithm'],
};
const TAGS = ['3D','2D','Web','Mobile','PC / Console','Pixel art','Realistic','Stylized','Multiplayer','Open world','Fast prototype','No-code'];
const ENGINES = [
  { id:'unreal',   name:'Unreal Engine 5', lang:'C++ · Blueprints', tags:['3D','Realistic','PC / Console','Open world','Multiplayer'], blurb:'AAA-grade rendering (Nanite, Lumen), huge worlds, built-in netcode. Heavy, but unmatched for realistic 3D.' },
  { id:'unity',    name:'Unity',           lang:'C#',               tags:['3D','2D','Mobile','PC / Console','Stylized','Multiplayer'], blurb:'The generalist. Strongest mobile and cross-platform pipeline, massive asset store, works for 2D and 3D.' },
  { id:'godot',    name:'Godot 4',         lang:'GDScript · C#',    tags:['2D','3D','Pixel art','Fast prototype','Stylized','PC / Console'], blurb:'Open source, tiny install, excellent 2D. Fast to iterate; 3D is solid for stylized games.' },
  { id:'threejs',  name:'Three.js',        lang:'JavaScript',       tags:['Web','3D','Fast prototype','Stylized'], blurb:'Low-level WebGL scene graph. Ideal for browser-native 3D, playable prototypes and portfolio pieces.' },
  { id:'babylon',  name:'Babylon.js',      lang:'TypeScript',       tags:['Web','3D','Multiplayer'], blurb:'Batteries-included web 3D: physics, GUI, audio, WebXR. More engine-like than Three.js.' },
  { id:'playcanvas', name:'PlayCanvas',    lang:'JavaScript',       tags:['Web','3D','Mobile'], blurb:'Browser-based collaborative editor for web 3D. A Unity-like editor for the web.' },
  { id:'phaser',   name:'Phaser',          lang:'JavaScript',       tags:['Web','2D','Pixel art','Fast prototype','Mobile'], blurb:'The standard for 2D browser games. Sprites, tilemaps, arcade physics, instant deploy.' },
  { id:'bevy',     name:'Bevy',            lang:'Rust',             tags:['3D','2D','PC / Console','Fast prototype'], blurb:'Data-driven ECS engine in Rust. Code-first, blazing performance, young ecosystem.' },
  { id:'defold',   name:'Defold',          lang:'Lua',              tags:['2D','Mobile','Web','Pixel art'], blurb:'Lightweight 2D engine with tiny builds. Loved for mobile and HTML5 releases.' },
  { id:'gamemaker', name:'GameMaker',      lang:'GML',              tags:['2D','Pixel art','PC / Console','Fast prototype'], blurb:'Indie 2D workhorse behind many hits. Fast room-based workflow, easy console ports.' },
  { id:'construct', name:'Construct 3',    lang:'Visual events',    tags:['2D','No-code','Web','Fast prototype'], blurb:'Event-sheet, no-code 2D engine in the browser. Quickest path from idea to playable.' },
  { id:'love2d',   name:'LÖVE',            lang:'Lua',              tags:['2D','Pixel art','Fast prototype'], blurb:'Minimal Lua framework. No editor, total control, perfect for jams and mechanics prototypes.' },
  { id:'pico8',    name:'PICO-8',          lang:'Lua',              tags:['2D','Pixel art','Fast prototype'], blurb:'Fantasy console with hard limits (128×128, 16 colors). Constraints breed finished games.' },
];
const TOOLS = [
  { id:'unreal', name:'Unreal Engine 5', cat:'Engine', depth:'deep', caps:['Open project','Build & package','Launch build','Cook for Android'], how:'UnrealEditor-Cmd / RunUAT BuildCookRun', installed:true },
  { id:'unity', name:'Unity', cat:'Engine', depth:'deep', caps:['Open project','Batch build','Launch build','Android APK'], how:'Unity -batchmode -executeMethod', installed:true },
  { id:'godot', name:'Godot 4', cat:'Engine', depth:'deep', caps:['Open project','Headless export','Launch build','Android APK'], how:'godot --headless --export-release', installed:true },
  { id:'web', name:'Web engines (Three.js, Babylon, Phaser, PlayCanvas)', cat:'Engine', depth:'deep', caps:['npm run dev/build','Embedded preview','Push to phone (Capacitor)'], how:'Node + Vite; Capacitor for Android', installed:true },
  { id:'blender', name:'Blender', cat:'3D', depth:'deep', caps:['Open .blend','Run Python scripts','Export FBX / GLB','Bake & retopo jobs'], how:'blender --background --python', installed:true },
  { id:'meshy', name:'Meshy', cat:'3D · AI', depth:'api', caps:['Text → 3D','Image → 3D','Auto-texture','Save GLB to project'], how:'REST API · key in Settings', installed:false },
  { id:'tripo', name:'Tripo', cat:'3D · AI', depth:'api', caps:['Image → 3D','Rig & animate'], how:'REST API · key in Settings', installed:false },
  { id:'imagegen', name:'Image generation (xAI / SD / Flux)', cat:'Art · AI', depth:'api', caps:['Concept art','Textures','Key art variants'], how:'API · drives the Concept art gallery', installed:true },
  { id:'elevenlabs', name:'ElevenLabs', cat:'Audio · AI', depth:'api', caps:['Voice lines','SFX'], how:'REST API', installed:false },
  { id:'suno', name:'Suno', cat:'Audio · AI', depth:'api', caps:['Music tracks'], how:'REST API', installed:false },
  { id:'substance', name:'Substance 3D Painter', cat:'Art', depth:'launch', caps:['Open with file','Watch folder for exports'], how:'Process launch + file watcher', installed:false },
  { id:'aseprite', name:'Aseprite', cat:'Art', depth:'launch', caps:['Open with file','CLI sheet export'], how:'aseprite -b --sheet', installed:true },
  { id:'krita', name:'Krita', cat:'Art', depth:'launch', caps:['Open with file'], how:'Process launch', installed:false },
  { id:'audacity', name:'Audacity', cat:'Audio', depth:'launch', caps:['Open with file'], how:'Process launch', installed:false },
  { id:'adb', name:'Android device bridge', cat:'Device', depth:'deep', caps:['Install APK','Launch on device','Logcat stream'], how:'adb over USB / Wi-Fi', installed:true },
  { id:'git', name:'Git / Perforce', cat:'Source', depth:'deep', caps:['Commit per agent task','Branch per feature','Diff in Dev tab'], how:'git CLI · p4', installed:true },
];
const ASSET_KINDS = { animation:'Animation', model:'3D model', texture:'Texture', audio:'Audio', font:'Font', script:'Script', shader:'Shader', image:'Image', other:'Other' };
const kindOf = n => { const e = (n.split('.').pop() || '').toLowerCase(); if (['fbx','bvh','anim','glb'].includes(e) && /anim|walk|run|idle|jump|attack|mixamo/i.test(n)) return 'animation'; if (['fbx','glb','gltf','obj','blend','usd','usdz'].includes(e)) return 'model'; if (['png','jpg','jpeg','tga','exr','hdr','psd'].includes(e)) return /normal|rough|albedo|metal|ao|height|_n\b|_r\b/i.test(n) ? 'texture' : 'image'; if (['wav','mp3','ogg','flac'].includes(e)) return 'audio'; if (['ttf','otf','woff','woff2'].includes(e)) return 'font'; if (['cs','cpp','h','gd','ts','js','py','lua'].includes(e)) return 'script'; if (['hlsl','glsl','shader','usf','wgsl'].includes(e)) return 'shader'; return 'other'; };
const seedAssets = () => [
  { id:uid(), name:'Mixamo_Idle_Breathing.fbx', kind:'animation', size:'2.1 MB', tags:['humanoid','idle'], ts:now()-6*D, usedBy:['hollowmere'] },
  { id:uid(), name:'Mixamo_Walk_Forward.fbx', kind:'animation', size:'2.4 MB', tags:['humanoid','locomotion'], ts:now()-6*D, usedBy:['hollowmere'] },
  { id:uid(), name:'Lantern_v3.glb', kind:'model', size:'860 KB', tags:['prop','pbr'], ts:now()-3*D, usedBy:['hollowmere'] },
  { id:uid(), name:'Moss_Albedo_2k.png', kind:'texture', size:'4.8 MB', tags:['foliage','2k'], ts:now()-2*D, usedBy:[] },
  { id:uid(), name:'UI_Click_Soft.wav', kind:'audio', size:'38 KB', tags:['ui'], ts:now()-9*D, usedBy:['hollowmere','byteshift','orbital'] },
  { id:uid(), name:'CameraShake.cs', kind:'script', size:'3 KB', tags:['unity','camera'], ts:now()-12*D, usedBy:['byteshift'] },
  { id:uid(), name:'Fog_Depth.hlsl', kind:'shader', size:'6 KB', tags:['fog','post'], ts:now()-1*D, usedBy:['hollowmere'] },
];
const DEPTH = { deep:{ label:'Deep', hint:'Open, build, run from the hub' }, api:{ label:'API', hint:'Called by agents; results land in the project' }, launch:{ label:'Launch', hint:'Opens the tool; hub watches the folder' } };
const ENGINE_BY = Object.fromEntries(ENGINES.map(e => [e.id, e]));
const KEY = 'gdh:state:v3';
const SKEY = 'gdh:settings:v1';
const PLATFORMS = ['windows','mac','android','web'];
const PLAT_LABEL = { windows:'Windows', mac:'macOS', android:'Android', web:'Web' };
const LIB_HINTS = { three:'Three.js', '@babylonjs/core':'Babylon.js', phaser:'Phaser', 'cannon-es':'cannon-es', '@dimforge/rapier3d':'Rapier', howler:'Howler.js', gsap:'GSAP', 'pixi.js':'PixiJS', 'matter-js':'Matter.js', zustand:'Zustand', react:'React', vite:'Vite', typescript:'TypeScript', 'socket.io':'Socket.IO', colyseus:'Colyseus', tweakpane:'Tweakpane', 'lil-gui':'lil-gui', playcanvas:'PlayCanvas', '@capacitor/core':'Capacitor' };
const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => Date.now();
const H = 3600e3, D = 86400e3;
const ago = t => { const s = Math.max(0, (now() - t) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
const AC = () => 'var(--accent)';
const ACT = () => 'var(--on-accent)';
const ACS = () => 'var(--accent-soft)';
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '0%';
const T = (agent, title, status, dt) => ({ id: uid(), agent, title, status, ts: now() - dt });
const A = (agent, text, dt) => ({ id: uid(), agent, text, ts: now() - dt });

function seed() {
  const p1 = { id:'hollowmere', name:'Hollowmere', tagline:'A cozy-dark fishing town where the tide brings back the drowned. Rebuild the harbor, bargain with tide gods, keep the lights on.', tags:['3D','Stylized','PC / Console','Open world'], engines:['unreal'], platforms:['windows','mac'], stack:{ languages:['C++','Blueprints'], libraries:['Niagara','MetaSounds','Gameplay Ability System'], tools:['Perforce','RenderDoc'] }, folder:{ name:'Hollowmere' },
    code:[{id:uid(),agent:'claude',title:'Tide level sampler',file:'Source/Hollowmere/TideSubsystem.cpp',lang:'cpp',ts:now()-2*D,code:'float UTideSubsystem::SampleLevel(float WorldTime) const\n{\n    const float Phase = FMath::Fmod(WorldTime, CycleSeconds) / CycleSeconds;\n    const float Base  = FMath::Sin(Phase * 2.f * PI);\n    return FMath::Lerp(LowTideZ, HighTideZ, (Base + 1.f) * 0.5f) + StormOffset;\n}'},{id:uid(),agent:'codex',title:'Lantern HUD material — fog fade',file:'Content/UI/M_LanternFade.usf',lang:'hlsl',ts:now()-3*D,code:'float fade = saturate((Depth - FogStart) / (FogEnd - FogStart));\nreturn lerp(LanternColor, FogColor, fade * FogDensity);'}],
    tasks:[T('grok','Core pitch and three-act outline','done',5*D),T('grok','Concept: harbor at low tide','done',4*D),T('grok','Name and personality for the three tide gods','todo',1*D),T('codex','HUD style guide (lantern motif)','done',3*D),T('codex','Harbor blockout & lighting pass','doing',2*D),T('codex','Fog and water shader look-dev','todo',1*D),T('claude','Tide simulation system (Blueprint → C++)','doing',2*D),T('claude','Fishing minigame controller','todo',1*D),T('claude','Save/load for tide state','todo',6*H)],
    art:[{id:uid(),title:'Harbor at low tide',prompt:'Wooden harbor, fog, stranded boats, lantern glow, painterly',ts:now()-4*D},{id:uid(),title:'The Drowned return',prompt:'Silhouettes walking out of the water toward town lights',ts:now()-3*D},{id:uid(),title:'Tide god — Marrow',prompt:'Antler-coral deity half submerged, bioluminescent',ts:now()-2*D},{id:uid(),title:'Lighthouse keeper',prompt:'Weathered protagonist with oil lamp and net',ts:now()-1*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Stardew meets Sunless Sea. Each night the tide returns something — or someone — lost. Trade with the drowned, restore the harbor, decide who gets to stay.'},{id:uid(),title:'Core loop',agent:'claude',body:'Day: fish, repair, trade. Dusk: tide forecast. Night: the Drowned arrive; light placement decides who reaches town. Dawn: consequences.'},{id:uid(),title:'Art direction',agent:'codex',body:'Stylized realism. Desaturated teals and bone whites, warm lantern accents. Fog as a design tool for draw distance.'},{id:uid(),title:'Systems',agent:'claude',body:'Tide sim drives spawns, water level, and pathing. Persistent town state per NPC. Weather as modifier.'}],
    builds:[{id:uid(),name:'Hollowmere_Win64_Test.lnk',path:'C:\\Users\\you\\Desktop\\Hollowmere_Win64_Test.lnk',kind:'desktop',by:'codex',ts:now()-1*D},{id:uid(),name:'Hollowmere_Editor.lnk',path:'C:\\Users\\you\\Desktop\\Hollowmere_Editor.lnk',kind:'desktop',by:'codex',ts:now()-3*D}],
    activity:[A('codex','Created desktop shortcut Hollowmere_Win64_Test.lnk',1*D),A('claude','Started Tide simulation system',2*D),A('codex','Started Harbor blockout & lighting pass',2*D),A('grok','Generated concept: Tide god — Marrow',2*D),A('grok','Completed Core pitch and three-act outline',5*D)] };
  const p2 = { id:'byteshift', name:'Byteshift', tagline:'Pixel roguelike where every death rewrites one rule of the dungeon.', tags:['2D','Pixel art','Fast prototype','PC / Console'], engines:['godot'], platforms:['windows','android','web'], stack:{ languages:['GDScript'], libraries:['GodotSteam','Dialogic'], tools:['Aseprite','LDtk'] }, folder:null,
    code:[{id:uid(),agent:'claude',title:'Rule hot-swap',file:'scripts/rule_engine.gd',lang:'gdscript',ts:now()-3*D,code:'func mutate(rule_id: StringName) -> void:\n    var rule := RULES[rule_id]\n    active[rule_id] = rule.next(active.get(rule_id))\n    rule_changed.emit(rule_id, active[rule_id])\n    _rebuild_floor_modifiers()'}],
    tasks:[T('grok','Rule-mutation table (40 rules)','done',6*D),T('grok','Boss concepts for floors 3, 6, 9','todo',2*D),T('codex','16×16 tileset — stone / moss / glitch','done',4*D),T('codex','Death screen rule-reveal animation','doing',1*D),T('claude','Rule engine with hot-swap','done',3*D),T('claude','Procedural floor generator','doing',1*D),T('claude','Controller remapping','todo',5*H)],
    art:[{id:uid(),title:'Glitch dungeon key art',prompt:'Pixel dungeon dissolving into corrupted tiles',ts:now()-5*D},{id:uid(),title:'Floor 3 boss — The Archivist',prompt:'Robed figure made of index cards',ts:now()-2*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Every death permanently changes one dungeon rule. Runs get stranger, never easier.'},{id:uid(),title:'Core loop',agent:'claude',body:'Descend → die → pick 1 of 3 rule mutations → descend again with the mutated ruleset.'}],
    builds:[{id:uid(),name:'Byteshift_Test.lnk',path:'C:\\Users\\you\\Desktop\\Byteshift_Test.lnk',kind:'desktop',platform:'windows',by:'codex',ts:now()-1*D},{id:uid(),name:'byteshift-debug.apk',path:'/sdcard/Download/byteshift-debug.apk',kind:'android',platform:'android',by:'codex',ts:now()-10*H},{id:uid(),name:'Byteshift_Web/index.html',path:'C:\\Users\\you\\Desktop\\Byteshift_Web\\index.html',kind:'web',by:'codex',ts:now()-2*D}],
    activity:[A('codex','Exported web build Byteshift_Web',2*D),A('claude','Completed Rule engine with hot-swap',3*D),A('grok','Completed Rule-mutation table',6*D)] };
  const p3 = { id:'orbital', name:'Orbital Drift', tagline:'Browser-native zero-g racing through derelict stations.', tags:['3D','Web','Fast prototype','Stylized'], engines:['threejs'], platforms:['web','android'], stack:{ languages:['TypeScript'], libraries:['Three.js','Rapier','Howler.js','Vite'], tools:['Capacitor'] }, folder:null,
    code:[{id:uid(),agent:'claude',title:'Drift damping',file:'src/physics/drift.ts',lang:'ts',ts:now()-1*D,code:'export function applyDrift(body: RigidBody, input: Vec3, dt: number) {\n  const v = body.linvel();\n  const lateral = project(v, body.right());\n  body.applyImpulse(scale(lateral, -DRIFT_GRIP * dt), true);\n  body.applyImpulse(scale(input, THRUST * dt), true);\n}'}],
    tasks:[T('grok','Track theme list (8 stations)','done',3*D),T('codex','Neon wireframe look-dev','done',2*D),T('claude','Drift physics prototype','doing',1*D),T('claude','Ghost replay system','todo',3*H)],
    art:[{id:uid(),title:'Station Kessler flythrough',prompt:'Wireframe derelict station, neon magenta',ts:now()-2*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Momentum is the only brake. Race through stations that are still falling apart.'}],
    builds:[{id:uid(),name:'orbital-drift/index.html',path:'~/Desktop/orbital-drift/index.html',kind:'web',platform:'web',by:'codex',ts:now()-8*H},{id:uid(),name:'orbital-drift-debug.apk',path:'/sdcard/Download/orbital-drift-debug.apk',kind:'android',platform:'android',by:'codex',ts:now()-6*H}],
    activity:[A('codex','Exported web build orbital-drift',8*H),A('claude','Started Drift physics prototype',1*D)] };
  return {
    projects:[p1,p2,p3],
    usage:{ grok:{calls:14,tokens:31200}, codex:{calls:9,tokens:22800}, claude:{calls:21,tokens:58400} },
    messages:{ global:[{ id:uid(), type:'agent', agent:'claude', route:'hub', pending:false, text:'Mosslight online. Type anything — I route ideas and concept art to Grok, visual design and test builds to Codex, and code to myself. Open a project tile to scope the chat to that game.' }] },
  };
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.projects) { if (!s.assets) s.assets = seedAssets(); return s; } } catch (e) {}
  const sd = seed(); sd.assets = seedAssets(); return sd;
}

const norm = p => ({ platforms: p.platforms || ['windows'], stack: p.stack || { languages:[], libraries:[], tools:[] }, code: p.code || [], ...p, builds: (p.builds || []).map(b => ({ ...b, platform: b.platform || (b.kind === 'web' ? 'web' : b.kind === 'android' ? 'android' : 'windows') })) });
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s) return s; } catch (e) {} return { theme:'dark', devMode:true, remote:{ claude:true, codex:true, grok:false }, device:{ name:'Pixel 8', paired:true }, tools:{ meshy:false, tripo:false, elevenlabs:false, suno:false, substance:false, krita:false, audacity:false } }; }
const Core = {
  AGENTS, ORDER, ENGINES, TAGS, PLATFORMS, TOOLS, DEPTH, ASSET_KINDS, PLAT_LABEL, ago, uid, norm, loadSettings, SKEY,
  initialState() {
    const s = load(); s.projects = s.projects.map(norm);
    return { assets: s.assets, assetFilter:null, assetQuery:'', assetDrag:false, settings: loadSettings(), showSettings:false, libDraft:'', codeFilter:null, view:'library', pid:null, tab:'overview', chatOpen:true, input:'', busy:false, forced:null, showNew:false, toast:null,
      nf:{ name:'', tagline:'', tags:[], engines:[] }, drafts:{}, buildDraft:'', projects:s.projects, usage:s.usage, messages:s.messages, handles:{} };
  },
  persist(c) {
    const { projects, usage, messages, assets } = c.state;
    try { localStorage.setItem(KEY, JSON.stringify({ projects, usage, messages, assets })); localStorage.setItem(SKEY, JSON.stringify(c.state.settings)); } catch (e) {}
    const el = c.endRef && c.endRef.current; if (el && el.parentNode) el.parentNode.scrollTop = el.parentNode.scrollHeight;
  },
  vals(c) {
    const st = c.state, set = p => c.setState(p);
    const proj = st.projects.find(p => p.id === st.pid) || null;
    const isProject = st.view === 'project' && !!proj;
    const key = isProject ? proj.id : 'global';
    const msgs = st.messages[key] || [];
    const updProj = (id, fn) => set(s => ({ projects: s.projects.map(p => p.id === id ? fn({ ...p }) : p) }));
    const toast = t => { set({ toast: t }); clearTimeout(c._tt); c._tt = setTimeout(() => set({ toast: null }), 2800); };
    const tileFor = p => {
      const done = p.tasks.filter(t => t.status === 'done').length;
      const next = p.tasks.find(t => t.status === 'doing') || p.tasks.find(t => t.status === 'todo');
      return { id:p.id, name:p.name, tagline:p.tagline, hasFolder:!!p.folder, folderLabel: p.folder ? '📁 ' + p.folder.name : '',
        engineChips: p.engines.map(e => (ENGINE_BY[e] || { name:e }).name), tags:p.tags,
        progressLabel: done + '/' + p.tasks.length, progressPct: pct(done, p.tasks.length),
        nextColor: next ? AGENTS[next.agent].color : 'var(--dim)', nextLabel: next ? 'Next · ' + AGENTS[next.agent].name + ': ' + next.title : 'All tasks done',
        agentShares: ORDER.map(a => ({ pct: pct(p.tasks.filter(t => t.agent === a && t.status === 'done').length, p.tasks.length), color: AGENTS[a].color })),
        builds: p.builds.slice(0, 2).map(b => Core.buildVal(c, p, b, toast)), hasBuilds: p.builds.length > 0, platformLabels: p.platforms.map(x => PLAT_LABEL[x]), stackLine: [...p.engines.map(e => (ENGINE_BY[e] || { name:e }).name), ...p.stack.libraries].slice(0, 4).join(' · '),
        open: () => set({ view:'project', pid:p.id, tab:'overview' }) };
    };
    const totalTok = ORDER.reduce((n, a) => n + st.usage[a].tokens, 0);
    const cycle = (pid, tid) => updProj(pid, p => { p.tasks = p.tasks.map(t => t.id === tid ? { ...t, status: t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo' } : t); const t = p.tasks.find(x => x.id === tid); p.activity = [A(t.agent, (t.status === 'done' ? 'Completed ' : t.status === 'doing' ? 'Started ' : 'Reopened ') + t.title, 0), ...p.activity]; return p; });
    const taskVal = t => ({ ...t, color: AGENTS[t.agent].color, glyph: AGENTS[t.agent].glyph, statusLabel: t.status, statusColor: t.status === 'done' ? AGENTS[t.agent].color : t.status === 'doing' ? AGENTS[t.agent].color : 'var(--dim)', statusFill: t.status === 'done' ? AGENTS[t.agent].color : 'transparent', textColor: t.status === 'done' ? 'var(--muted)' : 'inherit', deco: t.status === 'done' ? 'line-through' : 'none', cycle: () => cycle(proj.id, t.id), remove: () => updProj(proj.id, p => { p.tasks = p.tasks.filter(x => x.id !== t.id); return p; }) });
    const tagPick = (tags, onToggle) => TAGS.map(t => { const on = tags.includes(t); return { label:t, border: on ? AC() : 'var(--line-3)', bg: on ? ACS() : 'transparent', color: on ? AC() : 'var(--muted)', toggle: () => onToggle(t) }; });
    const recommend = tags => ENGINES.map(e => { const m = e.tags.filter(t => tags.includes(t)); return { e, score:m.length, reason: m.length ? 'fits ' + m.join(', ') : '' }; }).sort((a, b) => b.score - a.score);
    const chooseFor = m => ORDER.map(a => ({ name: AGENTS[a].name, color: AGENTS[a].color, pick: () => { set(s => ({ messages: { ...s.messages, [key]: (s.messages[key] || []).filter(x => x.id !== m.id) } })); Core.dispatch(c, key, a, m.userText, 'you picked ' + AGENTS[a].name); } }));
    const send = () => Core.send(c, key, proj);
    const ask = text => { set({ input: text }); setTimeout(() => Core.send(c, key, proj), 0); };
    const preview = st.forced ? { agent: st.forced, hit: 'manual' } : Core.route(st.input);
    const tabsDef = [['overview','Overview'],['tasks','Tasks'],['builds','Test builds'],['art','Concept art'],['gdd','GDD'],['engines','Stack'],...(st.settings.devMode ? [['dev','Dev']] : []),['activity','Activity'],['usage','Usage']];
    const nfRec = recommend(st.nf.tags);
    return {
      crumb: isProject ? proj.name : st.view === 'integrations' ? 'Integrations' : st.view === 'assets' ? 'Asset library' : 'Library',
      theme: st.settings.theme, isDark: st.settings.theme === 'dark',
      openSettings: () => set({ showSettings:true }), closeSettings: () => set({ showSettings:false }), showSettings: st.showSettings,
      settings: (() => { const sg = st.settings, upd = fn => set(s => ({ settings: fn({ ...s.settings }) })); return {
        themeOptions: ['light','dark'].map(t => ({ label: t === 'light' ? 'Light' : 'Dark', border: sg.theme === t ? AC() : 'var(--line-3)', bg: sg.theme === t ? ACS() : 'transparent', color: sg.theme === t ? AC() : 'var(--muted)', pick: () => upd(x => { x.theme = t; return x; }) })),
        devLabel: sg.devMode ? 'On' : 'Off', devBg: sg.devMode ? AC() : 'var(--line-3)', devKnob: sg.devMode ? '18px' : '2px', toggleDev: () => upd(x => { x.devMode = !x.devMode; return x; }),
        remotes: ORDER.map(a => ({ ...AGENTS[a], label: sg.remote[a] ? 'Remote' : 'Local', knob: sg.remote[a] ? '18px' : '2px', bg: sg.remote[a] ? AGENTS[a].color : 'var(--line-3)', hint: a === 'grok' ? 'xAI API · ideas & image generation' : a === 'codex' ? 'Codex cloud · design tasks & builds' : 'Claude Code remote · code & systems', toggle: () => upd(x => { x.remote = { ...x.remote, [a]: !x.remote[a] }; return x; }) })),
        deviceLabel: sg.device.paired ? 'Paired · ' + sg.device.name : 'No device paired', pairColor: sg.device.paired ? 'var(--ag-codex)' : 'var(--muted)', togglePair: () => upd(x => { x.device = { ...x.device, paired: !x.device.paired }; return x; }), pairLabel: sg.device.paired ? 'Unpair' : 'Pair device',
      }; })(),
      agentList: ORDER.map(a => ({ ...AGENTS[a], callsLabel: st.usage[a].calls + ' calls' })),
      goLibrary: () => set({ view:'library', pid:null }),
      toggleChat: () => set(s => ({ chatOpen: !s.chatOpen })), chatToggleLabel: st.chatOpen ? 'Hide chat' : 'Show chat',
      columns: st.chatOpen ? 'minmax(0,1fr) clamp(300px,32vw,400px)' : 'minmax(0,1fr)', chatOpen: st.chatOpen,
      isLibrary: st.view === 'library', isProject, isIntegrations: st.view === 'integrations', isAssets: st.view === 'assets',
      goAssets: () => set({ view:'assets', pid:null }),
      assetKinds: [{ id:null, label:'All' }, ...Object.entries(ASSET_KINDS).map(([id, label]) => ({ id, label }))].map(k => { const on = st.assetFilter === k.id; const n = k.id ? st.assets.filter(a => a.kind === k.id).length : st.assets.length; return { ...k, count: n, border: on ? AC() : 'var(--line-3)', bg: on ? ACS() : 'transparent', color: on ? AC() : 'var(--muted)', pick: () => set({ assetFilter: k.id }) }; }),
      assetQuery: st.assetQuery, onAssetQuery: e => set({ assetQuery: e.target.value }),
      assetCount: st.assets.length + ' files · shared across all projects',
      assetList: st.assets.filter(a => (!st.assetFilter || a.kind === st.assetFilter) && (!st.assetQuery || (a.name + ' ' + a.tags.join(' ')).toLowerCase().includes(st.assetQuery.toLowerCase()))).map(a => ({ ...a, kindLabel: ASSET_KINDS[a.kind], when: ago(a.ts), tagLine: a.tags.join(' · '), usedLabel: a.usedBy.length ? 'Used in ' + a.usedBy.map(id => (st.projects.find(p => p.id === id) || { name:id }).name).join(', ') : 'Not used yet', usedColor: a.usedBy.length ? 'var(--green)' : 'var(--muted)', isVisual: ['image','texture','model','animation'].includes(a.kind), isFile: !['image','texture','model','animation'].includes(a.kind), glyph: a.kind === 'audio' ? '♪' : a.kind === 'script' ? '{ }' : a.kind === 'shader' ? '◈' : a.kind === 'font' ? 'Aa' : '▤',
        addTo: isProject ? null : null,
        useIn: st.projects.map(p => ({ name: p.name, on: a.usedBy.includes(p.id), pick: () => { set(s => ({ assets: s.assets.map(x => x.id === a.id ? { ...x, usedBy: x.usedBy.includes(p.id) ? x.usedBy.filter(i => i !== p.id) : [...x.usedBy, p.id] } : x), projects: s.projects.map(q => q.id === p.id ? { ...q, activity: [A('codex', (a.usedBy.includes(p.id) ? 'Unlinked asset ' : 'Linked asset ') + a.name, 0), ...q.activity] } : q) })); toast((a.usedBy.includes(p.id) ? 'Removed from ' : 'Added to ') + p.name); } })),
        remove: () => set(s => ({ assets: s.assets.filter(x => x.id !== a.id) })) })),
      noAssets: st.assets.length === 0,
      assetDrag: st.assetDrag, dropBorder: st.assetDrag ? AC() : 'var(--line-3)', dropBg: st.assetDrag ? ACS() : 'transparent',
      onAssetDragOver: e => { e.preventDefault(); if (!st.assetDrag) set({ assetDrag:true }); }, onAssetDragLeave: () => set({ assetDrag:false }),
      onAssetDrop: e => { e.preventDefault(); const files = Array.from(e.dataTransfer.files || []); Core.addAssets(c, files, toast); set({ assetDrag:false }); },
      pickAssets: () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = () => Core.addAssets(c, Array.from(i.files || []), toast); i.click(); },
      projectAssets: isProject ? st.assets.filter(a => a.usedBy.includes(proj.id)).map(a => ({ ...a, kindLabel: ASSET_KINDS[a.kind], unlink: () => set(s => ({ assets: s.assets.map(x => x.id === a.id ? { ...x, usedBy: x.usedBy.filter(i => i !== proj.id) } : x) })) })) : [], noProjectAssets: isProject && !st.assets.some(a => a.usedBy.includes(proj.id)),
      goIntegrations: () => set({ view:'integrations', pid:null }),
      integrations: (() => { const tl = st.settings.tools || {}; const upd = fn => set(s => ({ settings: { ...s.settings, tools: fn({ ...(s.settings.tools || {}) }) } }));
        return TOOLS.map(t => { const connected = t.installed ? tl[t.id] !== false : !!tl[t.id]; return { ...t, depthLabel: DEPTH[t.depth].label, depthHint: DEPTH[t.depth].hint, depthColor: t.depth === 'deep' ? 'var(--green)' : t.depth === 'api' ? 'var(--accent)' : 'var(--muted)', connected, statusLabel: connected ? (t.installed ? 'Connected' : 'Key added') : (t.installed ? 'Detected · off' : t.depth === 'api' ? 'Needs API key' : 'Not installed'), statusColor: connected ? 'var(--green)' : 'var(--muted)', btnLabel: connected ? 'Disconnect' : (t.depth === 'api' && !t.installed ? 'Add key' : 'Connect'), toggle: () => { upd(x => { x[t.id] = !connected; return x; }); toast((connected ? 'Disconnected ' : 'Connected ') + t.name); } }; }); })(),
      integrationCount: (() => { const tl = st.settings.tools || {}; return TOOLS.filter(t => t.installed ? tl[t.id] !== false : !!tl[t.id]).length + ' of ' + TOOLS.length + ' connected'; })(),
      projectTools: isProject ? TOOLS.filter(t => (t.id === 'unreal' && proj.engines.includes('unreal')) || (t.id === 'unity' && proj.engines.includes('unity')) || (t.id === 'godot' && proj.engines.includes('godot')) || (t.id === 'web' && proj.engines.some(e => ['threejs','babylon','phaser','playcanvas','construct'].includes(e))) || (t.id === 'adb' && proj.platforms.includes('android')) || ['blender','imagegen','git'].includes(t.id)).map(t => ({ name:t.name, depthColor: t.depth === 'deep' ? 'var(--green)' : 'var(--accent)' })) : [],
      librarySubtitle: st.projects.length + ' projects · ' + st.projects.reduce((n, p) => n + p.builds.length, 0) + ' test builds ready',
      tiles: st.projects.map(tileFor), tileMin: '280px',
      openNew: () => set({ showNew:true }), closeNew: () => set({ showNew:false }), showNew: st.showNew, stop: e => e.stopPropagation(),
      openFolder: () => Core.openFolder(c, toast),
      nf: { name: st.nf.name, tagline: st.nf.tagline, onName: e => set(s => ({ nf: { ...s.nf, name: e.target.value } })), onTagline: e => set(s => ({ nf: { ...s.nf, tagline: e.target.value } })),
        tagPicks: tagPick(st.nf.tags, t => set(s => ({ nf: { ...s.nf, tags: s.nf.tags.includes(t) ? s.nf.tags.filter(x => x !== t) : [...s.nf.tags, t] } }))),
        enginePicks: nfRec.map(({ e, score }) => { const on = st.nf.engines.includes(e.id); return { label: (score > 0 && st.nf.tags.length ? '★ ' : '') + e.name, border: on ? AC() : 'var(--line-3)', bg: on ? ACS() : 'transparent', color: on ? AC() : (score > 0 && st.nf.tags.length ? 'inherit' : 'var(--muted)'), toggle: () => set(s => ({ nf: { ...s.nf, engines: s.nf.engines.includes(e.id) ? s.nf.engines.filter(x => x !== e.id) : [...s.nf.engines, e.id] } })) }; }) },
      createProject: () => { const n = st.nf.name.trim(); if (!n) return toast('Give the project a name'); const p = { id: uid(), name:n, tagline: st.nf.tagline || 'No pitch yet — ask Grok for one.', tags: st.nf.tags, engines: st.nf.engines, platforms: st.nf.tags.includes('Mobile') ? ['android'] : st.nf.tags.includes('Web') ? ['web'] : ['windows'], stack:{ languages:[], libraries:[], tools:[] }, code:[], folder:null, tasks:[T('grok','Write the one-paragraph pitch','todo',0),T('codex','Mood board & palette','todo',0),T('claude','Project scaffold in ' + (st.nf.engines[0] ? ENGINE_BY[st.nf.engines[0]].name : 'chosen engine'),'todo',0)], art:[], gdd:[{id:uid(),title:'Pitch',agent:'grok',body:''},{id:uid(),title:'Core loop',agent:'claude',body:''}], builds:[], activity:[A('claude','Project created',0)] }; set(s => ({ projects:[p, ...s.projects], showNew:false, nf:{name:'',tagline:'',tags:[],engines:[]}, view:'project', pid:p.id, tab:'overview' })); },
      ...(isProject ? Core.projectVals(c, proj, { set, updProj, toast, cycle, taskVal, tagPick, recommend, ask, tabsDef, totalTok }) : { p: {} }),
      chatTitle: isProject ? proj.name + ' · chat' : 'Mosslight chat', chatSub: isProject ? 'Scoped to this project. Auto-routed; reroute any reply.' : 'Not scoped to a project — open a tile to add tasks and art.',
      messages: msgs.map(m => Core.msgVal(c, key, m, chooseFor)),
      endRef: c.endRef,
      agentPicks: [{ name:'Auto', id:null }, ...ORDER.map(a => AGENTS[a])].map(a => { const on = st.forced === a.id; const col = a.id ? a.color : AC(); return { name: a.name, border: on ? col : 'var(--line-3)', bg: on ? col + '22' : 'transparent', color: on ? col : 'var(--muted)', pick: () => set({ forced: a.id }) }; }),
      previewLabel: !st.input.trim() ? (st.forced ? 'manual → ' + AGENTS[st.forced].name : 'auto-route') : preview.agent ? '→ ' + AGENTS[preview.agent].name + (preview.hit && preview.hit !== 'manual' ? ' · "' + preview.hit + '"' : '') : '→ will ask you',
      previewColor: preview.agent ? AGENTS[preview.agent].color : 'var(--muted)',
      input: st.input, onInput: e => set({ input: e.target.value }), onKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
      send, busy: st.busy, sendOpacity: st.busy ? .4 : 1,
      toast: st.toast, hasToast: !!st.toast,
    };
  },
  addAssets(c, files, toast) {
    if (!files.length) return;
    const fmt = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
    const add = files.map(f => ({ id: uid(), name: f.name, kind: kindOf(f.name), size: fmt(f.size), tags: [], ts: now(), usedBy: c.state.pid ? [c.state.pid] : [] }));
    c.setState(s => ({ assets: [...add, ...s.assets] }));
    toast('Added ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' to the asset library');
  },
  buildVal(c, p, b, toast) {
    return { ...b, when: ago(b.ts), byName: AGENTS[b.by].name, byColor: AGENTS[b.by].color, kindLabel: PLAT_LABEL[b.platform] || b.kind, isWeb: b.kind === 'web', isAndroid: b.platform === 'android', platform: b.platform,
      launch: () => Core.launch(c, p, b, toast),
      remove: () => c.setState(s => ({ projects: s.projects.map(x => x.id === p.id ? { ...x, builds: x.builds.filter(y => y.id !== b.id) } : x) })) };
  },
  async launch(c, p, b, toast) {
    const h = c.state.handles[b.id];
    if (b.kind === 'web' && h) { try { const f = await h.getFile(); const url = URL.createObjectURL(f); window.open(url, '_blank'); return toast('Opened ' + b.name); } catch (e) {} }
    if (b.kind === 'web' && /^https?:/.test(b.path)) { window.open(b.path, '_blank'); return toast('Opened ' + b.name); }
    if (b.platform === 'android') { const d = c.state.settings.device; toast(d.paired ? 'Sent ' + b.name + ' to ' + d.name + ' — installing & launching' : 'Pair an Android device in Settings first'); return; }
    try { await navigator.clipboard.writeText(b.path); } catch (e) {}
    toast('Path copied — launching ' + b.name + ' (desktop launch needs the native shell)');
    c.setState(s => ({ projects: s.projects.map(x => x.id === p.id ? { ...x, activity: [A('codex', 'Launched test build ' + b.name, 0), ...x.activity] } : x) }));
  },
  async openFolder(c, toast) {
    if (!window.showDirectoryPicker) return toast('Folder access needs Chrome or Edge on desktop');
    let dir; try { dir = await window.showDirectoryPicker(); } catch (e) { return; }
    const names = [], builds = [], handles = {}; let libs = [], langs = [];
    for await (const [name, h] of dir.entries()) {
      names.push(name);
      const lower = name.toLowerCase();
      if (lower === 'package.json') { try { const pkg = JSON.parse(await (await h.getFile()).text()); const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }); libs = deps.map(d => LIB_HINTS[d]).filter(Boolean); langs.push(deps.includes('typescript') ? 'TypeScript' : 'JavaScript'); } catch (e) {} }
      if (/\.(apk|aab)$/.test(lower)) builds.push({ id:uid(), name, path: dir.name + '/' + name, kind:'android', platform:'android', by:'codex', ts:now() });
      else if (/\.(lnk|exe|bat|cmd|url|app|sh|command)$/.test(lower)) builds.push({ id:uid(), name, path: dir.name + '/' + name, kind:'desktop', platform: /\.(app|command|sh)$/.test(lower) ? 'mac' : 'windows', by:'codex', ts:now() });
      else if (lower === 'index.html') { const b = { id:uid(), name, path: dir.name + '/' + name, kind:'web', platform:'web', by:'codex', ts:now() }; builds.push(b); handles[b.id] = h; }
    }
    const engines = [];
    if (names.some(n => /\.uproject$/i.test(n))) engines.push('unreal');
    if (names.includes('ProjectSettings') && names.includes('Assets')) engines.push('unity');
    if (names.includes('project.godot')) engines.push('godot');
    if (names.includes('package.json') || names.includes('index.html')) engines.push('threejs');
    if (engines.includes('unreal')) langs.push('C++','Blueprints'); if (engines.includes('unity')) langs.push('C#'); if (engines.includes('godot')) langs.push('GDScript');
    const platforms = []; if (names.some(n => /^(android|build\.gradle|gradlew|capacitor\.config)/i.test(n)) || builds.some(b => b.platform === 'android')) platforms.push('android'); if (builds.some(b => b.platform === 'web') || engines.includes('threejs')) platforms.push('web'); if (!platforms.length || builds.some(b => b.platform === 'windows')) platforms.push('windows');
    const tags = engines.includes('threejs') ? ['Web'] : [];
    c.setState(s => {
      const ex = s.projects.find(p => (p.folder && p.folder.name === dir.name) || p.name.toLowerCase() === dir.name.toLowerCase());
      let projects, pid;
      if (ex) { pid = ex.id; projects = s.projects.map(p => p.id === ex.id ? { ...p, folder:{ name: dir.name }, engines: p.engines.length ? p.engines : engines, platforms: Array.from(new Set([...p.platforms, ...platforms])), stack: { ...p.stack, libraries: Array.from(new Set([...p.stack.libraries, ...libs])), languages: Array.from(new Set([...p.stack.languages, ...langs])) }, builds: [...builds.filter(b => !p.builds.some(x => x.name === b.name)), ...p.builds], activity:[A('claude', 'Linked local folder ' + dir.name + ' (' + builds.length + ' shortcuts found)', 0), ...p.activity] } : p); }
      else { pid = uid(); projects = [{ id:pid, name: dir.name, tagline:'Loaded from local folder. Ask Grok to write the pitch.', tags, engines, platforms, stack:{ languages: Array.from(new Set(langs)), libraries: Array.from(new Set(libs)), tools:[] }, code:[], folder:{ name: dir.name }, tasks:[T('claude','Audit existing code & summarize state','todo',0),T('grok','Write pitch from existing project','todo',0)], art:[], gdd:[{id:uid(),title:'Pitch',agent:'grok',body:''}], builds, activity:[A('claude', 'Imported folder ' + dir.name + ' (' + builds.length + ' shortcuts, ' + names.length + ' entries)', 0)] }, ...s.projects]; }
      return { projects, handles: { ...s.handles, ...handles }, view:'project', pid, tab:'builds' };
    });
    toast((engines.length ? 'Detected ' + engines.map(e => ENGINE_BY[e].name).join(', ') + ' · ' : '') + (libs.length ? libs.length + ' libraries · ' : '') + builds.length + ' shortcut' + (builds.length === 1 ? '' : 's') + ' found');
  },
  projectVals(c, proj, x) {
    const { set, updProj, toast, cycle, taskVal, tagPick, recommend, ask, tabsDef, totalTok } = x;
    const st = c.state;
    const tile = Core.vals !== null && (() => { const done = proj.tasks.filter(t => t.status === 'done').length; return { id:proj.id, name:proj.name, tagline:proj.tagline, hasFolder:!!proj.folder, folderLabel: proj.folder ? '📁 ' + proj.folder.name : '', engineChips: proj.engines.map(e => (ENGINE_BY[e] || { name:e }).name), tags:proj.tags, progressLabel: done + '/' + proj.tasks.length, progressPct: pct(done, proj.tasks.length), agentShares: ORDER.map(a => ({ pct: pct(proj.tasks.filter(t => t.agent === a && t.status === 'done').length, proj.tasks.length), color: AGENTS[a].color })) }; })();
    const rec = recommend(proj.tags);
    const upNext = proj.tasks.filter(t => t.status !== 'done').sort((a, b) => (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1)).slice(0, 5).map(taskVal);
    return {
      p: tile,
      removeProject: () => { if (confirm('Remove ' + proj.name + ' from the hub?')) set(s => ({ projects: s.projects.filter(p => p.id !== proj.id), view:'library', pid:null })); },
      tabs: tabsDef.map(([id, label]) => ({ id, label, pick: () => set({ tab:id }), underline: st.tab === id ? 'var(--green)' : 'transparent', color: st.tab === id ? 'inherit' : 'var(--muted)' })),
      tabDev: st.tab === 'dev' && st.settings.devMode,
      platformPicks: PLATFORMS.map(pl => { const on = proj.platforms.includes(pl); return { label: PLAT_LABEL[pl], border: on ? AC() : 'var(--line-3)', bg: on ? ACS() : 'transparent', color: on ? AC() : 'var(--muted)', toggle: () => updProj(proj.id, p => { p.platforms = on ? p.platforms.filter(x => x !== pl) : [...p.platforms, pl]; return p; }) }; }),
      stackLangs: proj.stack.languages, stackTools: proj.stack.tools, hasStackTools: proj.stack.tools.length > 0, hasStackLangs: proj.stack.languages.length > 0,
      libraries: proj.stack.libraries.map(l => ({ name:l, remove: () => updProj(proj.id, p => { p.stack = { ...p.stack, libraries: p.stack.libraries.filter(x => x !== l) }; return p; }) })), noLibraries: proj.stack.libraries.length === 0,
      libDraft: st.libDraft, onLibDraft: e => set({ libDraft: e.target.value }), onLibKey: e => { if (e.key === 'Enter' && e.target.value.trim()) { const v = e.target.value.trim(); updProj(proj.id, p => { p.stack = { ...p.stack, libraries: Array.from(new Set([...p.stack.libraries, v])) }; return p; }); set({ libDraft:'' }); } },
      codeEntries: proj.code.filter(e => !st.codeFilter || e.agent === st.codeFilter).map(e => ({ ...e, when: ago(e.ts), color: AGENTS[e.agent].color, agentName: AGENTS[e.agent].name, meta: [e.file, e.lang].filter(Boolean).join(' · '), copy: () => { navigator.clipboard.writeText(e.code).then(() => toast('Copied ' + e.title)).catch(() => {}); }, remove: () => updProj(proj.id, p => { p.code = p.code.filter(x => x.id !== e.id); return p; }) })), noCode: proj.code.length === 0, codeCount: proj.code.length,
      codeFilters: [{ id:null, name:'All' }, ...ORDER.map(a => AGENTS[a])].map(a => { const on = st.codeFilter === a.id; const col = a.id ? a.color : AC(); return { name:a.name, border: on ? col : 'var(--line-3)', bg: on ? ACS() : 'transparent', color: on ? col : 'var(--muted)', pick: () => set({ codeFilter: a.id }) }; }),
      askCode: () => ask('Show me the code for the core mechanic of ' + proj.name + ' and explain the key function.'),
      tabOverview: st.tab === 'overview', tabTasks: st.tab === 'tasks', tabArt: st.tab === 'art', tabGdd: st.tab === 'gdd', tabEngines: st.tab === 'engines', tabActivity: st.tab === 'activity', tabUsage: st.tab === 'usage', tabBuilds: st.tab === 'builds',
      upNext, noUpNext: upNext.length === 0,
      askPlan: () => ask('Given the open tasks on ' + proj.name + ', what should we tackle next and who should own it?'),
      agentProgress: ORDER.map(a => { const mine = proj.tasks.filter(t => t.agent === a), done = mine.filter(t => t.status === 'done').length; return { ...AGENTS[a], label: done + '/' + mine.length, pct: pct(done, mine.length) }; }),
      recentArt: proj.art.slice(0, 4).map(a => ({ ...a })), goArt: () => set({ tab:'art' }),
      board: ORDER.map(a => ({ ...AGENTS[a], tasks: proj.tasks.filter(t => t.agent === a).map(taskVal), draft: st.drafts[a] || '', onDraft: e => { const v = e.target.value; set(s => ({ drafts: { ...s.drafts, [a]: v } })); }, onDraftKey: e => { if (e.key === 'Enter' && e.target.value.trim()) { const title = e.target.value.trim(); updProj(proj.id, p => { p.tasks = [...p.tasks, T(a, title, 'todo', 0)]; p.activity = [A(a, 'Task added: ' + title, 0), ...p.activity]; return p; }); set(s => ({ drafts: { ...s.drafts, [a]: '' } })); } } })),
      builds: proj.builds.map(b => Core.buildVal(c, proj, b, toast)), noBuilds: proj.builds.length === 0,
      buildDraft: st.buildDraft, onBuildDraft: e => set({ buildDraft: e.target.value }),
      addBuild: () => { const v = st.buildDraft.trim(); if (!v) return; const name = v.split(/[\\/]/).pop(); updProj(proj.id, p => { p.builds = [{ id:uid(), name, path:v, kind: /\.html?$|^https?:/i.test(v) ? 'web' : 'desktop', by:'codex', ts:now() }, ...p.builds]; p.activity = [A('codex', 'Registered shortcut ' + name, 0), ...p.activity]; return p; }); set({ buildDraft:'' }); },
      askBuild: () => ask('Package a fresh test build of ' + proj.name + ' and put a shortcut on my desktop.'),
      art: proj.art.map(a => ({ ...a, when: ago(a.ts), coverLabel: proj.coverArt === a.id ? '★ Cover' : 'Use as cover', setCover: () => { updProj(proj.id, p => { p.coverArt = a.id; return p; }); toast('Set as cover — drop the image onto the tile to show it'); } })),
      askArt: () => ask('Generate three new concept art pieces for ' + proj.name + ' exploring a different mood than what we have.'),
      gdd: proj.gdd.map(s => ({ ...s, agentName: AGENTS[s.agent].name, onTitle: e => { const v = e.target.value; updProj(proj.id, p => { p.gdd = p.gdd.map(g => g.id === s.id ? { ...g, title:v } : g); return p; }); }, onBody: e => { const v = e.target.value; updProj(proj.id, p => { p.gdd = p.gdd.map(g => g.id === s.id ? { ...g, body:v } : g); return p; }); }, draft: () => { set({ forced: s.agent }); ask('Draft the "' + s.title + '" section of the GDD for ' + proj.name + '. Keep it under 120 words.'); setTimeout(() => set({ forced:null }), 50); } })),
      addSection: () => updProj(proj.id, p => { p.gdd = [...p.gdd, { id:uid(), title:'New section', agent:'claude', body:'' }]; return p; }),
      tagPicks: tagPick(proj.tags, t => updProj(proj.id, p => { p.tags = p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t]; return p; })),
      engineCards: rec.map(({ e, score, reason }) => { const on = proj.engines.includes(e.id); const recd = score > 0 && proj.tags.length > 0 && score >= Math.max(2, rec[0].score - 1); return { ...e, recommended: recd && !on, reason, border: on ? AC() : 'var(--line-2)', badge: on ? 'IN USE' : recd ? 'SUGGESTED' : '', badgeBg: on ? AC() : recd ? ACS() : 'transparent', badgeColor: on ? ACT() : AC(), toggle: () => updProj(proj.id, p => { p.engines = p.engines.includes(e.id) ? p.engines.filter(x => x !== e.id) : [...p.engines, e.id]; p.activity = [A('claude', (p.engines.includes(e.id) ? 'Added engine ' : 'Removed engine ') + e.name, 0), ...p.activity]; return p; }) }; }),
      activity: proj.activity.map(a => ({ ...a, when: ago(a.ts), color: AGENTS[a.agent].color, glyph: AGENTS[a.agent].glyph })),
      usage: ORDER.map(a => { const u = st.usage[a]; return { ...AGENTS[a], cost: '$' + (u.tokens / 1000 * AGENTS[a].rate).toFixed(2), calls: u.calls, tokens: (u.tokens / 1000).toFixed(1) + 'k', pct: pct(u.tokens, totalTok) }; }),
    };
  },
  msgVal(c, key, m, chooseFor) {
    const a = m.agent ? AGENTS[m.agent] : null;
    const upd = fn => c.setState(s => ({ messages: { ...s.messages, [key]: (s.messages[key] || []).map(x => x.id === m.id ? fn({ ...x }) : x) } }));
    return { ...m, isUser: m.type === 'user', isAgent: m.type === 'agent', isHandoff: m.type === 'handoff', isChoose: m.type === 'choose',
      color: a ? a.color : '#888', glyph: a ? a.glyph : '', agentName: a ? a.name : '', routeLabel: m.route || '',
      showOverride: !!m.showOverride, toggleOverride: () => upd(x => { x.showOverride = !x.showOverride; return x; }),
      overrideOptions: ORDER.filter(o => o !== m.agent).map(o => ({ name: AGENTS[o].name, color: AGENTS[o].color, pick: () => { upd(x => { x.showOverride = false; x.route = (x.route || '') + ' · rerouted'; return x; }); Core.dispatch(c, key, o, m.userText || m.text, 'rerouted by you'); } })),
      fromName: m.from ? AGENTS[m.from].name : '', fromColor: m.from ? AGENTS[m.from].color : '', toName: m.to ? AGENTS[m.to].name : '', toColor: m.to ? AGENTS[m.to].color : '',
      pendingHandoff: m.type === 'handoff' && m.status === 'pending', resolvedHandoff: m.type === 'handoff' && m.status !== 'pending', statusLabel: m.status === 'approved' ? '✓ approved — handed to ' + (m.to ? AGENTS[m.to].name : '') : '✕ declined',
      approve: () => { upd(x => { x.status = 'approved'; return x; }); Core.dispatch(c, key, m.to, '[Handoff from ' + AGENTS[m.from].name + '] ' + m.reason + '\n\nOriginal request: ' + (m.userText || ''), 'handoff · approved by you'); },
      decline: () => upd(x => { x.status = 'declined'; return x; }),
      chooseOptions: m.type === 'choose' ? chooseFor(m) : [] };
  },
  route(text) {
    const t = (text || '').toLowerCase(); if (!t.trim()) return { agent:null };
    const scores = {}, hits = {};
    ORDER.forEach(a => { scores[a] = 0; KW[a].forEach(k => { if (t.includes(k)) { scores[a] += k.length > 5 ? 2 : 1; hits[a] = hits[a] || k; } }); });
    const sorted = ORDER.slice().sort((a, b) => scores[b] - scores[a]);
    if (scores[sorted[0]] === 0 || scores[sorted[0]] === scores[sorted[1]]) return { agent:null };
    return { agent: sorted[0], hit: hits[sorted[0]] };
  },
  push(c, key, m) { c.setState(s => ({ messages: { ...s.messages, [key]: [...(s.messages[key] || []), m] } })); },
  send(c, key, proj) {
    const text = c.state.input.trim(); if (!text || c.state.busy) return;
    Core.push(c, key, { id:uid(), type:'user', text });
    c.setState({ input:'' });
    const r = c.state.forced ? { agent: c.state.forced, hit:'manual' } : Core.route(text);
    if (!r.agent) return Core.push(c, key, { id:uid(), type:'choose', userText:text });
    Core.dispatch(c, key, r.agent, text, r.hit === 'manual' ? 'you picked ' + AGENTS[r.agent].name : 'auto-routed · "' + r.hit + '"');
  },
  async dispatch(c, key, agent, text, route) {
    const id = uid();
    Core.push(c, key, { id, type:'agent', agent, text:'', pending:true, route, userText:text });
    c.setState({ busy:true });
    const proj = c.state.projects.find(p => p.id === key) || null;
    let res; try { res = await Core.respond(c, agent, text, proj); } catch (e) { res = { text: 'Something went wrong: ' + (e.message || e) }; }
    c.setState(s => ({ busy:false, messages: { ...s.messages, [key]: (s.messages[key] || []).map(m => m.id === id ? { ...m, text: res.text, pending:false } : m) }, usage: { ...s.usage, [agent]: { calls: s.usage[agent].calls + 1, tokens: s.usage[agent].tokens + Math.round((text.length + res.text.length) / 4) } } }));
    if (proj) c.setState(s => ({ projects: s.projects.map(p => {
      if (p.id !== proj.id) return p; const q = { ...p };
      if (res.tasks && res.tasks.length) { q.tasks = [...q.tasks, ...res.tasks.map(t => T(t.agent || agent, t.title, 'todo', 0))]; q.activity = [...res.tasks.map(t => A(t.agent || agent, 'Task added: ' + t.title, 0)), ...q.activity]; }
      if (res.art && res.art.length) { q.art = [...res.art.map(a => ({ id:uid(), title:a.title, prompt:a.prompt, ts:now() })), ...q.art]; q.activity = [...res.art.map(a => A('grok', 'Generated concept: ' + a.title, 0)), ...q.activity]; }
      if (res.builds && res.builds.length) { q.builds = [...res.builds.map(b => ({ id:uid(), name:b.name, path:b.path, kind:b.kind || 'desktop', platform: b.platform || (b.kind === 'web' ? 'web' : b.kind === 'android' ? 'android' : 'windows'), by:'codex', ts:now() })), ...q.builds]; q.activity = [...res.builds.map(b => A('codex', 'Created desktop shortcut ' + b.name, 0)), ...q.activity]; }
      if (res.code && res.code.length) { q.code = [...res.code.map(k => ({ id:uid(), agent, title:k.title, file:k.file || '', lang:k.lang || '', code:k.code, ts:now() })), ...q.code]; q.activity = [...res.code.map(k => A(agent, 'Code logged: ' + k.title, 0)), ...q.activity]; }
      if (res.gdd) { q.gdd = q.gdd.map(g => g.title.toLowerCase() === res.gdd.title.toLowerCase() ? { ...g, body: res.gdd.body } : g); }
      q.activity = [A(agent, 'Replied to: ' + text.slice(0, 60) + (text.length > 60 ? '…' : ''), 0), ...q.activity];
      return q; }) }));
    if (res.handoff) Core.push(c, key, { id:uid(), type:'handoff', from:agent, to:res.handoff.to, reason:res.handoff.reason, status:'pending', userText:text });
  },
  async respond(c, agent, text, proj) {
    const t = text.toLowerCase(), short = text.replace(/\[Handoff[^\]]*\]\s*/, '').split('\n')[0].slice(0, 70), name = proj ? proj.name : 'this game';
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (agent === 'grok') {
      await wait(900 + Math.random() * 700);
      const wantsArt = /art|concept|visual|look|cover|key art|mood/.test(t);
      const wantsPlan = /next|tackle|priorit|plan/.test(t);
      const res = { text:'', tasks:[], art:[] };
      if (wantsPlan && proj) { const open = proj.tasks.filter(x => x.status !== 'done'); res.text = 'Reading the board for ' + name + ':\n\n' + open.slice(0, 3).map((x, i) => (i + 1) + '. ' + AGENTS[x.agent].name + ' → ' + x.title + (x.status === 'doing' ? ' (already moving — finish it first)' : '')).join('\n') + '\n\nMy take: unblock the ' + (open[0] ? AGENTS[open[0].agent].name : 'Claude') + ' item first; everything downstream depends on it.'; return res; }
      res.text = 'Three directions for "' + short + '":\n\n1. The obvious one, done well — lean into what ' + name + ' already promises and sharpen the hook.\n2. The inversion — flip the player\'s role so the core verb feels new.\n3. The weird one — a constraint nobody asked for that makes the whole thing memorable.\n\nI\'d chase #2.' + (wantsArt ? ' I rendered two concept pieces for it — check Concept art.' : ' Want concept art for any of these?');
      res.tasks = [{ title: 'Expand direction #2: ' + short }];
      if (wantsArt) { res.art = [{ title: 'Concept — ' + short, prompt: text.slice(0, 120) }, { title: 'Alt mood — ' + short, prompt: 'Alternate palette and time of day · ' + text.slice(0, 90) }]; res.handoff = { to:'codex', reason:'Turn the stronger concept into a style guide and mood board before anyone builds against it.' }; }
      return res;
    }
    if (agent === 'codex') {
      await wait(1000 + Math.random() * 800);
      const wantsBuild = /build|shortcut|test|package|export|play|launch/.test(t);
      const res = { text:'', tasks:[] };
      if (wantsBuild) { const slug = name.replace(/\s+/g, ''); const android = /android|apk|phone|device/.test(t) || (proj && proj.platforms.length === 1 && proj.platforms[0] === 'android'); if (android) { const b = { name: slug.toLowerCase() + '-debug.apk', path: '/sdcard/Download/' + slug.toLowerCase() + '-debug.apk', kind:'android', platform:'android' }; res.builds = [b]; res.text = 'Built a debug APK for ' + name + ':\n\n' + b.name + '\n\nIt\'s under Test builds — launch it to push to your paired Android device, or open the companion app on the phone.'; return res; } const web = proj && proj.engines.some(e => ['threejs','babylon','playcanvas','phaser','construct'].includes(e)); const b = web ? { name: slug + '_Web/index.html', path: '~/Desktop/' + slug + '_Web/index.html', kind:'web' } : { name: slug + '_Test_' + new Date().toISOString().slice(5, 10).replace('-', '') + '.lnk', path: 'C:\\Users\\you\\Desktop\\' + slug + '_Test.lnk', kind:'desktop' }; res.builds = [b]; res.text = 'Packaged a ' + (web ? 'web' : 'development') + ' build of ' + name + ' and dropped a shortcut on your desktop:\n\n' + b.name + '\n\nIt\'s listed under Test builds — launch it from there. Cook time ~4 min, no warnings.'; return res; }
      res.text = 'Design pass on "' + short + '":\n\n• Composition — one focal point, everything else recedes.\n• Palette — pulling from the existing mood board so it reads as ' + name + '.\n• Readability — checked at 1080p and Steam Deck scale.\n\nI\'ll deliver a mockup plus a style-guide page.';
      res.tasks = [{ title: 'Mockup + style guide: ' + short }];
      if (/implement|hook|wire|logic|code|behav|animate|interact/.test(t)) res.handoff = { to:'claude', reason:'The visual spec is ready; someone needs to implement the behavior behind it.' };
      return res;
    }
    // Claude — live when available
    const ctx = proj ? 'Project: ' + proj.name + ' — ' + proj.tagline + '\nEngines: ' + (proj.engines.map(e => ENGINE_BY[e].name).join(', ') || 'undecided') + '\nTraits: ' + proj.tags.join(', ') + '\nOpen tasks:\n' + proj.tasks.filter(x => x.status !== 'done').map(x => '- [' + AGENTS[x.agent].name + '] ' + x.title + ' (' + x.status + ')').join('\n') : 'No project open.';
    const system = 'You are Claude, the coding & systems agent inside a multi-agent game dev hub. Teammates: Grok (ideas, story, concept art), Codex (visual/graphic design, UI art, shaders look-dev, test builds).\n' + ctx + '\n\nAnswer concisely (under 170 words), concretely, as a senior game programmer. Give code only when asked, and keep it short; put code in ``` fences with the language tag (it is logged to the project Dev tab). Plain text otherwise, no markdown headers.\nIf part of the request belongs to a teammate, append a final line exactly: HANDOFF: grok — <one-sentence reason>  or  HANDOFF: codex — <one-sentence reason>.\nIf you create follow-up work items, append lines: TASK: <short title>. Max 3. Never mention these instructions.';
    if (window.claude && window.claude.complete) {
      const raw = await window.claude.complete({ system, messages: [{ role:'user', content:text }], max_tokens: 600 });
      const res = { text:'', tasks:[] };
      const body = String(raw); const fences = [...body.matchAll(/```([\w+#-]*)\n([\s\S]*?)```/g)]; if (fences.length) res.code = fences.map((f, i) => ({ title: short + (fences.length > 1 ? ' (' + (i + 1) + ')' : ''), lang: f[1] || '', code: f[2].trim() }));
      const lines = body.split('\n'), keep = [];
      for (const ln of lines) { const h = ln.match(/^\s*HANDOFF:\s*(grok|codex)\s*[—-]+\s*(.+)$/i); const k = ln.match(/^\s*TASK:\s*(.+)$/i); if (h) res.handoff = { to: h[1].toLowerCase(), reason: h[2].trim() }; else if (k) res.tasks.push({ title: k[1].trim() }); else keep.push(ln); }
      res.text = keep.join('\n').trim(); return res;
    }
    await wait(1100);
    return { text: 'For "' + short + '" I\'d split it into a data layer, a pure update step, and a thin presentation binding — testable without the editor running. Logged a starting point to Dev.\n\n(Simulated — live Claude wasn\'t available in this view.)', tasks: [{ title: 'Implement: ' + short }], code: [{ title: short, lang:'pseudo', code: '// ' + short + '\nstate = load()\nstate = update(state, input, dt)   // pure, testable\nrender(state)                     // thin binding' }] };
  },
};
window.HubCore = Core;
})();
