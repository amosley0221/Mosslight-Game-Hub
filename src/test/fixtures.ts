// Sample library used only by tests (the app itself starts empty).
import type { Asset, HubData } from '../core/types';
import { norm } from '../core/seed';
import { A, D, H, T, now, uid } from '../core/util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function seedProjects(): Pick<HubData, "projects" | "usageBy" | "messages"> {
  const p1: Raw = { id:'hollowmere', name:'Hollowmere', tagline:'A cozy-dark fishing town where the tide brings back the drowned. Rebuild the harbor, bargain with tide gods, keep the lights on.', tags:['3D','Stylized','PC / Console','Open world'], engines:['unreal'], platforms:['windows','mac'], stack:{ languages:['C++','Blueprints'], libraries:['Niagara','MetaSounds','Gameplay Ability System'], tools:['Perforce','RenderDoc'] }, folder:{ name:'Hollowmere' },
    code:[{id:uid(),agent:'claude',title:'Tide level sampler',file:'Source/Hollowmere/TideSubsystem.cpp',lang:'cpp',ts:now()-2*D,code:'float UTideSubsystem::SampleLevel(float WorldTime) const\n{\n    const float Phase = FMath::Fmod(WorldTime, CycleSeconds) / CycleSeconds;\n    const float Base  = FMath::Sin(Phase * 2.f * PI);\n    return FMath::Lerp(LowTideZ, HighTideZ, (Base + 1.f) * 0.5f) + StormOffset;\n}'},{id:uid(),agent:'codex',title:'Lantern HUD material — fog fade',file:'Content/UI/M_LanternFade.usf',lang:'hlsl',ts:now()-3*D,code:'float fade = saturate((Depth - FogStart) / (FogEnd - FogStart));\nreturn lerp(LanternColor, FogColor, fade * FogDensity);'}],
    tasks:[T('grok','Core pitch and three-act outline','done',5*D),T('grok','Concept: harbor at low tide','done',4*D),T('grok','Name and personality for the three tide gods','todo',1*D),T('codex','HUD style guide (lantern motif)','done',3*D),T('codex','Harbor blockout & lighting pass','doing',2*D),T('codex','Fog and water shader look-dev','todo',1*D),T('claude','Tide simulation system (Blueprint → C++)','doing',2*D),T('claude','Fishing minigame controller','todo',1*D),T('claude','Save/load for tide state','todo',6*H)],
    art:[{id:uid(),title:'Harbor at low tide',prompt:'Wooden harbor, fog, stranded boats, lantern glow, painterly',ts:now()-4*D},{id:uid(),title:'The Drowned return',prompt:'Silhouettes walking out of the water toward town lights',ts:now()-3*D},{id:uid(),title:'Tide god — Marrow',prompt:'Antler-coral deity half submerged, bioluminescent',ts:now()-2*D},{id:uid(),title:'Lighthouse keeper',prompt:'Weathered protagonist with oil lamp and net',ts:now()-1*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Stardew meets Sunless Sea. Each night the tide returns something — or someone — lost. Trade with the drowned, restore the harbor, decide who gets to stay.'},{id:uid(),title:'Core loop',agent:'claude',body:'Day: fish, repair, trade. Dusk: tide forecast. Night: the Drowned arrive; light placement decides who reaches town. Dawn: consequences.'},{id:uid(),title:'Art direction',agent:'codex',body:'Stylized realism. Desaturated teals and bone whites, warm lantern accents. Fog as a design tool for draw distance.'},{id:uid(),title:'Systems',agent:'claude',body:'Tide sim drives spawns, water level, and pathing. Persistent town state per NPC. Weather as modifier.'}],
    builds:[{id:uid(),name:'Hollowmere_Win64_Test.lnk',path:'C:\\Users\\you\\Desktop\\Hollowmere_Win64_Test.lnk',kind:'desktop',by:'codex',ts:now()-1*D},{id:uid(),name:'Hollowmere_Editor.lnk',path:'C:\\Users\\you\\Desktop\\Hollowmere_Editor.lnk',kind:'desktop',by:'codex',ts:now()-3*D}],
    activity:[A('codex','Created desktop shortcut Hollowmere_Win64_Test.lnk',1*D),A('claude','Started Tide simulation system',2*D),A('codex','Started Harbor blockout & lighting pass',2*D),A('grok','Generated concept: Tide god — Marrow',2*D),A('grok','Completed Core pitch and three-act outline',5*D)] };
  const p2: Raw = { id:'byteshift', name:'Byteshift', tagline:'Pixel roguelike where every death rewrites one rule of the dungeon.', tags:['2D','Pixel art','Fast prototype','PC / Console'], engines:['godot'], platforms:['windows','android','web'], stack:{ languages:['GDScript'], libraries:['GodotSteam','Dialogic'], tools:['Aseprite','LDtk'] }, folder:null,
    code:[{id:uid(),agent:'claude',title:'Rule hot-swap',file:'scripts/rule_engine.gd',lang:'gdscript',ts:now()-3*D,code:'func mutate(rule_id: StringName) -> void:\n    var rule := RULES[rule_id]\n    active[rule_id] = rule.next(active.get(rule_id))\n    rule_changed.emit(rule_id, active[rule_id])\n    _rebuild_floor_modifiers()'}],
    tasks:[T('grok','Rule-mutation table (40 rules)','done',6*D),T('grok','Boss concepts for floors 3, 6, 9','todo',2*D),T('codex','16×16 tileset — stone / moss / glitch','done',4*D),T('codex','Death screen rule-reveal animation','doing',1*D),T('claude','Rule engine with hot-swap','done',3*D),T('claude','Procedural floor generator','doing',1*D),T('claude','Controller remapping','todo',5*H)],
    art:[{id:uid(),title:'Glitch dungeon key art',prompt:'Pixel dungeon dissolving into corrupted tiles',ts:now()-5*D},{id:uid(),title:'Floor 3 boss — The Archivist',prompt:'Robed figure made of index cards',ts:now()-2*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Every death permanently changes one dungeon rule. Runs get stranger, never easier.'},{id:uid(),title:'Core loop',agent:'claude',body:'Descend → die → pick 1 of 3 rule mutations → descend again with the mutated ruleset.'}],
    builds:[{id:uid(),name:'Byteshift_Test.lnk',path:'C:\\Users\\you\\Desktop\\Byteshift_Test.lnk',kind:'desktop',platform:'windows',by:'codex',ts:now()-1*D},{id:uid(),name:'byteshift-debug.apk',path:'/sdcard/Download/byteshift-debug.apk',kind:'android',platform:'android',by:'codex',ts:now()-10*H},{id:uid(),name:'Byteshift_Web/index.html',path:'C:\\Users\\you\\Desktop\\Byteshift_Web\\index.html',kind:'web',by:'codex',ts:now()-2*D}],
    activity:[A('codex','Exported web build Byteshift_Web',2*D),A('claude','Completed Rule engine with hot-swap',3*D),A('grok','Completed Rule-mutation table',6*D)] };
  const p3: Raw = { id:'orbital', name:'Orbital Drift', tagline:'Browser-native zero-g racing through derelict stations.', tags:['3D','Web','Fast prototype','Stylized'], engines:['threejs'], platforms:['web','android'], stack:{ languages:['TypeScript'], libraries:['Three.js','Rapier','Howler.js','Vite'], tools:['Capacitor'] }, folder:null,
    code:[{id:uid(),agent:'claude',title:'Drift damping',file:'src/physics/drift.ts',lang:'ts',ts:now()-1*D,code:'export function applyDrift(body: RigidBody, input: Vec3, dt: number) {\n  const v = body.linvel();\n  const lateral = project(v, body.right());\n  body.applyImpulse(scale(lateral, -DRIFT_GRIP * dt), true);\n  body.applyImpulse(scale(input, THRUST * dt), true);\n}'}],
    tasks:[T('grok','Track theme list (8 stations)','done',3*D),T('codex','Neon wireframe look-dev','done',2*D),T('claude','Drift physics prototype','doing',1*D),T('claude','Ghost replay system','todo',3*H)],
    art:[{id:uid(),title:'Station Kessler flythrough',prompt:'Wireframe derelict station, neon magenta',ts:now()-2*D}],
    gdd:[{id:uid(),title:'Pitch',agent:'grok',body:'Momentum is the only brake. Race through stations that are still falling apart.'}],
    builds:[{id:uid(),name:'orbital-drift/index.html',path:'~/Desktop/orbital-drift/index.html',kind:'web',platform:'web',by:'codex',ts:now()-8*H},{id:uid(),name:'orbital-drift-debug.apk',path:'/sdcard/Download/orbital-drift-debug.apk',kind:'android',platform:'android',by:'codex',ts:now()-6*H}],
    activity:[A('codex','Exported web build orbital-drift',8*H),A('claude','Started Drift physics prototype',1*D)] };
  return {
    projects: [p1, p2, p3].map(norm),
    usageBy:{ demo:{ grok:{calls:14,tokens:31200}, codex:{calls:9,tokens:22800}, claude:{calls:21,tokens:58400} } },
    messages:{ global:[{ id:uid(), type:'agent', agent:'claude', route:'hub', pending:false, text:'Mosslight online. Type anything — I route ideas and concept art to Grok, visual design and test builds to Codex, and code to myself. Open a project tile to scope the chat to that game.' }] },
  };
}

const seedAssets = (): Asset[] => [
  { id: uid(), name: 'Mixamo_Idle_Breathing.fbx', kind: 'animation', size: '2.1 MB', tags: ['humanoid', 'idle'], ts: now() - 6 * D, usedBy: ['hollowmere'] },
  { id: uid(), name: 'Mixamo_Walk_Forward.fbx', kind: 'animation', size: '2.4 MB', tags: ['humanoid', 'locomotion'], ts: now() - 6 * D, usedBy: ['hollowmere'] },
  { id: uid(), name: 'Lantern_v3.glb', kind: 'model', size: '860 KB', tags: ['prop', 'pbr'], ts: now() - 3 * D, usedBy: ['hollowmere'] },
  { id: uid(), name: 'Moss_Albedo_2k.png', kind: 'texture', size: '4.8 MB', tags: ['foliage', '2k'], ts: now() - 2 * D, usedBy: [] },
  { id: uid(), name: 'UI_Click_Soft.wav', kind: 'audio', size: '38 KB', tags: ['ui'], ts: now() - 9 * D, usedBy: ['hollowmere', 'byteshift', 'orbital'] },
  { id: uid(), name: 'CameraShake.cs', kind: 'script', size: '3 KB', tags: ['unity', 'camera'], ts: now() - 12 * D, usedBy: ['byteshift'] },
  { id: uid(), name: 'Fog_Depth.hlsl', kind: 'shader', size: '6 KB', tags: ['fog', 'post'], ts: now() - 1 * D, usedBy: ['hollowmere'] },
];


export const sampleData = (): HubData => ({ ...seedProjects(), assets: seedAssets(), deleted: {}, devices: {} });
